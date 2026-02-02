# Migration Guide - Adding Remaining Features

This guide helps you systematically add the remaining features from `dashboard-unified.js` to the React/TypeScript version.

## Quick Start

1. **Utilities are done** ✅ - Date formatting, status formatting, toast, issue mapping
2. **Client Detail Modal** ✅ - Basic version created
3. **Continue with these priorities:**

## Step-by-Step Migration

### 1. Complete Client Detail Modal
- [ ] Add full contact history display
- [ ] Add analysis results section (for Patients)
- [ ] Add contact log form
- [ ] Add SMS functionality
- [ ] Add status update functionality

### 2. Add Filtering & Sorting
Copy logic from `dashboard-unified.js`:
- `applyFilters()` (line ~3403)
- `applySorting()` (line ~3417)
- `sortByColumn()` (line ~3434)
- Add filter UI components in `ViewControls.tsx`

### 3. Add Pagination
- Copy `goToPage()` logic (line ~3493)
- Create `Pagination.tsx` component
- Add to all views (List, Kanban, Facial Analysis, Archived)

### 4. Complete Kanban View
- Copy `renderKanban()` (line ~1814)
- Copy `createClientCard()` (line ~2899)
- Add drag-and-drop handlers
- Add `handleDrop()` logic (line ~3062)

### 5. Complete Facial Analysis View
- Copy `renderFacialAnalysis()` (line ~1871)
- Copy `createFacialAnalysisCard()` (line ~2086)
- Add card expansion functionality
- Add photo lazy loading

### 6. Add All Modals
- **Add Client Modal**: Copy `handleAddLead()` logic
- **Help Request Modal**: Copy `handleHelpRequest()` logic
- **SMS Modals**: Copy SMS sending logic
- **Patient Issues Modal**: Copy `showPatientIssuesModal()` (line ~2552)

### 7. Add Contact Actions
- Copy contact history logging (`saveContactLog()` line ~6020)
- Add call/email/SMS buttons
- Add contact log form

### 8. Add Data Loading Enhancements
- Photo lazy loading (`preloadVisibleCardPhotos()` line ~4880)
- Progressive loading
- Batch photo fetching

## Helper Functions to Migrate

### From dashboard-unified.js:

**Date/Formatting:**
- `formatDate()` - Already migrated ✅
- `formatRelativeDate()` - Already migrated ✅
- `formatContactType()` - Add to utils
- `formatOutcome()` - Add to utils

**Validation:**
- `isValidEmail()` - Add to utils
- `isValidPhone()` - Add to utils
- `isValidZipCode()` - Add to utils

**Data Processing:**
- `splitName()` - Add to utils
- `cleanPhoneNumber()` - Add to utils
- `mapAreasToFormFields()` - Add to utils
- `mapSkinComplaints()` - Add to utils

**UI Helpers:**
- `showLoadingState()` / `hideLoadingState()` - Use React state
- `updateSortIndicators()` - Use React state
- `updatePaginationControls()` - Use React component

## Component Structure

For each major feature, create:
1. Component file (`ComponentName.tsx`)
2. CSS file (`ComponentName.css`)
3. Types (add to `types/index.ts` if needed)
4. Utils (if reusable logic)

## Testing Checklist

After migrating each feature:
- [ ] Test with real data
- [ ] Test error handling
- [ ] Test edge cases
- [ ] Compare with original behavior
- [ ] Check TypeScript types
- [ ] Verify styling matches

## Common Patterns

### Converting Functions to React Components

**Before (JS):**
```javascript
function renderList() {
  const html = clients.map(client => `<tr>...</tr>`).join('');
  document.getElementById('tbody').innerHTML = html;
}
```

**After (React):**
```tsx
function ListView() {
  return (
    <tbody>
      {clients.map(client => (
        <tr key={client.id}>...</tr>
      ))}
    </tbody>
  );
}
```

### Converting Event Handlers

**Before (JS):**
```javascript
function handleClick() {
  // logic
}
element.onclick = handleClick;
```

**After (React):**
```tsx
const handleClick = () => {
  // logic
};
<button onClick={handleClick}>Click</button>
```

### Converting State Management

**Before (JS):**
```javascript
let currentView = 'list';
function switchView(view) {
  currentView = view;
  renderDashboard();
}
```

**After (React):**
```tsx
const [currentView, setCurrentView] = useState('list');
// Use setCurrentView('list') to update
```

## Next Steps

1. Start with completing the Client Detail Modal (highest priority)
2. Add filtering and sorting (core functionality)
3. Complete the views (List, Kanban, Facial Analysis)
4. Add remaining modals
5. Polish and optimize

## Need Help?

Refer to:
- Original `dashboard-unified.js` for logic reference
- `MIGRATION_PLAN.md` for feature checklist
- Component files for React patterns
- Utility files for helper functions
