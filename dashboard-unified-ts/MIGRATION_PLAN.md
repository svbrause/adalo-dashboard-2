# Migration Plan - Features to Add

## ✅ Already Migrated
- Provider authentication
- Basic layout (Sidebar, Header)
- Basic List view
- Context API setup
- API services
- Type definitions

## 🚧 High Priority - Core Features

### 1. Utilities & Helpers
- [ ] Date formatting (formatDate, formatRelativeDate)
- [ ] Status formatting (formatFacialStatus, getFacialStatusColor)
- [ ] Issue mapping (getIssueArea, groupIssuesByArea)
- [ ] Issue to Suggestion mapping
- [ ] Toast notifications
- [ ] Error handling UI

### 2. Client Detail Modal
- [ ] Modal component
- [ ] Contact information section
- [ ] Analysis results section
- [ ] Contact history display
- [ ] Action buttons (Call, Email, SMS, etc.)
- [ ] Status update functionality

### 3. Modals
- [ ] Add Client Modal
- [ ] Help Request Modal
- [ ] Telehealth SMS Modal
- [ ] New Client SMS Modal
- [ ] Patient Issues Modal

### 4. Views
- [ ] Complete List View (with all columns, sorting, actions)
- [ ] Kanban View (with drag-and-drop)
- [ ] Facial Analysis View (card grid)
- [ ] Archived View (complete)

### 5. Filtering & Sorting
- [ ] Filter UI components
- [ ] Filter logic (source, age, status, stage)
- [ ] Sort logic (all fields)
- [ ] Search enhancement

### 6. Pagination
- [ ] Pagination component
- [ ] Pagination logic for all views
- [ ] Page state management

### 7. Contact Actions
- [ ] Call functionality
- [ ] Email functionality
- [ ] SMS functionality
- [ ] Contact history logging

### 8. Data Loading
- [ ] Photo lazy loading
- [ ] Progressive data loading
- [ ] Contact history integration

## 📋 Implementation Order

1. **Utilities First** - Date, status, formatting helpers
2. **Client Detail Modal** - Most important feature
3. **Filtering & Sorting** - Core functionality
4. **Complete Views** - List, Kanban, Facial Analysis
5. **Modals** - Add client, help, SMS
6. **Contact Actions** - Call, email, SMS
7. **Polish** - Pagination, lazy loading, optimizations
