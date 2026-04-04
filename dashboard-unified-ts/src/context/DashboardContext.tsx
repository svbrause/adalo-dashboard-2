// Context for managing dashboard state

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
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
import { getWellnestSampleClientsIfEnabled } from "../debug/wellnestSampleClients";
import { withWellnestDemoDiscussedItemsOverlay } from "../utils/wellnestDemoPlanPersistence";

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
  "Location name (from Boulevard Appointments) (from Form Submissions)",
  "Appointment Service Staff First Name (from Boulevard Appointments) (from Form Submissions)",
  "Appointment Service Staff Last Name (from Boulevard Appointments) (from Form Submissions)",
  "Last Contact",
  "Contacted",
  "Record ID (from Providers)",
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

interface DashboardContextType {
  provider: Provider | null;
  setProvider: (provider: Provider | null) => void;
  /** Resolved provider ID(s) used for fetching (e.g. [250, 447] when either code logs in). Use for photo preload. */
  effectiveProviderIds: string[];
  clients: Client[];
  setClients: (clients: Client[]) => void;
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filters: FilterState;
  setFilters: (
    filters: FilterState | ((prev: FilterState) => FilterState),
  ) => void;
  sort: SortState;
  setSort: (sort: SortState | ((prev: SortState) => SortState)) => void;
  pagination: { currentPage: number; itemsPerPage: number };
  setPagination: (pagination: {
    currentPage: number;
    itemsPerPage: number;
  }) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  /** Refetch clients. Pass true to skip global loading (e.g. after modal save) to avoid white flash. */
  refreshClients: (skipLoading?: boolean) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}

interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [effectiveProviderIds, setEffectiveProviderIds] = useState<string[]>(
    [],
  );
  const [clients, setClients] = useState<Client[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    source: "",
    ageMin: null,
    ageMax: null,
    analysisStatus: "",
    skinAnalysisState: "",
    treatmentFinderState: "",
    treatmentPlanState: "",
    leadStage: "",
    locationName: "",
    providerName: "",
  });
  const [sort, setSort] = useState<SortState>({
    field: "lastContact",
    order: "desc",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 25,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache merged IDs for TheTreatment250/TheTreatment447 so we only fetch the other provider once per session
  const merged250447IdsRef = useRef<[string, string] | null>(null);

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
          const liveIds = new Set(allClients.map((c) => c.id));
          const extras = wellnestSamples
            .filter((c) => !liveIds.has(c.id))
            .map(withWellnestDemoDiscussedItemsOverlay);
          allClients = [...allClients, ...extras];
        }

        setClients(allClients);
      } catch (err: any) {
        console.error("Failed to fetch clients:", err);
        setError(err.message || "Failed to load clients");
        setClients([]);
      } finally {
        setLoading(false);
      }
    },
    [provider],
  );

  // Clear merged-ID cache when provider changes so a different login gets a fresh merge
  useEffect(() => {
    merged250447IdsRef.current = null;
  }, [provider?.id]);

  // Load clients when provider changes
  useEffect(() => {
    if (provider) {
      refreshClients();
    } else {
      setClients([]);
      setEffectiveProviderIds([]);
    }
  }, [provider, refreshClients]);

  return (
    <DashboardContext.Provider
      value={{
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
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
