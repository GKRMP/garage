const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const shopDomain = process.env.SHOP_DOMAIN;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

app.post('/apps/customer/vehicles/save', async (req, res) => {
  const { customerId, vehicles } = req.body;

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
        ownerId: customerId,
        namespace: "custom",
        key: "vehicles",
        type: "list.single_line_text_field",
        value: JSON.stringify(vehicles)
      }
    ]
  };

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

    if (data.errors || (data.data.metafieldsSet.userErrors.length > 0)) {
      return res.status(400).json({ errors: data.errors || data.data.metafieldsSet.userErrors });
    }

    res.json({ success: true, metafields: data.data.metafieldsSet.metafields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Proxy running on port 3000'));