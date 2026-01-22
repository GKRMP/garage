# Shopify Garage Project

Complete implementation of the Garage feature for Roberts Motor Parts Inc Shopify store.

## Repository Structure

```
Garage/
├── backend/              ← Backend API (deployed to Render.com)
│   ├── server.js         - Express API server
│   ├── package.json      - Dependencies (minimal, API only)
│   ├── .env.example      - Environment variable template
│   └── README.md         - Backend API documentation
│
├── tools/                ← Local utility scripts (NOT in git, NOT deployed)
│   ├── import-vehicles.js  - Vehicle metaobject import script
│   └── package.json      - Dependencies for local tools
│
├── Garage-Theme/         ← Shopify theme (NOT in git, managed via Shopify CLI)
│   └── assets/garage.js  - Frontend garage implementation
│
├── support-files/        ← Local reference files (NOT in git)
│   └── AllVehiclesForGarage-20260122.csv
│
└── README.md            ← This file
```

## Components

### 1. Backend API (Render.com)
- **Deployed to**: https://garage-wl13.onrender.com
- Provides REST API for vehicle management
- Handles customer garage metafield storage
- See `backend/README.md` for full API documentation

### 2. Frontend (Shopify Theme)
- Located in `Garage-Theme/assets/garage.js`
- Managed separately via Shopify CLI
- Integrates with theme header for garage icon
- Modal-based vehicle selection interface

### 3. Vehicle Data
- Stored as Shopify metaobjects (type: "vehicle")
- CSV source: `support-files/AllVehiclesForGarage-20260122.csv`
- 860 vehicles (Cars and Trucks from 1925-present)
- Import script: `tools/import-vehicles.js` (run locally)

## Deployment Workflow

### Backend Changes (Git → Render)
```bash
cd backend/
# Make changes to server.js or scripts
git add .
git commit -m "Description of changes"
git push origin main
# Render auto-deploys from the backend/ folder
```

### Theme Changes (Shopify CLI)
```bash
cd Garage-Theme/
shopify theme dev      # Test locally
shopify theme push     # Deploy to development theme
shopify theme push --theme <theme-id>  # Deploy to production
```

### Vehicle Data Import (Local Only)
```bash
cd tools/
npm install  # First time only
node import-vehicles.js ../support-files/AllVehiclesForGarage-20260122.csv
```

## Git Configuration

The repository is configured to:
- ✅ **Track**: Backend API code only (minimal production code)
- ❌ **Ignore**: Tools, theme, support files, docs, .env files

This ensures:
1. Only backend/ folder is deployed to Render (minimal API server)
2. Tools run locally on your machine, not deployed
3. Theme is managed separately via Shopify CLI
4. No sensitive data or large CSV files in git

## Environment Setup

### Backend Development
```bash
cd backend/
cp .env.example .env
# Edit .env with your credentials
npm install
npm start
```

### Theme Development
```bash
cd Garage-Theme/
shopify theme dev --store=your-dev-store.myshopify.com
```

## Migration: Dev → Production

1. **Backend**: Already deployed to Render (same for dev and prod)
2. **Theme**: Deploy via Shopify CLI to production theme
3. **Vehicle Data**: Use generated GraphQL script or re-run import script with production credentials

See `backend/README.md` for detailed migration instructions.

## Quick Links

- Backend API Docs: `backend/README.md`
- Live API Health: https://garage-wl13.onrender.com/health
- Render Dashboard: https://dashboard.render.com

## Notes

- Backend serves both dev and production stores
- Vehicle metaobjects are shared across environments
- Customer garage data is stored in customer metafields
- Frontend caches vehicle list for 1 hour to reduce API calls
