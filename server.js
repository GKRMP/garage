const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Environment variables
const shopDomain = process.env.SHOP_DOMAIN;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = '2024-01';

// Validate required environment variables
if (!shopDomain || !accessToken) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN');
  process.exit(1);
}

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================
// GET ALL VEHICLES (with pagination)
// ============================================
app.get('/apps/vehicles/list', async (req, res) => {
  console.log('Fetching all vehicles...');
  
  const allVehicles = [];
  let hasNextPage = true;
  let cursor = null;
  let pageCount = 0;
  
  const query = `
    query GetVehicles($cursor: String) {
      metaobjects(type: "vehicle", first: 250, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          handle
          fields {
            key
            value
          }
        }
      }
    }
  `;
  
  try {
    while (hasNextPage && pageCount < 10) { // Safety limit: max 2500 vehicles
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      
      const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({ 
          query, 
          variables: { cursor } 
        })
      });
      
      const data = await response.json();
      
      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        return res.status(400).json({
          error: data.errors[0].message,
          errors: data.errors
        });
      }
      
      const metaobjects = data.data.metaobjects;
      
      // Transform nodes to simpler format
      for (const node of metaobjects.nodes) {
        const vehicle = {
          gid: node.id,
          handle: node.handle
        };
        
        for (const field of node.fields) {
          vehicle[field.key] = field.value;
        }
        
        // Convert year to number
        if (vehicle.year) {
          vehicle.year = parseInt(vehicle.year);
        }
        
        allVehicles.push(vehicle);
      }
      
      hasNextPage = metaobjects.pageInfo.hasNextPage;
      cursor = metaobjects.pageInfo.endCursor;
    }
    
    console.log(`Loaded ${allVehicles.length} vehicles in ${pageCount} pages`);
    
    res.json({
      success: true,
      count: allVehicles.length,
      vehicles: allVehicles
    });
    
  } catch (err) {
    console.error('Error fetching vehicles:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SAVE CUSTOMER GARAGE
// ============================================
app.post('/apps/customer/vehicles/save', async (req, res) => {
  const { customerId, vehicles } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }
  if (!vehicles || !Array.isArray(vehicles)) {
    return res.status(400).json({ error: 'vehicles must be an array' });
  }

  const customerGid = customerId.startsWith('gid://') 
    ? customerId 
    : `gid://shopify/Customer/${customerId}`;

  const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        ownerId: customerGid,
        namespace: 'custom',
        key: 'garage',
        value: JSON.stringify(vehicles)
      }
    ]
  };

  console.log('Saving garage for customer:', customerGid);
  console.log('Vehicles:', vehicles);

  try {
    const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    });

    const data = await response.json();

    console.log('Shopify response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      return res.status(400).json({ error: data.errors[0].message, errors: data.errors });
    }
    
    if (data.data.metafieldsSet.userErrors.length > 0) {
      return res.status(400).json({ 
        error: data.data.metafieldsSet.userErrors[0].message,
        errors: data.data.metafieldsSet.userErrors 
      });
    }

    res.json({ success: true, metafields: data.data.metafieldsSet.metafields });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET CUSTOMER GARAGE
// ============================================
app.get('/apps/customer/vehicles/get', async (req, res) => {
  const { customerId } = req.query;

  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  const customerGid = customerId.startsWith('gid://')
    ? customerId
    : `gid://shopify/Customer/${customerId}`;

  const query = `
    query getCustomerMetafield($ownerId: ID!) {
      customer(id: $ownerId) {
        id
        metafield(namespace: "custom", key: "garage") {
          id
          namespace
          key
          value
        }
      }
    }
  `;

  const variables = {
    ownerId: customerGid
  };

  console.log('Fetching garage for customer:', customerGid);

  try {
    const response = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(400).json({
        error: data.errors[0].message,
        errors: data.errors
      });
    }

    const metafield = data.data.customer?.metafield;
    const vehicles = metafield ? JSON.parse(metafield.value) : [];

    console.log('Retrieved garage:', vehicles);

    res.json({
      success: true,
      vehicles: vehicles,
      count: vehicles.length
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));