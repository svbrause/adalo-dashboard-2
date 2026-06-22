// Context for managing dashboard state

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  Client,
  Provider,
  ViewType,
  FilterState,
  SortState,
} from "../types";
import {
  fetchTableRecords,
  fetchProviderByCode,
} from "../services/api";
import { mapRecordToClient } from "../utils/clientMapper";
import { mergeDuplicateLeadAndPatient } from "../utils/mergeLeadPatient";
import {
  getWellnestSampleClientsIfEnabled,
  filterOutWellnestSamplesDuplicatedByName,
} from "../debug/wellnestSampleClients";
import {
  getSlimStudioSampleClientsIfEnabled,
  filterOutSlimStudioSamplesDuplicatedByName,
} from "../debug/slimStudioSampleClients";
import {
  getGravitasSampleClientsIfEnabled,
  filterOutGravitasSamplesDuplicatedByName,
} from "../debug/gravitasSampleClients";
import {
  getPrettyPleaseSampleClientsIfEnabled,
  filterOutPrettyPleaseSamplesDuplicatedByName,
} from "../debug/prettyPleaseSampleClients";
import { withSessionDemoDiscussedItemsOverlay } from "../utils/wellnestDemoPlanPersistence";
import {
  parseDashboardRoute,
  type ClientDetailSection,
  type DashboardRoute,
} from "../utils/dashboardRoutes";
import {
  useDashboardNavigation,
} from "../hooks/useDashboardNavigation";
import { getAdminDemoClientsIfEnabled } from "../debug/adminDemoClients";
import { createOptimisticClinicScanClient } from "../utils/clinicScanOptimisticClient";
import { getAllBackgroundScanSnapshots } from "../utils/scanJobBackground";
import { DashboardContext } from "./dashboardContextRef";

export { useDashboard } from "./dashboardContextRef";
export type { ClientDetailSection, DashboardRoute } from "./dashboardContextRef";

/**
 * Minimal set of Airtable field names the dashboard list/grid/kanban views actually read.
 * Requesting only these avoids transferring large long-text blobs (quiz JSON, etc.)
 * that are only needed when opening a client detail panel.
 */
const PATIENTS_LIST_FIELDS: string[] = [
  "Name",
  "Email",
  "Patient Phone Number",
  "Phone Number",
  "Status",
  "Pending/Opened",
  "Front Photo",
  "Front photo",
  "Front Photo (from Form Submissions)",
  "Side Photo (from Form Submissions)",
  "Source",
  "source",
  "Name (from Interest Items)",
  "Goals",
  "Wellness Goals",
  "Age (from Form Submissions)",
  "Age",
  "Birthday (from Form Submissions)",
  "Zip Code",
  "Zip",
  "Postal Code",
  "Areas of Interest (from Form Submissions)",
  "Which regions of your face do you want to improve? (from Form Submissions)",
  "What would you like to improve? (from Form Submissions)",
  "Aesthetic Goals",
  "Notes",
  "Name (from All Issues) (from Analyses)",
  /** Long text JSON — detector issue severities; used in Facial Analysis + Analysis Overview when present. */
  "Severity Scores (from Analyses)",
  "Processed Areas of Interest (from Form Submissions)",
  "Do you have any skin complaints? (from Form Submissions)",
  "Photos Viewed",
  "Interested Photos Viewed",
  "Archived",
  "Offer Claimed",
  "Offer Earned",
  "Offer Expiration",
  "Offer Expiration Date",
  "Coupon Expiration",
  "Treatments Discussed",
  "Discussed Treatments",
  /** Long text — needed for peptide suggestions + match % (list fetch used to omit this, leaving scores at 0). */
  "Wellness Quiz",
  "Location name (from Boulevard Appointments) (from Form Submissions)",
  "Appointment Service Staff First Name (from Boulevard Appointments) (from Form Submissions)",
  "Appointment Service Staff Last Name (from Boulevard Appointments) (from Form Submissions)",
  "Last Contact",
  "Contacted",
  "Record ID (from Providers)",
  "Turntable Video URL",
  "Aura Manifest URL",
  "Aura Asset Manifest URL",
  "Aura GCS Prefix",
  "Aura Asset Prefix",
  "Aura Assets Prefix",
];

