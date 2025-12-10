#!/usr/bin/env node
'use strict';

/**
 * Test script for AUX Cloud API
 * Run with: node test-api.js <email> <password>
 */

const { AuxCloudAPI, AC_MODE } = require('./lib/AuxCloudAPI');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const region = process.argv[4] || 'eu';

  if (!email || !password) {
    console.log('Usage: node test-api.js <email> <password> [region]');
    console.log('Regions: eu (default), usa, china');
    process.exit(1);
  }

  console.log(`\n🔐 Logging in to AUX Cloud (${region})...`);
  
  const api = new AuxCloudAPI(region);
  
  try {
    await api.login(email, password);
    console.log('✅ Login successful!');
    console.log(`   User ID: ${api.userid}`);
    console.log(`   Session: ${api.loginsession?.slice(0, 20)}...`);
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    process.exit(1);
  }

  console.log('\n📁 Fetching families (homes)...');
  try {
    const families = await api.getFamilies();
    console.log(`✅ Found ${families.length} family/families`);
    
    for (const family of families) {
      console.log(`\n   🏠 Family: ${family.familyname || family.familyid}`);
      console.log(`      ID: ${family.familyid}`);
      
      console.log('\n   📱 Fetching devices...');
      const devices = await api.getDevices(family.familyid);
      console.log(`   ✅ Found ${devices.length} device(s)`);
      
      for (const device of devices) {
        console.log(`\n      🌡️  Device: ${device.name || device.endpointId}`);
        console.log(`         ID: ${device.endpointId}`);
        console.log(`         Product ID: ${device.productId}`);
        console.log(`         MAC: ${device.mac}`);
        console.log(`         State: ${device.state === 1 ? '🟢 Online' : '🔴 Offline'}`);
        
        if (device.params && Object.keys(device.params).length > 0) {
          console.log('         Parameters:');
          console.log(`            Power: ${device.params.pwr === 1 ? 'ON' : 'OFF'}`);
          if (device.params.temp !== undefined) {
            console.log(`            Target Temp: ${device.params.temp / 10}°C`);
          }
          if (device.params.envtemp !== undefined) {
            console.log(`            Current Temp: ${device.params.envtemp / 10}°C`);
          }
          if (device.params.ac_mode !== undefined) {
            const modes = ['Cooling', 'Heating', 'Dry', 'Fan', 'Auto'];
            console.log(`            Mode: ${modes[device.params.ac_mode] || device.params.ac_mode}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to fetch devices:', error.message);
    process.exit(1);
  }

  console.log('\n✅ API test completed successfully!\n');
}

main().catch(console.error);
