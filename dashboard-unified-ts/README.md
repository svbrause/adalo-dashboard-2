# Unified Dashboard - TypeScript/React Version

This is a refactored, component-based TypeScript/React version of the unified dashboard. It maintains all the functionality of the original monolithic JavaScript version while providing better code organization, type safety, and maintainability.

## 🎯 Purpose

This directory is a **standalone, self-contained** version of the unified dashboard that:
- ✅ Preserves all existing functionality
- ✅ Uses modern React + TypeScript architecture
- ✅ Organizes code into reusable components
- ✅ Separates concerns (components, services, utils, types)
- ✅ Does NOT modify any existing working code
- ✅ Can be opened in a separate Cursor window and developed independently

## 📁 Project Structure

```
dashboard-unified-ts/
├── src/
│   ├── components/
│   │   ├── auth/              # Authentication components
│   │   │   └── ProviderLoginScreen.tsx
│   │   ├── layout/            # Layout components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── ViewControls.tsx
│   │   ├── views/             # View components
│   │   │   ├── ListView.tsx
│   │   │   ├── KanbanView.tsx
│   │   │   └── ArchivedView.tsx
│   │   ├── modals/            # Modal components
│   │   │   └── WelcomeModal.tsx
│   │   └── common/            # Shared components
│   ├── context/               # React Context
│   │   └── DashboardContext.tsx
│   ├── services/              # API services
│   │   └── api.ts
│   ├── utils/                 # Utility functions
│   │   ├── providerStorage.ts
│   │   └── clientMapper.ts
│   ├── types/                 # TypeScript types
│   │   └── index.ts
│   ├── assets/                # Static assets
│   │   └── images/
│   ├── styles/                # Global styles
│   │   └── index.css
│   ├── App.tsx                # Main App component
│   └── main.tsx               # Entry point
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Access to the Airtable base (same as original dashboard)

### Installation

1. Navigate to this directory:
   ```bash
   cd dashboard-unified-ts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:3001`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 🔧 Configuration

### Environment Variables

The dashboard uses the same API configuration as the original:

- **API_BASE_URL**: Automatically detected (backend API for localhost, Vercel routes for production)
- **AIRTABLE_BASE_ID**: Set via `window.AIRTABLE_BASE_ID` or defaults to `appXblSpAMBQskgzB`

You can set these in `index.html` or via build-time injection (similar to the original).

### API Endpoints

The dashboard uses the same API endpoints as the original:
- `/api/airtable-get-provider` - Fetch provider by code
- `/api/airtable-get-leads` - Fetch leads/patients
- `/api/airtable-contact-history` - Fetch contact history
- `/api/airtable-update-record` - Update records
- `/api/airtable-sms-notifications` - Send SMS
- `/api/airtable-help-request` - Submit help requests

## 📝 Development Status

### ✅ Completed

- [x] Project structure setup
- [x] TypeScript configuration
- [x] React + Vite setup
- [x] Provider authentication
- [x] Basic layout components (Sidebar, Header)
- [x] View controls (search, view toggle)
- [x] List view (basic implementation)
- [x] Context API for state management
- [x] API service layer
- [x] Type definitions
- [x] Asset copying
- [x] CSS structure

### 🚧 In Progress / TODO

- [ ] Complete List view with full functionality
- [ ] Kanban view implementation
- [ ] Client detail modal
- [ ] Add client modal
- [ ] Contact history integration
- [ ] Filtering and sorting
- [ ] Pagination
- [ ] SMS functionality
- [ ] Help request modal
- [ ] All other modals from original
- [ ] Full CSS migration
- [ ] Testing

## 🔄 Migration Notes

### Key Differences from Original

1. **Component-based**: Code is split into React components instead of one large JS file
2. **TypeScript**: Full type safety throughout
3. **Context API**: State management using React Context instead of global variables
4. **Service Layer**: API calls abstracted into service functions
5. **CSS Modules**: Each component has its own CSS file (can be converted to CSS modules later)

### What's Preserved

- ✅ All API endpoints and data structures
- ✅ All business logic
- ✅ All UI/UX behavior
- ✅ Provider authentication flow
- ✅ LocalStorage usage
- ✅ All assets and images

## 🛠️ Development Workflow

1. **Open in separate Cursor window**: This directory is self-contained
2. **Make changes**: Edit components, add features, refactor
3. **Test locally**: Run `npm run dev` and test functionality
4. **Compare with original**: Ensure feature parity
5. **Deploy when ready**: Build and deploy to replace original

## 📚 Component Documentation

### Core Components

- **ProviderLoginScreen**: Handles provider authentication
- **DashboardLayout**: Main layout wrapper
- **Sidebar**: Navigation sidebar with provider logo
- **Header**: Top header with title and actions
- **ViewControls**: Search, filters, and view toggles
- **ListView**: Table view of clients
- **KanbanView**: Kanban board view (TODO)
- **ArchivedView**: Archived clients view

### Context

- **DashboardContext**: Global state management for:
  - Provider info
  - Clients list
  - Current view
  - Search/filter/sort state
  - Loading/error states

### Services

- **api.ts**: All API calls to backend/Vercel routes
- **providerStorage.ts**: LocalStorage utilities for provider info
- **clientMapper.ts**: Maps Airtable records to Client objects

## 🐛 Troubleshooting

### Build Errors

- Ensure all TypeScript types are properly defined
- Check that all imports are correct
- Verify all assets are in the correct location

### Runtime Errors

- Check browser console for API errors
- Verify API endpoints are accessible
- Ensure provider authentication is working

### Missing Features

- Some features from the original are marked as TODO
- Refer to the original `dashboard-unified.js` for reference implementation

## 📄 License

Same as the parent project.

## 🤝 Contributing

This is a refactored version for development purposes. When ready, it can replace the original monolithic version.

---

**Note**: This is a work in progress. Some features from the original dashboard are still being migrated. Refer to the original `dashboard-unified.js` for complete functionality reference.
