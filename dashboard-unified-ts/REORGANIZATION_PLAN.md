# File Reorganization Plan

## Current Issues
- `modals/` has 14 components (28 files) - too cluttered
- Some "modals" are actually sections (ContactHistorySection, AnalysisResultsSection)
- Utils has 11 files that could be better organized

## Proposed New Structure

```
src/components/
  modals/
    client/                    # Client management modals
      - AddClientModal.tsx/css
      - ClientDetailModal.tsx/css
    sms/                       # SMS notification modals
      - NewClientSMSModal.tsx/css
      - ShareAnalysisModal.tsx/css
      - TelehealthSMSModal.tsx/css
    analysis/                  # Analysis-related modals
      - PatientIssuesModal.tsx/css
    system/                    # System/utility modals
      - WelcomeModal.tsx/css
      - HelpRequestModal.tsx/css
      - PhotoViewerModal.tsx/css
    sections/                   # Sections used within modals
      - AnalysisResultsSection.tsx/css
      - ContactHistorySection.tsx/css
  views/                       # (unchanged - already organized)
  layout/                      # (unchanged - already organized)
  auth/                        # (unchanged - already organized)
  common/                      # (unchanged - already organized)
```

## Alternative: Feature-Based Organization

```
src/components/
  client/                      # All client-related components
    modals/
      - AddClientModal.tsx/css
      - ClientDetailModal.tsx/css
    sections/
      - ContactHistorySection.tsx/css
  communication/               # SMS/communication features
    modals/
      - NewClientSMSModal.tsx/css
      - ShareAnalysisModal.tsx/css
      - TelehealthSMSModal.tsx/css
  analysis/                    # Analysis features
    modals/
      - PatientIssuesModal.tsx/css
    sections/
      - AnalysisResultsSection.tsx/css
  system/                      # System/utility components
    modals/
      - WelcomeModal.tsx/css
      - HelpRequestModal.tsx/css
      - PhotoViewerModal.tsx/css
```

## Recommendation

**Option 1 (Category-based)** is recommended because:
- Clearer separation by component type (modals vs sections)
- Easier to find related functionality
- Less nested directories
- Better for teams working on different features

## Migration Steps

1. Create new directory structure
2. Move files to new locations
3. Update all import statements
4. Test to ensure everything works
5. Remove old directories

## Import Path Updates Needed

Files that import from modals:
- `src/components/views/ArchivedView.tsx`
- `src/components/views/FacialAnalysisView.tsx`
- `src/components/views/ListView.tsx`
- `src/components/views/KanbanView.tsx`
- `src/components/auth/ProviderLoginScreen.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Header.tsx`
- `src/components/modals/ClientDetailModal.tsx` (imports sections)
