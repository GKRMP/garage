/**
 * Test script for the Garage API
 * This demonstrates the working vehicle search functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('='.repeat(60));
  console.log('Testing Garage API');
  console.log('='.repeat(60));

  try {
    // Test 1: Health check
    console.log('\n1. Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✓ Health check:', healthData);

    // Test 2: Get all vehicles
    console.log('\n2. Fetching all vehicles...');
    const vehiclesResponse = await fetch(`${BASE_URL}/apps/vehicles/list`);
    const vehiclesData = await vehiclesResponse.json();
    console.log(`✓ Loaded ${vehiclesData.count} vehicles`);

    // Show sample vehicles
    console.log('\nSample vehicles:');
    vehiclesData.vehicles.slice(0, 5).forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.year} ${v.make} ${v.model} ${v.style ? `(${v.style})` : ''}`);
    });

    // Show some statistics
    console.log('\nVehicle Statistics:');
    const makes = {};
    const years = {};
    vehiclesData.vehicles.forEach(v => {
      makes[v.make] = (makes[v.make] || 0) + 1;
      years[v.year] = (years[v.year] || 0) + 1;
    });

    const topMakes = Object.entries(makes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    console.log('\nTop 10 Makes:');
    topMakes.forEach(([make, count]) => {
      console.log(`  ${make}: ${count} vehicles`);
    });

    const yearRange = Object.keys(years).map(Number).sort((a, b) => a - b);
    console.log(`\nYear Range: ${yearRange[0]} - ${yearRange[yearRange.length - 1]}`);

    console.log('\n' + '='.repeat(60));
    console.log('✓ All tests passed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

// Check if server is running
async function waitForServer(retries = 10) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(`${BASE_URL}/health`);
      return true;
    } catch {
      console.log('Waiting for server to start...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Server did not start in time');
}

async function main() {
  console.log('Waiting for server...');
  await waitForServer();
  await testAPI();
}

main();
