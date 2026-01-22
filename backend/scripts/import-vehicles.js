/**
 * Vehicle Metaobject Bulk Import Script
 *
 * This script imports vehicles from CSV into Shopify metaobjects.
 *
 * Usage:
 *   node scripts/import-vehicles.js path/to/vehicles.csv
 *
 * Environment Variables Required:
 *   SHOP_DOMAIN - Your Shopify store domain (e.g., your-store.myshopify.com)
 *   SHOPIFY_ACCESS_TOKEN - Admin API access token
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Load environment variables
require('dotenv').config();

const SHOP_DOMAIN = process.env.SHOP_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = '2024-01';
const BATCH_SIZE = 25; // Shopify allows max 25 mutations per request

// Validate environment
if (!SHOP_DOMAIN || !ACCESS_TOKEN) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN');
  process.exit(1);
}

// Get CSV file path from command line
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('ERROR: Please provide CSV file path');
  console.error('Usage: node import-vehicles.js path/to/vehicles.csv');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`ERROR: File not found: ${csvPath}`);
  process.exit(1);
}

/**
 * Parse CSV file into vehicle objects
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '')); // Remove BOM
  console.log('CSV Headers:', header);

  // Parse rows
  const vehicles = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    if (values.length < header.length) {
      console.warn(`Warning: Row ${i + 1} has fewer columns than header, skipping`);
      continue;
    }

    const vehicle = {};
    header.forEach((key, index) => {
      vehicle[key.toLowerCase()] = values[index] ? values[index].trim() : '';
    });

    // Validate required fields
    if (vehicle.type && vehicle.year && vehicle.make && vehicle.model && vehicle.id) {
      vehicles.push(vehicle);
    } else {
      console.warn(`Warning: Row ${i + 1} missing required fields, skipping`);
    }
  }

  return vehicles;
}

/**
 * Parse a CSV line handling quoted values with commas
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

/**
 * Create a metaobject definition for vehicles (one-time setup)
 */
async function createMetaobjectDefinition() {
  const mutation = `
    mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          id
          name
          type
          fieldDefinitions {
            key
            name
            type {
              name
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    definition: {
      name: "Vehicle",
      type: "vehicle",
      fieldDefinitions: [
        {
          key: "type",
          name: "Vehicle Type",
          type: "single_line_text_field",
          required: true,
          validations: [
            {
              name: "choices",
              value: JSON.stringify(["Car", "Truck"])
            }
          ]
        },
        {
          key: "year",
          name: "Year",
          type: "number_integer",
          required: true
        },
        {
          key: "make",
          name: "Make",
          type: "single_line_text_field",
          required: true
        },
        {
          key: "model",
          name: "Model",
          type: "single_line_text_field",
          required: true
        },
        {
          key: "style",
          name: "Style",
          type: "single_line_text_field",
          required: false
        },
        {
          key: "vehicle_id",
          name: "Vehicle ID",
          type: "single_line_text_field",
          required: true
        }
      ],
      access: {
        storefront: "PUBLIC_READ"
      }
    }
  };

  console.log('\nCreating metaobject definition...');

  const response = await shopifyGraphQL(mutation, variables);

  if (response.data.metaobjectDefinitionCreate.userErrors.length > 0) {
    const errors = response.data.metaobjectDefinitionCreate.userErrors;

    // Check if definition already exists
    if (errors.some(e => e.message.includes('already exists') || e.message.includes('taken'))) {
      console.log('✓ Metaobject definition already exists, continuing...');
      return true;
    }

    console.error('Error creating definition:', errors);
    return false;
  }

  console.log('✓ Metaobject definition created successfully');
  return true;
}

/**
 * Make a GraphQL request to Shopify
 */
async function shopifyGraphQL(query, variables = {}) {
  const response = await fetch(
    `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN
      },
      body: JSON.stringify({ query, variables })
    }
  );

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

/**
 * Create a single vehicle metaobject
 */
function createVehicleMutation(vehicle, index) {
  // Create a unique handle from vehicle data
  const handle = `${vehicle.type.toLowerCase()}-${vehicle.year}-${vehicle.make.toLowerCase().replace(/\s+/g, '-')}-${vehicle.model.toLowerCase().replace(/\s+/g, '-')}-${vehicle.id}`;

  return {
    handle: handle,
    fields: [
      { key: "type", value: vehicle.type },
      { key: "year", value: vehicle.year },
      { key: "make", value: vehicle.make },
      { key: "model", value: vehicle.model },
      { key: "style", value: vehicle.style || "" },
      { key: "vehicle_id", value: vehicle.id }
    ]
  };
}

/**
 * Import vehicles in batches
 */
