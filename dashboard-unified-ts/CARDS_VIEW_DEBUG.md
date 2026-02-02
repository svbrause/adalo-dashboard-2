# Cards View Debugging Guide

## Potential Issues & Solutions

### Issue 1: Cards View Not Showing
**Symptoms**: Clicking "Cards" button shows nothing or blank screen

**Possible Causes**:
1. View state not updating correctly
2. Component not rendering
3. CSS hiding the view
4. No clients to display

**Debug Steps**:
1. Open browser DevTools Console
2. Check for JavaScript errors
3. Verify `currentView` state changes to 'facial-analysis' when clicking Cards
4. Check if `FacialAnalysisView` component is rendering
5. Verify clients array has data
6. Check Network tab for API errors

### Issue 2: Cards Not Displaying Correctly
**Symptoms**: Cards render but layout is broken

**Possible Causes**:
1. CSS conflicts between `FacialAnalysisView.css` and `index.css`
2. Grid layout not working
3. Cards too small/large

**Debug Steps**:
1. Inspect `.facial-analysis-cards-grid` element
2. Check computed styles
3. Verify grid-template-columns is applied
4. Check for CSS conflicts

### Issue 3: Filters Not Working
**Symptoms**: Filters don't affect cards view

**Possible Causes**:
1. Filtering logic issue
2. Status normalization mismatch

**Fix Applied**: ✅ Updated analysis status filtering to use `formatFacialStatus()`

### Issue 4: Photos Not Loading
**Symptoms**: Photo placeholders but no images

**Possible Causes**:
1. Batch photo loading not working
2. API errors
3. Photo URLs incorrect

**Debug Steps**:
1. Check Network tab for photo requests
2. Verify `preloadVisiblePhotos()` is called
3. Check console for photo loading errors

## Quick Fixes Applied

1. ✅ **Analysis Status Filtering**: Fixed to use `formatFacialStatus()` for consistent comparison
2. ✅ **Status Formatting**: Updated to match original JS behavior (handles null, empty, "not-started" as "Pending")

## Testing Checklist

- [ ] Click "Cards" button - view switches correctly
- [ ] Cards display in grid layout
- [ ] All clients show (not just Patients)
- [ ] Filters work correctly
- [ ] Sorting works correctly
- [ ] Pagination works
- [ ] Cards are clickable
- [ ] Cards can be expanded
- [ ] Photos load (if available)
- [ ] Drag-and-drop works (for Patients)

## Comparison with List View

If List view works but Cards view doesn't:

1. **Check View Routing**: Both should use same data source
2. **Check Filtering**: Both use same `applyFilters()` function
3. **Check CSS**: Cards view has additional CSS that might conflict
4. **Check Component**: FacialAnalysisView vs ListView - different components

## Common Issues

### Cards View Shows Empty
- Check if `processedClients.length === 0`
- Verify filters aren't too restrictive
- Check if clients are being filtered out incorrectly

### Cards Not Clickable
- Verify `onClick` handler is attached
- Check for z-index issues
- Verify no overlay blocking clicks

### Photos Not Showing
- Check `client.frontPhoto` exists
- Verify photo loading is triggered
- Check Network tab for failed requests
