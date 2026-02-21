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
  ContactHistoryEntry,
} from "../types";
import {
  fetchTableRecords,
  fetchContactHistory,
  fetchProviderByCode,
} from "../services/api";
import { mapRecordToClient } from "../utils/clientMapper";
import { mergeDuplicateLeadAndPatient } from "../utils/mergeLeadPatient";

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

        // Run leads/patients fetch and contact history fetch in parallel so we don't wait for one to finish before starting the other
        const fetchLeadsAndPatients = async (): Promise<{
          leads: Awaited<ReturnType<typeof fetchTableRecords>>;
          patients: Awaited<ReturnType<typeof fetchTableRecords>>;
        }> => {
          if (shouldFetchPerId) {
            const [leadsByProvider, patientsByProvider] = await Promise.all([
              Promise.all(
                providerIds.map((id) =>
                  fetchTableRecords("Web Popup Leads", { providerId: id }),
                ),
              ),
              Promise.all(
                providerIds.map((id) =>
                  fetchTableRecords("Patients", { providerId: id }),
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
            }),
            fetchTableRecords("Patients", { providerId: providerIdParam }),
          ]);
          return { leads, patients };
        };

        const fetchHistory = async (): Promise<{
          leads: Awaited<ReturnType<typeof fetchContactHistory>>;
          patients: Awaited<ReturnType<typeof fetchContactHistory>>;
        } | null> => {
          if (providerIds.length === 0) return null;
          try {
            if (shouldFetchPerId) {
              const [leadsHistByProvider, patientsHistByProvider] =
                await Promise.all([
                  Promise.all(
                    providerIds.map((id) =>
                      fetchContactHistory("Web Popup Leads", {
                        providerId: id,
                      }),
                    ),
                  ),
                  Promise.all(
                    providerIds.map((id) =>
                      fetchContactHistory("Patients", { providerId: id }),
                    ),
                  ),
                ]);
              const seenLead = new Set<string>();
              const leads = leadsHistByProvider.flat().filter((e) => {
                if (seenLead.has(e.id)) return false;
                seenLead.add(e.id);
                return true;
              });
              const seenPatient = new Set<string>();
              const patients = patientsHistByProvider.flat().filter((e) => {
                if (seenPatient.has(e.id)) return false;
                seenPatient.add(e.id);
                return true;
              });
              return { leads, patients };
            }
            const providerIdParam = providerIds[0];
            const [leads, patients] = await Promise.all([
              fetchContactHistory("Web Popup Leads", {
                providerId: providerIdParam,
              }),
              fetchContactHistory("Patients", {
                providerId: providerIdParam,
              }),
            ]);
            return { leads, patients };
          } catch (contactError) {
            console.warn("Failed to fetch contact history:", contactError);
            return null;
          }
        };

        const [{ leads: leadsRecords, patients: patientsRecords }, historyResult] =
          await Promise.all([fetchLeadsAndPatients(), fetchHistory()]);

        const leadsClients = leadsRecords.map((record) =>
          mapRecordToClient(record, "Web Popup Leads"),
        );
        const patientsClients = patientsRecords.map((record) =>
          mapRecordToClient(record, "Patients"),
        );

        let allClients = [...leadsClients, ...patientsClients];

        // Consolidate same person as Web Popup Lead + Patient (e.g. Add Client then Scan In-Clinic) into one row
        allClients = mergeDuplicateLeadAndPatient(allClients);

        if (historyResult) {
          const { leads: leadsHistory, patients: patientsHistory } =
            historyResult;
          const allContactHistory = [...leadsHistory, ...patientsHistory];
          const contactHistoryByLeadId = allContactHistory.reduce(
            (acc, entry) => {
              if (!acc[entry.leadId]) {
                acc[entry.leadId] = [];
              }
              acc[entry.leadId].push(entry);
              return acc;
            },
            {} as Record<string, any[]>,
          );

          allClients = allClients.map((client) => {
            const patientHistory = contactHistoryByLeadId[client.id] || [];
            const leadHistory = client.linkedLeadId
              ? contactHistoryByLeadId[client.linkedLeadId] || []
              : [];
            const history = [...patientHistory, ...leadHistory];
            const sortedHistory = history.sort(
              (a: ContactHistoryEntry, b: ContactHistoryEntry) =>
                new Date(b.date).getTime() - new Date(a.date).getTime(),
            );
            const lastContact =
              sortedHistory.length > 0 ? sortedHistory[0].date : null;

            return {
              ...client,
              contactHistory: sortedHistory,
              lastContact,
            };
          });
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
