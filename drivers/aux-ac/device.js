'use strict';

const Homey = require('homey');
const { AuxCloudAPI, AC_MODE } = require('../../lib/AuxCloudAPI');

// Map Homey thermostat modes to AUX AC modes
const HOMEY_MODE_TO_AUX = {
  'auto': AC_MODE.AUTO,
  'cool': AC_MODE.COOLING,
  'heat': AC_MODE.HEATING,
  'dry': AC_MODE.DRY,
  'fan_only': AC_MODE.FAN
};

const AUX_MODE_TO_HOMEY = {
  [AC_MODE.AUTO]: 'auto',
  [AC_MODE.COOLING]: 'cool',
  [AC_MODE.HEATING]: 'heat',
  [AC_MODE.DRY]: 'dry',
  [AC_MODE.FAN]: 'fan_only'
};

class AuxACDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('AUX AC device has been initialized');

    // Get stored settings
    const store = this.getStore();
    const data = this.getData();
    
    this.deviceId = data.id;
    this.familyid = data.familyid;
    
    // Initialize API
    this.api = new AuxCloudAPI(store.region || 'eu');
    
    try {
      await this.api.login(store.email, store.password);
    } catch (error) {
      this.error('Failed to login:', error);
      this.setUnavailable('Failed to connect to AUX Cloud').catch(this.error);
      return;
    }

    // Store device info
    this.deviceInfo = {
      endpointId: this.deviceId,
      productId: store.productId,
      mac: store.mac,
      devicetypeFlag: store.devicetypeFlag,
      cookie: store.cookie,
      devSession: store.devSession
    };

    // Register capability listeners
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('thermostat_mode', this.onCapabilityThermostatMode.bind(this));

    // Set available thermostat modes
    await this.setCapabilityOptions('thermostat_mode', {
      values: ['auto', 'cool', 'heat', 'dry', 'fan_only']
    }).catch(this.error);

    // Start polling for state updates
    this.pollInterval = setInterval(() => {
      this.syncDeviceState().catch(this.error);
    }, 30000); // Poll every 30 seconds

    // Initial state sync
    await this.syncDeviceState();
  }

  /**
   * onAdded is called when the user adds the device.
   */
  async onAdded() {
    this.log('AUX AC device has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('AUX AC device settings were changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   */
  async onRenamed(name) {
    this.log('AUX AC device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('AUX AC device has been deleted');
    
    // Clear polling interval
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  /**
   * Sync device state from cloud
   */
  async syncDeviceState() {
    try {
      // Get fresh device list to update sessions
      const families = await this.api.getFamilies();
      let foundDevice = null;
      
      for (const family of families) {
        if (family.familyid === this.familyid) {
          const devices = await this.api.getDevices(family.familyid);
          foundDevice = devices.find(d => d.endpointId === this.deviceId);
          if (foundDevice) break;
        }
      }

      if (!foundDevice) {
        this.setUnavailable('Device not found in AUX Cloud').catch(this.error);
        return;
      }

      // Update device info with fresh session
      this.deviceInfo.devSession = foundDevice.devSession;
      
      // Check if device is online
      if (foundDevice.state !== 1) {
        this.setUnavailable('Device is offline').catch(this.error);
        return;
      }

      this.setAvailable().catch(this.error);

      const params = foundDevice.params || {};

      // Update capabilities
      if (params.pwr !== undefined) {
        const isOn = params.pwr === 1;
        await this.setCapabilityValue('onoff', isOn).catch(this.error);
      }

      if (params.temp !== undefined) {
        // Temperature is stored as temp * 10 (e.g., 240 = 24.0°C)
        const targetTemp = params.temp / 10;
        await this.setCapabilityValue('target_temperature', targetTemp).catch(this.error);
      }

      if (params.envtemp !== undefined) {
        // Environment temperature
        const currentTemp = params.envtemp / 10;
        await this.setCapabilityValue('measure_temperature', currentTemp).catch(this.error);
      }

      if (params.ac_mode !== undefined) {
        const homeyMode = AUX_MODE_TO_HOMEY[params.ac_mode];
        if (homeyMode) {
          await this.setCapabilityValue('thermostat_mode', homeyMode).catch(this.error);
        }
      }

    } catch (error) {
      this.error('Failed to sync device state:', error);
      this.setUnavailable('Failed to sync state').catch(this.error);
    }
  }

  /**
   * Handle onoff capability
   */
  async onCapabilityOnoff(value) {
    this.log('onoff changed to:', value);

    try {
      const params = {
        pwr: value ? 1 : 0
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);
      
      if (!success) {
        throw new Error('Failed to set power state');
      }

      // Wait a bit then sync state
      setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, 2000);

      return value;
    } catch (error) {
      this.error('Failed to set onoff:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Handle target_temperature capability
   */
  async onCapabilityTargetTemperature(value) {
    this.log('target_temperature changed to:', value);

    try {
      // Temperature needs to be sent as value * 10
      const params = {
        temp: Math.round(value * 10)
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);
      
      if (!success) {
        throw new Error('Failed to set temperature');
      }

      // Wait a bit then sync state
      setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, 2000);

      return value;
    } catch (error) {
      this.error('Failed to set target_temperature:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Handle thermostat_mode capability
   */
  async onCapabilityThermostatMode(value) {
    this.log('thermostat_mode changed to:', value);

    try {
      const auxMode = HOMEY_MODE_TO_AUX[value];
      
      if (auxMode === undefined) {
        throw new Error('Invalid mode');
      }

      const params = {
        ac_mode: auxMode
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);
      
      if (!success) {
        throw new Error('Failed to set mode');
      }

      // Wait a bit then sync state
      setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, 2000);

      return value;
    } catch (error) {
      this.error('Failed to set thermostat_mode:', error);
      throw new Error('Failed to control device');
    }
  }

}

module.exports = AuxACDevice;
