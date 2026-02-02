# Missing Features from Original JS Version

Based on comparison with `dashboard-unified.js`, here are features that exist in the original but may not be fully integrated into the React/TypeScript version:

## 🔴 High Priority Missing Features

### 1. **Patient Issues Modal** (Standalone Modal)
- **Location in JS**: `showPatientIssuesModal()` (line ~2552)
- **What it does**: A separate modal that can be opened from facial analysis cards to show detailed patient issues grouped by area
- **Status**: ❌ Not implemented
- **Notes**: This is different from the analysis results section in the Client Detail Modal. It's a standalone modal that can be triggered from cards.

### 2. **Drag and Drop for Kanban View**
- **Location in JS**: `handleDragStart()`, `handleDragEnd()`, `handleDrop()` (lines ~2948-3100)
- **What it does**: Allows dragging client cards between status columns (New → Contacted → Scheduled → Converted)
- **Status**: ❌ Not implemented
- **Notes**: The Kanban view exists but cards are not draggable. Need to add HTML5 drag-and-drop API.

### 3. **Column Header Sorting**
- **Location in JS**: `sortByColumn()` (line ~3434)
- **What it does**: Click column headers in List View to sort (in addition to dropdown sorting)
- **Status**: ❌ Not implemented
- **Notes**: Currently only has dropdown sorting. Need clickable column headers with sort indicators (↑ ↓).

### 4. **Photo Lazy Loading System**
- **Location in JS**: `preloadVisibleCardPhotos()`, `preloadVisibleListPhotos()`, `preloadClientPhotos()`, `fetchClientFrontPhoto()` (lines ~4880-5428)
- **What it does**: Progressive photo loading - only loads photos for visible clients, with debouncing
- **Status**: ⚠️ Partially implemented
- **Notes**: Photos are loaded but may not have the same progressive loading strategy. The original has sophisticated preloading that only loads photos for visible items.

### 5. **Facial Analysis Status Drag and Drop**
- **Location in JS**: `handleFacialDrop()` (line ~2967)
- **What it does**: Drag clients between facial analysis status columns in the Facial Analysis view
- **Status**: ❌ Not implemented
- **Notes**: The Facial Analysis view exists but doesn't have drag-and-drop for status changes.

## 🟡 Medium Priority Features

### 6. **Scan in Clinic (Full Implementation)**
- **Location in JS**: `scanClientInClinic()` (line ~4196)
- **What it does**: Opens Jotform URL with provider info for in-clinic scanning
- **Status**: ⚠️ Partially implemented
- **Notes**: The button exists but may need to ensure it opens the correct form URL with proper parameters.

### 7. **Update Facial Analysis Status API**
- **Location in JS**: `updateFacialAnalysisStatus()` (line ~3003)
- **What it does**: Updates facial analysis status in Airtable when dragging in Facial Analysis view
- **Status**: ❌ Not implemented
- **Notes**: Need API service function for this.

### 8. **Sort Indicators in Column Headers**
- **Location in JS**: `updateSortIndicators()` (line ~3460)
- **What it does**: Shows ↑ or ↓ arrows in column headers to indicate current sort
- **Status**: ❌ Not implemented
- **Notes**: Visual feedback for which column is sorted and in what direction.

### 9. **Clear Filters Function**
- **Location in JS**: `clearFilters()` (line ~3474)
- **What it does**: Button to clear all filters at once
- **Status**: ❌ Not implemented
- **Notes**: Convenience feature to reset all filters.

## 🟢 Low Priority / Nice-to-Have

### 10. **Photo Loading Placeholders**
- **Location in JS**: Photo loading states in modals and cards
- **What it does**: Shows loading placeholders while photos are being fetched
- **Status**: ⚠️ May be partially implemented
- **Notes**: The original has specific loading states for photos.

### 11. **shouldLoadPhotoForClient Logic**
- **Location in JS**: `shouldLoadPhotoForClient()` (line ~6854)
- **What it does**: Determines if a client's photo should be loaded based on facial analysis status
- **Status**: ⚠️ May need verification
- **Notes**: Only loads photos for clients with "started" or "pending" status.

### 12. **Progressive Rendering**
- **Location in JS**: Progressive rendering in `loadLeadsFromAirtable()` (line ~1617)
- **What it does**: Renders dashboard immediately with basic data, then updates with contact history
- **Status**: ⚠️ May be partially implemented
- **Notes**: The original renders twice - once with basic data, then again with contact history attached.

## 📊 Summary

**Total Missing Features**: ~12 items
- **High Priority**: 5 features
- **Medium Priority**: 4 features  
- **Low Priority**: 3 features

## 🎯 Recommended Implementation Order

1. **Column Header Sorting** - Easy to add, high UX value
2. **Drag and Drop for Kanban** - Core Kanban functionality
3. **Patient Issues Modal** - Standalone feature that's useful
4. **Photo Lazy Loading** - Performance optimization
5. **Facial Analysis Drag and Drop** - Nice-to-have for Facial Analysis view
6. **Clear Filters Button** - Quick win, good UX
7. **Sort Indicators** - Visual polish
8. **Remaining items** - As needed

## ✅ Already Implemented

- ✅ All modals (Add Client, Help, SMS, Welcome)
- ✅ All views (List, Kanban, Facial Analysis, Archived)
- ✅ Complete Client Detail Modal
- ✅ Contact History management
- ✅ Status updates
- ✅ Archive/unarchive
- ✅ Filtering and sorting (via dropdowns)
- ✅ Pagination
- ✅ SMS functionality
- ✅ Form field mapping
- ✅ Analysis results display (in modal)
