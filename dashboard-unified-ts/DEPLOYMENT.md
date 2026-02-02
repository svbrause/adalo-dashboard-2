# Deployment Guide for Dashboard

This guide will help you deploy the React/TypeScript dashboard to Vercel.

## Prerequisites

- A Vercel account (sign up at [vercel.com](https://vercel.com))
- The project pushed to GitHub (already done: `https://github.com/svbrause/react-dashboard-0.git`)

## Deployment Options

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Click **"Add New..."** → **"Project"**

2. **Import Your Repository**
   - Select **"Import Git Repository"**
   - Choose `svbrause/react-dashboard-0` from the list
   - Click **"Import"**

3. **Configure Project Settings**
   - **Framework Preset**: Vite (should auto-detect)
   - **Root Directory**: `dashboard-unified-ts` (important!)
   - **Build Command**: `npm run build` (should auto-detect)
   - **Output Directory**: `dist` (should auto-detect)
   - **Install Command**: `npm install` (should auto-detect)

4. **Deploy**
   - No environment variables needed!
   - The app uses hardcoded defaults that point to the secure backend
   - All API calls go through `https://ponce-patient-backend.vercel.app`
   - **NO API KEYS** are needed or should be added

5. **Deploy**
   - Click **"Deploy"**
   - Wait for the build to complete (usually 1-2 minutes)
   - Your dashboard will be live at `https://your-project-name.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Navigate to Project Directory**
   ```bash
   cd dashboard-unified-ts
   ```

3. **Login to Vercel**
   ```bash
   vercel login
   ```

4. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Link to existing project? **No** (for first deployment)
   - Project name: Enter a name or press Enter for default
   - Directory: `./dashboard-unified-ts` (if not already in that directory)
   - Override settings? **No**

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```
   
   No environment variables needed - the app uses hardcoded defaults!

## Configuration

**No environment variables needed!** The app uses hardcoded defaults:

- **Backend API**: `https://ponce-patient-backend.vercel.app` (hardcoded)
- **Use Backend API**: `true` (always enabled)

**⚠️ CRITICAL**: 
- **NO API KEYS** are needed or should be added
- **NO Airtable Base ID** is needed - the backend handles it
- All API calls go through the secure backend proxy
- API keys and Airtable configuration are stored securely on the backend server only
- This frontend project never sees or handles any Airtable configuration
- No sensitive information is exposed in the client-side code

## Post-Deployment

### 1. Verify Deployment
- Visit your Vercel deployment URL
- Test provider login
- Test viewing clients/leads
- Test all major features

### 2. Custom Domain (Optional)
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 3. Automatic Deployments
- Every push to `main` branch will automatically deploy
- Preview deployments are created for pull requests

## Troubleshooting

### Build Fails
- Check that `Root Directory` is set to `dashboard-unified-ts`
- Verify `package.json` exists in the root directory
- Check build logs in Vercel dashboard

### API Calls Fail
- Verify `VITE_USE_BACKEND_API=true` is set
- Check that `VITE_BACKEND_API_URL` points to the correct backend
- Verify the backend is deployed and accessible

### API Calls Not Working
- Verify the backend API is accessible: `https://ponce-patient-backend.vercel.app`
- Check browser console for CORS or network errors
- Ensure the backend is deployed and running
- **Remember**: No API keys are needed - the backend handles all authentication

## Project Structure

```
dashboard-unified-ts/
├── src/              # Source code
├── dist/             # Build output (created by `npm run build`)
├── package.json      # Dependencies
├── vite.config.ts    # Vite configuration
├── vercel.json       # Vercel configuration
└── index.html        # Entry HTML file
```

## Support

If you encounter issues:
1. Check Vercel build logs in the dashboard
2. Check browser console for client-side errors
3. Verify backend API is accessible
4. Review environment variables are set correctly
