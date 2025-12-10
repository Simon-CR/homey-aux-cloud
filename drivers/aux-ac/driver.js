'use strict';

const Homey = require('homey');
const { AuxCloudAPI } = require('../../lib/AuxCloudAPI');

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
    let email = '';
    let password = '';
    let region = 'eu'; // Default to EU region
    let api = null;
    let devices = [];

    // Handle login credentials
    session.setHandler('login', async (data) => {
      try {
        email = data.username;
        password = data.password;
        
        // Try to login with EU region first
        api = new AuxCloudAPI(region);
        await api.login(email, password);
        
        return true;
      } catch (error) {
        this.error('Login failed:', error);
        throw new Error(this.homey.__('pair.login.error'));
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
        
        // Get devices from all families
        for (const family of families) {
          const familyDevices = await api.getDevices(family.familyid);
          
          // Filter for AC devices and format for Homey
          for (const device of familyDevices) {
            // Check if it's an AC device
            const isAC = this._isACDevice(device.productId);
            
            if (isAC) {
              devices.push({
                name: device.name || `AUX AC ${device.endpointId.slice(-6)}`,
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
            }
          }
        }

        return devices;
      } catch (error) {
        this.error('Failed to list devices:', error);
        throw new Error(this.homey.__('pair.list_devices.error'));
      }
    });
  }

  /**
   * Check if device is an AC unit
   */
  _isACDevice(productId) {
    const AC_PRODUCT_IDS = [
      '000000000000000000000000c0620000',
      '0000000000000000000000002a4e0000'
    ];
    return AC_PRODUCT_IDS.includes(productId);
  }

}

module.exports = AuxACDriver;
