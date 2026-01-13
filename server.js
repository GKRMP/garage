const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// CORS - Allow requests from your Shopify store
app.use((req, res, next) => {
  // Replace with your actual store domain in production
  res.header('Access-Control-Allow-Origin', '*'); 
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const shopDomain = process.env.SHOP_DOMAIN;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

app.post('/apps/customer/vehicles/save', async (req, res) => {
  const { customerId, vehicles } = req.body;

  // Validate inputs
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }
  if (!vehicles || !Array.isArray(vehicles)) {
    return res.status(400).json({ error: 'vehicles must be an array' });
  }

  // Ensure customerId is in GID format
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
        namespace: "custom",
        key: "garage",
        type: "list.metaobject_reference",
        value: JSON.stringify(vehicles)  // Array of metaobject GIDs
      }
    ]
  };

  console.log('Saving garage for customer:', customerGid);
  console.log('Vehicles:', vehicles);

  try {
    const response = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));