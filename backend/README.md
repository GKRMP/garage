# Shopify Garage Function

A backend service for managing customer vehicle garages in a Shopify store. This API allows customers to save and retrieve their vehicles, which will be displayed in a garage icon in the Shopify store header.

## Overview

This project provides the backend API for a Shopify garage feature where:
- A garage icon appears in the far left of the header
- A badge displays the number of vehicles when customers have vehicles saved
- Clicking the icon opens a pop-up to manage garage vehicles
- Customer vehicle data is stored in Shopify customer metafields

## API Endpoints

### 1. Get All Vehicles
```
GET /apps/vehicles/list
```
Retrieves all available vehicles from Shopify metaobjects with pagination support.

**Response:**
```json
{
  "success": true,
  "count": 150,
  "vehicles": [
    {
      "gid": "gid://shopify/Metaobject/123",
      "handle": "2020-ford-f150",
      "year": 2020,
      "make": "Ford",
      "model": "F-150"
    }
  ]
}
```

### 2. Get Customer Garage
```
GET /apps/customer/vehicles/get?customerId={id}
```
Retrieves a customer's saved vehicles from their garage.

**Query Parameters:**
- `customerId` - Customer ID (numeric or GID format)

**Response:**
```json
{
  "success": true,
  "vehicles": ["gid://shopify/Metaobject/123"],
  "count": 1
}
```

### 3. Save Customer Garage
```
POST /apps/customer/vehicles/save
```
Saves vehicles to a customer's garage.

**Request Body:**
```json
{
  "customerId": "123456789",
  "vehicles": ["gid://shopify/Metaobject/123", "gid://shopify/Metaobject/456"]
}
```

**Response:**
```json
{
  "success": true,
  "metafields": [
    {
      "id": "gid://shopify/Metafield/789",
      "namespace": "custom",
      "key": "garage",
      "value": "[\"gid://shopify/Metaobject/123\"]"
    }
  ]
}
```

### 4. Health Check
```
GET /health
```
Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-21T12:00:00.000Z"
}
```

## Environment Variables

Create a `.env` file with the following variables:

```env
SHOP_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_admin_api_access_token
PORT=3000
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see above)

3. Start the server:
```bash
npm start
```

## Vehicle Data Import

To import vehicle data from CSV into Shopify metaobjects, use the local tools (not deployed to Render):

1. Navigate to the tools folder:
```bash
cd ../tools
npm install  # First time only
```

2. Prepare your CSV file with columns: `Type`, `Year`, `Make`, `Model`, `Style`, `ID`

3. Run the import script:
```bash
node import-vehicles.js ../support-files/AllVehiclesForGarage-20260122.csv
```

The script will:
- Create the vehicle metaobject definition (if needed)
- Import all vehicles in batches of 25
- Generate a `export-for-production.graphql` file for manual production import

### CSV Format Example
```csv
Type,Year,Make,Model,Style,ID
Car,2020,Ford,Mustang,GT Coupe,1000001
Truck,2021,Ford,F-150,XLT,1000002
```

### Migration to Production

After testing the import on your dev store:

1. Use the generated `tools/export-for-production.graphql` file
2. Open Shopify GraphiQL for your production store
3. Run the `CreateVehicleDefinition` mutation first (once)
4. Run each batch mutation sequentially
5. Verify the import with a query

Or simply run the import script on production:
```bash
# Set production env vars
cd tools
SHOP_DOMAIN=your-prod-store.myshopify.com node import-vehicles.js ../support-files/vehicles.csv
```

**Note**: The import script runs on your local machine, not on Render. It uses the Shopify Admin API to create metaobjects.

## Frontend Integration

The frontend implementation should:

1. **Header Icon**: Add a garage icon to the far left of the Shopify theme header
2. **Badge Display**: Show a circular badge with vehicle count when count > 0
3. **Pop-up Modal**: Create a modal that opens when clicking the garage icon
4. **Vehicle Management**: Allow customers to add/remove vehicles in the modal
5. **API Calls**: Use the endpoints above to fetch and save garage data

### Suggested Implementation Steps

1. Modify theme header liquid file (e.g., `sections/header.liquid`)
2. Add garage icon HTML/CSS in the header
3. Create a modal component for vehicle selection
4. Add JavaScript to:
   - Fetch customer ID from Shopify customer object
   - Call `/apps/customer/vehicles/get` on page load
   - Display badge with vehicle count
   - Load available vehicles from `/apps/vehicles/list`
   - Save selections via `/apps/customer/vehicles/save`

## Deployment

This project includes a `Procfile` for Heroku deployment:

```bash
git push heroku main
```

Set environment variables in your hosting platform:
```bash
heroku config:set SHOP_DOMAIN=your-store.myshopify.com
heroku config:set SHOPIFY_ACCESS_TOKEN=your_token
```

## Technical Details

- **Framework**: Express.js
- **API**: Shopify Admin GraphQL API (2026-01)
- **Storage**: Customer metafields (namespace: `custom`, key: `garage`)
- **Vehicle Data**: Stored as metaobjects with type `vehicle`
- **Pagination**: Supports up to 2,500 vehicles (10 pages × 250 per page)

## CORS

The API is configured to accept requests from any origin. For production, consider restricting this to your Shopify store domain:

```javascript
res.header('Access-Control-Allow-Origin', 'https://your-store.myshopify.com');
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "errors": [/* detailed errors */]
}
```

HTTP status codes:
- `200` - Success
- `400` - Bad request (validation error or GraphQL error)
- `500` - Server error
