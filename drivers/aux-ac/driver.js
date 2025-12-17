'use strict';

const Homey = require('homey');
const { AuxCloudAPI, isSupportedDevice, getDeviceTypeName, logUnknownDevice } = require('../../lib/AuxCloudAPI');

class AuxACDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('AUX AC Driver has been initialized');
  }

  /**
   * onPair is called when a user starts pairing.
   */
  async onPair(session) {
    let email;
    let password;
    let region = 'eu'; // Default region
    let api;
    let devices = [];
    let skippedDevices = []; // Track unsupported devices for user feedback

    // Handle region selection from custom view
    session.setHandler('region_selected', async (data) => {
      this.log('Region selected:', data.region);
      region = data.region;
      return true;
    });

    // Handle login credentials
    session.setHandler('login', async (data) => {
      this.log('Login handler triggered', JSON.stringify(data));
      this.log('Using region:', region);
      try {
        email = data.username;
        password = data.password;

        this.log(`Attempting login for user: ${email} in region: ${region}`);

        // Initialize API with selected region
        api = new AuxCloudAPI(region);
        this.log('API initialized, calling basicLogin...');

        await api.login(email, password);
        this.log('Login successful');

        return true;
      } catch (error) {
        this.error('Login failed:', error);
        this.log('Login failed stack:', error.stack);
        throw new Error(this.homey.__('pair.login.error') + ': ' + error.message);
      }
    });

    // Handle device list
    session.setHandler('list_devices', async () => {
      try {
        if (!api || !api.isLoggedIn()) {
          throw new Error('Not logged in');
        }

        // Get families
        const families = await api.getFamilies();

        devices = [];
        skippedDevices = [];

        // Get devices from all families
        for (const family of families) {
          const familyDevices = await api.getDevices(family.familyid);

          this.log(`Found ${familyDevices.length} devices in family ${family.familyid}`);

          // Filter for supported HVAC devices (AC and Heat Pumps)
          for (const device of familyDevices) {
            this.log(`Checking device: ${device.name || device.friendlyName} (productId: ${device.productId})`);

            // Check if it's a supported HVAC device
            if (isSupportedDevice(device.productId)) {
              const deviceType = getDeviceTypeName(device.productId);
              this.log(`✓ Adding supported device: ${device.name || device.friendlyName} (${deviceType})`);

              devices.push({
                name: device.name || device.friendlyName || `AUX ${deviceType} ${device.endpointId.slice(-6)}`,
                data: {
                  id: device.endpointId,
                  familyid: family.familyid
                },
                store: {
                  email,
                  password,
                  region,
                  productId: device.productId,
                  mac: device.mac,
                  devicetypeFlag: device.devicetypeFlag,
                  cookie: device.cookie,
                  devSession: device.devSession
                }
              });
            } else {
              // Log unknown device for future support
              const unknownInfo = logUnknownDevice(device);
              skippedDevices.push(unknownInfo);
              this.log(`✗ Skipping unsupported device: ${unknownInfo.name}`);
              this.log(`  Product ID: ${unknownInfo.productId}`);
              this.log(`  MAC: ${unknownInfo.mac}`);
              this.log(`  ${unknownInfo.message}`);
            }
          }
        }

        // Log summary
        this.log(`Device discovery complete: ${devices.length} supported, ${skippedDevices.length} unsupported`);
        if (skippedDevices.length > 0) {
          this.log('Unsupported devices found. Please report these product IDs to add support:');
          skippedDevices.forEach(d => this.log(`  - ${d.name}: ${d.productId}`));
        }

        return devices;
      } catch (error) {
        this.error('Failed to list devices:', error);
        throw new Error(this.homey.__('pair.list_devices.error'));
      }
    });
  }

}

module.exports = AuxACDriver;