async function importVehicles(vehicles) {
  console.log(`\nImporting ${vehicles.length} vehicles in batches of ${BATCH_SIZE}...`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  // Process in batches
  for (let i = 0; i < vehicles.length; i += BATCH_SIZE) {
    const batch = vehicles.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(vehicles.length / BATCH_SIZE);

    console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} vehicles)...`);

    // Build mutation for batch
    const metaobjects = batch.map((vehicle, index) => createVehicleMutation(vehicle, i + index));

    const mutation = `
      mutation CreateMetaobjects($metaobjects: [MetaobjectCreateInput!]!) {
        metaobjectsCreate: metaobjectBulkCreate(
          metaobjects: $metaobjects
        ) {
          metaobjects {
            id
            handle
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const variables = {
      metaobjects: metaobjects.map(mo => ({
        type: "vehicle",
        handle: mo.handle,
        fields: mo.fields
      }))
    };

    try {
      const response = await shopifyGraphQL(mutation, variables);
      const result = response.data.metaobjectsCreate;

      if (result.userErrors && result.userErrors.length > 0) {
        console.error(`  ✗ Batch ${batchNumber} errors:`, result.userErrors);
        errorCount += batch.length;
        errors.push(...result.userErrors);
      } else {
        successCount += batch.length;
        console.log(`  ✓ Batch ${batchNumber} completed: ${batch.length} vehicles created`);
      }

      // Rate limiting: wait 500ms between batches
      if (i + BATCH_SIZE < vehicles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error(`  ✗ Batch ${batchNumber} failed:`, error.message);
      errorCount += batch.length;
      errors.push({ message: error.message, batch: batchNumber });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total vehicles: ${vehicles.length}`);
  console.log(`✓ Successfully imported: ${successCount}`);
  console.log(`✗ Failed: ${errorCount}`);

  if (errors.length > 0) {
    console.log('\nErrors encountered:');
    errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.message} ${err.field ? `(${err.field})` : ''}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }
}

/**
 * Generate GraphQL export script for production
 */
function generateExportScript(vehicles) {
  const outputPath = path.join(__dirname, 'export-for-production.graphql');

  let script = `# Vehicle Metaobjects Export for Production
# Generated: ${new Date().toISOString()}
# Total Vehicles: ${vehicles.length}
#
# To import into production:
# 1. Copy this entire file
# 2. Use Shopify GraphiQL or your preferred GraphQL client
# 3. Run the createMetaobjectDefinition mutation first (once)
# 4. Then run the metaobjectBulkCreate mutations in batches

# STEP 1: Create the metaobject definition (run once)
mutation CreateVehicleDefinition {
  metaobjectDefinitionCreate(definition: {
    name: "Vehicle"
    type: "vehicle"
    fieldDefinitions: [
      { key: "type", name: "Vehicle Type", type: "single_line_text_field", required: true }
      { key: "year", name: "Year", type: "number_integer", required: true }
      { key: "make", name: "Make", type: "single_line_text_field", required: true }
      { key: "model", name: "Model", type: "single_line_text_field", required: true }
      { key: "style", name: "Style", type: "single_line_text_field", required: false }
      { key: "vehicle_id", name: "Vehicle ID", type: "single_line_text_field", required: true }
    ]
    access: { storefront: "PUBLIC_READ" }
  }) {
    metaobjectDefinition { id name type }
    userErrors { field message }
  }
}

`;

  // Generate batches
  for (let i = 0; i < vehicles.length; i += BATCH_SIZE) {
    const batch = vehicles.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    script += `\n# BATCH ${batchNumber} (Vehicles ${i + 1}-${i + batch.length})\n`;
    script += `mutation CreateVehiclesBatch${batchNumber} {\n`;
    script += `  metaobjectBulkCreate(\n`;
    script += `    metaobjects: [\n`;

    batch.forEach((vehicle, index) => {
      const mo = createVehicleMutation(vehicle, i + index);
      script += `      {\n`;
      script += `        type: "vehicle"\n`;
      script += `        handle: "${mo.handle}"\n`;
      script += `        fields: [\n`;
      mo.fields.forEach(field => {
        script += `          { key: "${field.key}", value: "${field.value}" }\n`;
      });
      script += `        ]\n`;
      script += `      }${index < batch.length - 1 ? ',' : ''}\n`;
    });

    script += `    ]\n`;
    script += `  ) {\n`;
    script += `    metaobjects { id handle }\n`;
    script += `    userErrors { field message }\n`;
    script += `  }\n`;
    script += `}\n`;
  }

  fs.writeFileSync(outputPath, script);
  console.log(`\n✓ GraphQL export script saved to: ${outputPath}`);
  console.log('  Use this file to manually import to production via GraphiQL');
}

/**
 * Main execution
 */
async function main() {
  console.log('Vehicle Import Script');
  console.log('='.repeat(60));
  console.log(`Shop: ${SHOP_DOMAIN}`);
  console.log(`CSV File: ${csvPath}`);

  // Parse CSV
  console.log('\nParsing CSV file...');
  const vehicles = parseCSV(csvPath);
  console.log(`✓ Parsed ${vehicles.length} vehicles`);

  // Show sample
  if (vehicles.length > 0) {
    console.log('\nSample vehicle:');
    console.log(JSON.stringify(vehicles[0], null, 2));
  }

  // Confirm
  console.log('\nReady to import. This will:');
  console.log('  1. Create/verify the vehicle metaobject definition');
  console.log(`  2. Import ${vehicles.length} vehicles in ${Math.ceil(vehicles.length / BATCH_SIZE)} batches`);
  console.log('  3. Generate a GraphQL export script for production');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Create definition
  const definitionCreated = await createMetaobjectDefinition();
  if (!definitionCreated) {
    console.error('Failed to create metaobject definition. Exiting.');
    process.exit(1);
  }

  // Import vehicles
  await importVehicles(vehicles);

  // Generate export script
  generateExportScript(vehicles);

  console.log('\n✓ Import complete!');
}

// Run
main().catch(error => {
  console.error('\nFATAL ERROR:', error);
  process.exit(1);
});