const WEB_POPUP_LEADS_LIST_FIELDS: string[] = [
  "Name",
  "Email Address",
  "Phone Number",
  "Status",
  "Pending/Opened",
  "Source",
  "source",
  "Goals",
  "Concerns",
  "Areas",
  "Aesthetic Goals",
  "Notes",
  "Skin Type",
  "Skin Tone",
  "Ethnic Background",
  "Engagement Level",
  "Cases Viewed Count",
  "Total Cases Available",
  "Concerns Explored",
  "Liked Photos",
  "Viewed Photos",
  "Age",
  "Age Range",
  "Date of Birth",
  "Zip Code",
  "Zip",
  "Postal Code",
  "Archived",
  "Offer Claimed",
  "Offer Earned",
  "Offer Expiration",
  "Offer Expiration Date",
  "Coupon Expiration",
  "Treatments Discussed",
  "Discussed Treatments",
  "Last Contact",
  "Contacted",
  "Record ID (from Providers)",
];

/** Provider codes that share one combined patient list (frontend merge, no backend change). */
const MERGED_PROVIDER_CODES = ["TheTreatment250", "TheTreatment447"] as const;
/** Display names the API may return for this provider (merge when name or code matches). */
const THE_TREATMENT_DISPLAY_NAMES = [
  "The Treatment",
  "San Clemente, Henderson, and Newport Beach",
];

/** True when this provider is one of the two "The Treatment" codes (by code or display name). */
function isTheTreatmentMergeProvider(p: Provider | null): boolean {
  if (!p) return false;
  const codeMatch = MERGED_PROVIDER_CODES.some(
    (c) => c.toLowerCase() === (p.code || "").toLowerCase(),
  );
  const nameTrimmed = (p.name || "").trim();
  const nameMatch = THE_TREATMENT_DISPLAY_NAMES.some(
    (name) => name === nameTrimmed,
  );
  return codeMatch || nameMatch;
}

function applyPendingTimelineOverrides(
  client: Client,
  pendingTimelineOverrides: MutableRefObject<Map<string, Map<string, string>>>,
): Client {
  const clientOverrides = pendingTimelineOverrides.current.get(client.id);
  if (!clientOverrides || clientOverrides.size === 0) return client;
  if (!client.discussedItems || client.discussedItems.length === 0) {
    return client;
  }

  let changed = false;
  const discussedItems = client.discussedItems.map((item) => {
    const pendingTimeline = clientOverrides.get(item.id);
    if (pendingTimeline === undefined) return item;

    if ((item.timeline ?? "").trim() === pendingTimeline.trim()) {
      return item;
    }

    changed = true;
    return { ...item, timeline: pendingTimeline };
  });

  return changed ? { ...client, discussedItems } : client;
}

function preserveBackgroundScanClients(
  fetchedClients: Client[],
  previousClients: Client[],
): Client[] {
  const scanSnapshots = getAllBackgroundScanSnapshots();
  if (scanSnapshots.length === 0) return fetchedClients;

  const previousById = new Map(
    previousClients.map((client) => [client.id, client]),
  );
  const fetchedIds = new Set(fetchedClients.map((client) => client.id));
  const preservedClients = scanSnapshots
    .filter((snapshot) => !fetchedIds.has(snapshot.recordId))
    .map((snapshot) =>
      previousById.get(snapshot.recordId) ??
      createOptimisticClinicScanClient({
        recordId: snapshot.recordId,
        tableName: snapshot.tableName,
        clientName: snapshot.clientName,
      }),
    );

  return preservedClients.length > 0
    ? [...preservedClients, ...fetchedClients]
    : fetchedClients;
}

interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const [darkMode, setDarkModeState] = useState<boolean>(
    () => localStorage.getItem("dashboardDarkMode") !== "false",
  );

  const setDarkMode = useCallback((v: boolean) => {
    setDarkModeState(v);
    localStorage.setItem("dashboardDarkMode", String(v));
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  const [provider, setProvider] = useState<Provider | null>(null);
  const [effectiveProviderIds, setEffectiveProviderIds] = useState<string[]>(
    [],
  );
  const [clients, setClients] = useState<Client[]>([]);
  const initialRoute = parseDashboardRoute();
  const [currentView, setCurrentView] = useState<ViewType>(
    () => initialRoute?.view ?? "list",
  );
  const [routeClientId, setRouteClientId] = useState<string | null>(
    () => initialRoute?.clientId ?? null,
  );
  const [routeSection, setRouteSection] = useState<ClientDetailSection | null>(
    () => initialRoute?.section ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    source: "",
    ageMin: null,
    ageMax: null,
    analysisStatus: "",
    skinAnalysisState: "",
    treatmentFinderState: "",
    treatmentPlanState: "",
    quizState: "",
    locationName: "",
    providerName: "",
  });
  const [sort, setSort] = useState<SortState>({
    field: "lastContact",
    order: "desc",
  });
  const [pagination, setPaginationState] = useState({
    currentPage: initialRoute?.page ?? 1,
    itemsPerPage: 25,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRouteApplied = useCallback((route: DashboardRoute) => {
    if (route.clientId) return;
    const page = route.page ?? 1;
    setPaginationState((prev) =>
      prev.currentPage === page ? prev : { ...prev, currentPage: page },
    );
  }, []);

  const { navigateDashboard, openClient, closeClient } = useDashboardNavigation({
    currentView,
    setCurrentView,
    routeClientId,
    setRouteClientId,
    routeSection,
    setRouteSection,
    listPage: pagination.currentPage,
    onRouteApplied,
    enabled: Boolean(provider),
  });

  const setPagination = useCallback(
    (next: { currentPage: number; itemsPerPage: number }) => {
      setPaginationState(next);
      const parsed = parseDashboardRoute();
      if (!parsed || parsed.clientId) return;
      const urlPage = parsed.page ?? 1;
      if (urlPage === next.currentPage) return;
      navigateDashboard(
        {
          view: parsed.view,
          section: parsed.section,
          page: next.currentPage > 1 ? next.currentPage : undefined,
        },
        { replace: true },
      );
    },
    [navigateDashboard],
  );

  // Cache merged IDs for TheTreatment250/TheTreatment447 so we only fetch the other provider once per session
  const merged250447IdsRef = useRef<[string, string] | null>(null);
  const pendingPlanTimelineOverridesRef = useRef<
    Map<string, Map<string, string>>
  >(new Map());

  const cacheClientDiscussedItemTimeline = useCallback(
    (clientId: string, itemId: string, timeline: string) => {
      const clientOverrides =
        pendingPlanTimelineOverridesRef.current.get(clientId) ?? new Map();
      clientOverrides.set(itemId, timeline);
      pendingPlanTimelineOverridesRef.current.set(clientId, clientOverrides);

      setClients((prevClients) =>
        prevClients.map((client) => {
          if (client.id !== clientId || !client.discussedItems) return client;
          return {
            ...client,
            discussedItems: client.discussedItems.map((item) =>
              item.id === itemId ? { ...item, timeline } : item,
            ),
          };
        }),
      );
    },
    [],
  );

  const clearClientDiscussedItemTimelineCache = useCallback(
    (clientId: string, itemId?: string, expectedTimeline?: string) => {
      const clientOverrides =
        pendingPlanTimelineOverridesRef.current.get(clientId);
      if (!clientOverrides) return;

      if (!itemId) {
        pendingPlanTimelineOverridesRef.current.delete(clientId);
        return;
      }

      if (
        expectedTimeline !== undefined &&
        clientOverrides.get(itemId) !== expectedTimeline
      ) {
        return;
      }

      clientOverrides.delete(itemId);
      if (clientOverrides.size === 0) {
        pendingPlanTimelineOverridesRef.current.delete(clientId);
      } else {
        pendingPlanTimelineOverridesRef.current.set(clientId, clientOverrides);
      }
    },
    [],
  );

  const refreshClients = useCallback(
    async (skipLoading = false) => {
      if (!provider || !provider.id) {
        setClients([]);
        return;
      }

      const isMerge = isTheTreatmentMergeProvider(provider);

      if (!skipLoading) {
        setLoading(true);
      }
      setError(null);

      const fallbackAdminDemos = getAdminDemoClientsIfEnabled(provider, []).map(
        withSessionDemoDiscussedItemsOverlay,
      );
      if (fallbackAdminDemos.length > 0) {
        setClients((prevClients) => {
          const existingIds = new Set(prevClients.map((client) => client.id));
          const missingDemos = fallbackAdminDemos.filter(
            (client) => !existingIds.has(client.id),
          );
          if (missingDemos.length === 0) return prevClients;
          return prevClients.length > 0
            ? [...prevClients, ...missingDemos]
            : fallbackAdminDemos;
        });
      }

      try {
        let providerIds: string[];

        if (provider.mergedProviderIds?.length) {
          providerIds = provider.mergedProviderIds;
        } else if (isMerge) {
          // Special case: TheTreatment250 and TheTreatment447 share one list.
          // Always fetch both providers by code, then fetch patients/leads for both IDs and merge.
          if (!merged250447IdsRef.current) {
            const [p250, p447] = await Promise.all([
              fetchProviderByCode("TheTreatment250"),
              fetchProviderByCode("TheTreatment447"),
            ]);
            merged250447IdsRef.current = [p250.id, p447.id];
          }
          providerIds = [...merged250447IdsRef.current];
        } else {
          providerIds = [provider.id];
        }

        setEffectiveProviderIds(providerIds);

        // If we have multiple IDs and backend may not support comma-separated, fetch per ID and merge
        const shouldFetchPerId = providerIds.length > 1;

        const fetchLeadsAndPatients = async (): Promise<{
          leads: Awaited<ReturnType<typeof fetchTableRecords>>;
          patients: Awaited<ReturnType<typeof fetchTableRecords>>;
        }> => {
          if (shouldFetchPerId) {
            const [leadsByProvider, patientsByProvider] = await Promise.all([
              Promise.all(
                providerIds.map((id) =>
                  fetchTableRecords("Web Popup Leads", {
                    providerId: id,
                    fields: WEB_POPUP_LEADS_LIST_FIELDS,
                  }),
                ),
              ),
              Promise.all(
                providerIds.map((id) =>
                  fetchTableRecords("Patients", {
                    providerId: id,
                    fields: PATIENTS_LIST_FIELDS,
                  }),
                ),
              ),
            ]);
            const seenLead = new Set<string>();
            const leads = leadsByProvider.flat().filter((r) => {
              if (seenLead.has(r.id)) return false;
              seenLead.add(r.id);
              return true;
            });
            const seenPatient = new Set<string>();
            const patients = patientsByProvider.flat().filter((r) => {
              if (seenPatient.has(r.id)) return false;
              seenPatient.add(r.id);
              return true;
            });
            return { leads, patients };
          }
          const providerIdParam = providerIds[0];
          const [leads, patients] = await Promise.all([
            fetchTableRecords("Web Popup Leads", {
              providerId: providerIdParam,
              fields: WEB_POPUP_LEADS_LIST_FIELDS,
            }),
            fetchTableRecords("Patients", {
              providerId: providerIdParam,
              fields: PATIENTS_LIST_FIELDS,
            }),
          ]);
          return { leads, patients };
        };

        const { leads: leadsRecords, patients: patientsRecords } =
          await fetchLeadsAndPatients();

        const leadsClients = leadsRecords.map((record) =>
          mapRecordToClient(record, "Web Popup Leads"),
        );
        const patientsClients = patientsRecords.map((record) =>
          mapRecordToClient(record, "Patients"),
        );

        let allClients = [...leadsClients, ...patientsClients];

        // Consolidate same person as Web Popup Lead + Patient (e.g. Add Client then Scan In-Clinic) into one row
        allClients = mergeDuplicateLeadAndPatient(allClients);

        const wellnestSamples = getWellnestSampleClientsIfEnabled(
          provider?.code,
        );
        if (wellnestSamples.length > 0) {
          const noNameDupes = filterOutWellnestSamplesDuplicatedByName(
            allClients,
            wellnestSamples,
          );
          const liveIds = new Set(allClients.map((c) => c.id));
          const extras = noNameDupes
            .filter((c) => !liveIds.has(c.id))
            .map(withSessionDemoDiscussedItemsOverlay);
          allClients = [...allClients, ...extras];
        }

        const slimStudioSamples = getSlimStudioSampleClientsIfEnabled(provider);
        if (slimStudioSamples.length > 0) {
          const noNameDupes = filterOutSlimStudioSamplesDuplicatedByName(
            allClients,
            slimStudioSamples,
          );
          const liveIds = new Set(allClients.map((c) => c.id));
          const extras = noNameDupes
            .filter((c) => !liveIds.has(c.id))
            .map(withSessionDemoDiscussedItemsOverlay);
          allClients = [...allClients, ...extras];
        }

        const gravitasSamples = getGravitasSampleClientsIfEnabled(provider);
        if (gravitasSamples.length > 0) {
          const noNameDupes = filterOutGravitasSamplesDuplicatedByName(
            allClients,
            gravitasSamples,
          );
          const liveIds = new Set(allClients.map((c) => c.id));
          const extras = noNameDupes
            .filter((c) => !liveIds.has(c.id))
            .map(withSessionDemoDiscussedItemsOverlay);
          allClients = [...allClients, ...extras];
        }

        const prettyPleaseSamples = getPrettyPleaseSampleClientsIfEnabled(provider);
        if (prettyPleaseSamples.length > 0) {
          const noNameDupes = filterOutPrettyPleaseSamplesDuplicatedByName(
            allClients,
            prettyPleaseSamples,
          );
          const liveIds = new Set(allClients.map((c) => c.id));
          const extras = noNameDupes
            .filter((c) => !liveIds.has(c.id))
            .map(withSessionDemoDiscussedItemsOverlay);
          allClients = [...allClients, ...extras];
        }

        const adminDemos = getAdminDemoClientsIfEnabled(provider, allClients);
        if (adminDemos.length > 0) {
          allClients = [
            ...allClients,
            ...adminDemos.map(withSessionDemoDiscussedItemsOverlay),
          ];
        }

        allClients = allClients.map((client) =>
          applyPendingTimelineOverrides(
            client,
            pendingPlanTimelineOverridesRef,
          ),
        );

        setClients((prevClients) =>
          preserveBackgroundScanClients(allClients, prevClients),
        );
      } catch (err: any) {
        console.error("Failed to fetch clients:", err);
        setError(err.message || "Failed to load clients");
        setClients((prevClients) => {
          if (fallbackAdminDemos.length === 0) {
            return preserveBackgroundScanClients([], prevClients);
          }
          const existingIds = new Set(prevClients.map((client) => client.id));
          const missingDemos = fallbackAdminDemos.filter(
            (client) => !existingIds.has(client.id),
          );
          const nextClients = missingDemos.length > 0
            ? [...prevClients, ...missingDemos]
            : prevClients;
          return preserveBackgroundScanClients(nextClients, prevClients);
        });
      } finally {
        setLoading(false);
      }
    },
    [provider],
  );

  // Always holds the latest refreshClients so the provider-ID effect below never has a stale closure
  const refreshClientsRef = useRef(refreshClients);
  useEffect(() => {
    refreshClientsRef.current = refreshClients;
  }, [refreshClients]);

  // Clear merged-ID cache when provider changes so a different login gets a fresh merge
  useEffect(() => {
    merged250447IdsRef.current = null;
  }, [provider?.id]);

  // Load clients only when the provider identity (ID) changes — not on every field update such
  // as Treatment Pricing. Triggering a full reload on any field update sets loading=true, which
  // unmounts ClientDetailPanel and loses local state like recommenderMode.
  useEffect(() => {
    if (provider?.id) {
      refreshClientsRef.current();
    } else {
      setClients([]);
      setEffectiveProviderIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  return (
    <DashboardContext.Provider
      value={{
        darkMode,
        setDarkMode,
        provider,
        setProvider,
        effectiveProviderIds,
        clients,
        setClients,
        currentView,
        setCurrentView,
        searchQuery,
        setSearchQuery,
        filters,
        setFilters,
        sort,
        setSort,
        pagination,
        setPagination,
        loading,
        setLoading,
        error,
        setError,
        refreshClients,
        cacheClientDiscussedItemTimeline,
        clearClientDiscussedItemTimelineCache,
        routeClientId,
        routeSection,
        navigateDashboard,
        openClient,
        closeClient,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
