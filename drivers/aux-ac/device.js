'use strict';

const Homey = require('homey');
const { AuxCloudAPI, AC_MODE, FAN_SPEED, AC_PARAMS } = require('../../lib/AuxCloudAPI');

// Delay before syncing state after a command (in ms)
// Set to 5 seconds to allow device to process command before polling
// This prevents the "value reverting" issue (maeek/ha-aux-cloud #53)
const SYNC_DELAY_MS = 5000;

// Energy data polling interval (5 minutes - less frequent than state polling)
const ENERGY_POLL_INTERVAL_MS = 5 * 60 * 1000;

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

// Map Homey fan speed to AUX fan speed
const HOMEY_FAN_TO_AUX = {
  'auto': FAN_SPEED.AUTO,
  'low': FAN_SPEED.LOW,
  'mid': FAN_SPEED.MID,
  'high': FAN_SPEED.HIGH,
  'turbo': FAN_SPEED.TURBO,
  'mute': FAN_SPEED.MUTE,
  'mid_lower': FAN_SPEED.MID_LOWER,
  'mid_higher': FAN_SPEED.MID_HIGHER
};

const AUX_FAN_TO_HOMEY = {
  [FAN_SPEED.AUTO]: 'auto',
  [FAN_SPEED.LOW]: 'low',
  [FAN_SPEED.MID]: 'mid',
  [FAN_SPEED.HIGH]: 'high',
  [FAN_SPEED.TURBO]: 'turbo',
  [FAN_SPEED.MUTE]: 'mute',
  [FAN_SPEED.MID_LOWER]: 'mid_lower',
  [FAN_SPEED.MID_HIGHER]: 'mid_higher'
};

// Map Homey swing values to AUX values (0=off, 1=swing, 2-6=positions)
const HOMEY_SWING_TO_AUX = {
  'off': 0,
  'on': 1,
  'pos1': 2,
  'pos2': 3,
  'pos3': 4,
  'pos4': 5,
  'pos5': 6
};

const AUX_SWING_TO_HOMEY = {
  0: 'off',
  1: 'on',
  2: 'pos1',
  3: 'pos2',
  4: 'pos3',
  5: 'pos4',
  6: 'pos5'
};

// Map API parameters to Homey capabilities for dynamic detection
const PARAM_TO_CAPABILITY = {
  'ac_vdir': 'airco_vertical',
  'ac_hdir': 'airco_horizontal',
  'ecomode': 'eco_mode',
  'ac_health': 'health_mode',
  'ac_slp': 'sleep_mode',
  'scrdisp': 'display_light',
  'ac_clean': 'self_cleaning',
  'childlock': 'child_lock',
  'mldprf': 'mildew_proof',
  'comfwind': 'comfortable_wind',
  'ac_astheat': 'auxiliary_heat',
  'pwrlimit': 'power_limit',
  'pwrlimitswitch': 'power_limit_enabled',
  'tempunit': 'temperature_unit',
  'err_flag': 'error_status'
};

// Core capabilities that all AC devices should have
const CORE_CAPABILITIES = [
  'onoff',
  'target_temperature',
  'measure_temperature',
  'thermostat_mode',
  'fan_speed'
];

class AuxACDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('🚀 === DEVICE INIT STARTED ===');
    const data = this.getData();
    const store = this.getStore();

    this.deviceId = data.id;
    this.familyid = data.familyid;

    // Track which optional capabilities this device supports
    this.supportedParams = new Set();

    // Track swing position support (detected on first add)
    // Some units only support on/off swing, others support fixed positions (2-6)
    this.supportsVerticalPositions = store.supportsVerticalPositions || false;
    this.supportsHorizontalPositions = store.supportsHorizontalPositions || false;

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

    // Register core capability listeners (always present)
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('thermostat_mode', this.onCapabilityThermostatMode.bind(this));

    // Register optional capability listeners only if they exist
    this._registerOptionalCapabilityListener('fan_speed', this.onCapabilityFanSpeed.bind(this));
    this._registerOptionalCapabilityListener('airco_vertical', this.onCapabilitySwingVertical.bind(this));
    this._registerOptionalCapabilityListener('airco_horizontal', this.onCapabilitySwingHorizontal.bind(this));
    this._registerOptionalCapabilityListener('eco_mode', this.onCapabilityEcoMode.bind(this));
    this._registerOptionalCapabilityListener('health_mode', this.onCapabilityHealthMode.bind(this));
    this._registerOptionalCapabilityListener('sleep_mode', this.onCapabilitySleepMode.bind(this));
    this._registerOptionalCapabilityListener('display_light', this.onCapabilityDisplayLight.bind(this));
    this._registerOptionalCapabilityListener('self_cleaning', this.onCapabilitySelfCleaning.bind(this));
    this._registerOptionalCapabilityListener('child_lock', this.onCapabilityChildLock.bind(this));
    this._registerOptionalCapabilityListener('mildew_proof', this.onCapabilityMildewProof.bind(this));
    this._registerOptionalCapabilityListener('comfortable_wind', this.onCapabilityComfortableWind.bind(this));
    this._registerOptionalCapabilityListener('auxiliary_heat', this.onCapabilityAuxiliaryHeat.bind(this));
    this._registerOptionalCapabilityListener('power_limit', this.onCapabilityPowerLimit.bind(this));
    this._registerOptionalCapabilityListener('power_limit_enabled', this.onCapabilityPowerLimitEnabled.bind(this));
    this._registerOptionalCapabilityListener('temperature_unit', this.onCapabilityTemperatureUnit.bind(this));
    // Note: error_status is read-only, no listener needed

    // Set available thermostat modes with proper object format (including OFF)
    await this.setCapabilityOptions('thermostat_mode', {
      values: [
        { id: 'off', title: { en: 'Off' } },
        { id: 'auto', title: { en: 'Auto' } },
        { id: 'cool', title: { en: 'Cool' } },
        { id: 'heat', title: { en: 'Heat' } },
        { id: 'dry', title: { en: 'Dry' } },
        { id: 'fan_only', title: { en: 'Fan Only' } }
      ]
    }).catch(this.error);

    // Start polling for state updates
    // Use this.homey.setInterval for automatic cleanup on Homey Cloud
    this.pollInterval = this.homey.setInterval(() => {
      this.syncDeviceState().catch(this.error);
    }, 30000); // Poll every 30 seconds

    // Start polling for energy data (less frequent)
    this.energyPollInterval = this.homey.setInterval(() => {
      this.syncDeviceState().catch(this.error);
    }, ENERGY_POLL_INTERVAL_MS); // Poll every 5 minutes

    // Initial state sync - this will detect capabilities and validate all values
    await this.syncDeviceState();

    // Initial energy sync
    await this.syncEnergyData();

    // Update device settings with device info (MAC address, etc.)
    await this._updateDeviceInfo();

    // Apply swing capability options based on stored detection results
    await this._updateSwingCapabilityOptions();

    this.log('✅ === DEVICE INIT COMPLETED SUCCESSFULLY ===');
  }

  /**
   * Update device settings with device information (MAC, product ID, etc.)
   */
  async _updateDeviceInfo() {
    try {
      const store = this.getStore();
      const data = this.getData();

      // Format MAC address with colons if not already formatted
      let macAddress = store.mac || '-';
      if (macAddress && macAddress.length === 12 && !macAddress.includes(':')) {
        macAddress = macAddress.match(/.{1,2}/g).join(':').toUpperCase();
      }

      // Map region code to friendly name
      const regionNames = {
        'eu': 'Europe',
        'usa': 'USA',
        'cn': 'China'
      };
      const regionDisplay = regionNames[store.region] || store.region || '-';

      // Format swing position support display
      const verticalSupport = store.supportsVerticalPositions === true ? 'Supported' :
        store.supportsVerticalPositions === false ? 'Not Supported' : 'Unknown';
      const horizontalSupport = store.supportsHorizontalPositions === true ? 'Supported' :
        store.supportsHorizontalPositions === false ? 'Not Supported' : 'Unknown';

      await this.setSettings({
        mac_address: macAddress,
        product_id: store.productId || '-',
        endpoint_id: data.id || '-',
        region: regionDisplay,
        supports_vertical_positions: verticalSupport,
        supports_horizontal_positions: horizontalSupport
      });

      this.log(`Device info updated: MAC=${macAddress}, ProductID=${store.productId}`);
    } catch (error) {
      this.error('Failed to update device info settings:', error);
    }
  }

  /**
   * Register a capability listener only if the capability exists on the device
   */
  _registerOptionalCapabilityListener(capability, handler) {
    if (this.hasCapability(capability)) {
      this.registerCapabilityListener(capability, handler);
    }
  }

  /**
   * onAdded is called when the user adds the device.
   * Detects device-specific feature support.
   */
  async onAdded() {
    this.log('AUX AC device has been added');

    // Detect swing position support
    await this._detectSwingPositionSupport();
  }

  /**
   * Detect if the device supports fixed swing positions (2-6) or only on/off (0/1).
   * Some AC units support setting specific vane positions, while others only support
   * continuous swing mode. This detection tests by:
   * 1. If current value is already 2-6, positions are supported
   * 2. Otherwise, try setting position 2, check if it sticks, then restore original value
   */
  async _detectSwingPositionSupport() {
    try {
      this.log('Detecting swing position support...');

      // Get current swing values (use empty array to get all params since specific queries may not work)
      const params = await this.api.getDeviceParams(this.deviceInfo, []);
      const originalVdir = params.ac_vdir;
      const originalHdir = params.ac_hdir;

      this.log(`Current swing values: vertical=${originalVdir}, horizontal=${originalHdir}`);

      // Check vertical swing position support
      let supportsVertical = false;
      if (originalVdir >= 2 && originalVdir <= 6) {
        // Already at a position, so positions are supported
        supportsVertical = true;
        this.log('Vertical positions supported (current value is a position)');
      } else if (originalVdir !== undefined) {
        // Try setting to position 2 and see if it sticks
        await this.api.setDeviceParams(this.deviceInfo, { ac_vdir: 2 });
        await new Promise(r => this.homey.setTimeout(r, 3000));

        const testParams = await this.api.getDeviceParams(this.deviceInfo, []);
        if (testParams.ac_vdir === 2) {
          supportsVertical = true;
          this.log('Vertical positions supported (test position accepted)');
        } else {
          this.log('Vertical positions NOT supported (test position rejected)');
        }

        // Restore original value and wait longer for device to process
        await this.api.setDeviceParams(this.deviceInfo, { ac_vdir: originalVdir });
        await new Promise(r => this.homey.setTimeout(r, 2000)); // Wait for restore
      }

      // Check horizontal swing position support
      let supportsHorizontal = false;
      if (originalHdir >= 2 && originalHdir <= 6) {
        supportsHorizontal = true;
        this.log('Horizontal positions supported (current value is a position)');
      } else if (originalHdir !== undefined) {
        // Try setting to position 2 and see if it sticks
        await this.api.setDeviceParams(this.deviceInfo, { ac_hdir: 2 });
        await new Promise(r => this.homey.setTimeout(r, 3000));

        const testParams2 = await this.api.getDeviceParams(this.deviceInfo, []);
        if (testParams2.ac_hdir === 2) {
          supportsHorizontal = true;
          this.log('Horizontal positions supported (test position accepted)');
        } else {
          this.log('Horizontal positions NOT supported (test position rejected)');
        }

        // Restore original value and wait longer for device to process
        await this.api.setDeviceParams(this.deviceInfo, { ac_hdir: originalHdir });
        await new Promise(r => this.homey.setTimeout(r, 2000)); // Wait for restore
      }

      // Store the results for future use
      this.supportsVerticalPositions = supportsVertical;
      this.supportsHorizontalPositions = supportsHorizontal;

      await this.setStoreValue('supportsVerticalPositions', supportsVertical);
      await this.setStoreValue('supportsHorizontalPositions', supportsHorizontal);

      this.log(`Swing position detection complete: vertical=${supportsVertical}, horizontal=${supportsHorizontal}`);

      // Update capability options to hide position options if not supported
      await this._updateSwingCapabilityOptions();

    } catch (error) {
      this.error('Failed to detect swing position support:', error);
    }
  }

  /**
   * Update swing capability options based on detected position support.
   * If positions are not supported, limit the picker to just Fixed/Swing options.
   */
  async _updateSwingCapabilityOptions() {
    try {
      if (this.hasCapability('airco_vertical') && !this.supportsVerticalPositions) {
        this.log('Limiting vertical swing to Fixed/Swing only');
        await this.setCapabilityOptions('airco_vertical', {
          values: [
            { id: 'off', title: { en: 'Fixed' } },
            { id: 'on', title: { en: 'Swing' } }
          ]
        });
      }

      if (this.hasCapability('airco_horizontal') && !this.supportsHorizontalPositions) {
        this.log('Limiting horizontal swing to Fixed/Swing only');
        await this.setCapabilityOptions('airco_horizontal', {
          values: [
            { id: 'off', title: { en: 'Fixed' } },
            { id: 'on', title: { en: 'Swing' } }
          ]
        });
      }
    } catch (error) {
      this.error('Failed to update swing capability options:', error);
    }
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

    // Clear polling intervals
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
    }
    if (this.energyPollInterval) {
      this.homey.clearInterval(this.energyPollInterval);
    }
  }

  /**
   * onUninit is called when the device is destroyed (app restart, Homey Cloud cleanup, etc.)
   * Required for proper cleanup on Homey Cloud multi-tenancy
   */
  async onUninit() {
    this.log('AUX AC device is being uninitialized');

    // Clear polling intervals
    if (this.pollInterval) {
      this.homey.clearInterval(this.pollInterval);
    }
    if (this.energyPollInterval) {
      this.homey.clearInterval(this.energyPollInterval);
    }

    // Clean up API instance
    if (this.api) {
      this.api = null;
    }
  }

  /**
   * Sync device state from cloud
   * Includes automatic retry and re-authentication on transient failures
   */
  async syncDeviceState() {
    try {
      // Get fresh device list to update sessions
      // The API now handles auto-relogin internally via _withRetry
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

      // Update device info with fresh session and cookie
      // This is critical for preventing stale session errors (maeek/ha-aux-cloud #41)
      this.deviceInfo.devSession = foundDevice.devSession;
      if (foundDevice.cookie) {
        this.deviceInfo.cookie = foundDevice.cookie;
      }

      // Check if device is online
      if (foundDevice.state !== 1) {
        this.setUnavailable('Device is offline').catch(this.error);
        return;
      }

      this.setAvailable().catch(this.error);

      const params = foundDevice.params || {};

      // Detect which optional capabilities this device supports based on reported params
      await this._updateDynamicCapabilities(params);

      // Update basic capabilities
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
        this.log(`Setting current temperature: ${currentTemp}°C (envtemp=${params.envtemp})`);
        await this.setCapabilityValue('measure_temperature', currentTemp).catch(this.error);
      } else {
        // Device doesn't report current temperature - remove capability
        if (this.hasCapability('measure_temperature')) {
          this.log('Device does not support envtemp - removing measure_temperature capability');
          try {
            await this.removeCapability('measure_temperature');
          } catch (err) {
            // Capability might already be removed, ignore error
            this.log('Could not remove measure_temperature capability:', err.message);
          }
        }
      }

      if (params.ac_mode !== undefined) {
        // Check power state - if off, set mode to 'off'
        if (params.pwr === 0) {
          await this.setCapabilityValue('thermostat_mode', 'off').catch(this.error);
        } else {
          // Power is on, set the actual mode
          const homeyMode = AUX_MODE_TO_HOMEY[params.ac_mode];
          const validModes = ['auto', 'cool', 'heat', 'dry', 'fan_only'];
          if (homeyMode !== undefined && validModes.includes(homeyMode)) {
            // Store as last active mode
            this._lastActiveMode = homeyMode;
            try {
              await this.setCapabilityValue('thermostat_mode', homeyMode);
            } catch (err) {
              this.error(`Failed to set thermostat_mode to ${homeyMode}:`, err);
              await this.setCapabilityValue('thermostat_mode', 'auto').catch(this.error);
            }
          } else {
            this.log(`Unknown thermostat mode value: ${params.ac_mode}, defaulting to 'auto'`);
            this._lastActiveMode = 'auto';
            await this.setCapabilityValue('thermostat_mode', 'auto').catch(this.error);
          }
        }
      }

      // Update fan speed - with validation
      if (params.ac_mark !== undefined && this.hasCapability('fan_speed')) {
        const homeyFan = AUX_FAN_TO_HOMEY[params.ac_mark];
        if (homeyFan !== undefined) {
          try {
            await this.setCapabilityValue('fan_speed', homeyFan);
          } catch (err) {
            this.error(`Failed to set fan_speed to ${homeyFan}:`, err);
            await this.setCapabilityValue('fan_speed', 'auto').catch(this.error);
          }
        } else {
          this.log(`Unknown fan speed value: ${params.ac_mark}, defaulting to 'auto'`);
          await this.setCapabilityValue('fan_speed', 'auto').catch(this.error);
        }
      }

      // Update swing modes - only if device supports them AND value is valid
      if (params.ac_vdir !== undefined && this.hasCapability('airco_vertical')) {
        const homeySwing = AUX_SWING_TO_HOMEY[params.ac_vdir];
        if (homeySwing !== undefined) {
          // Double-check the value exists in capability options before setting
          try {
            await this.setCapabilityValue('airco_vertical', homeySwing);
          } catch (err) {
            this.error(`Failed to set vertical swing to ${homeySwing}:`, err);
            // Set to safe default on error
            await this.setCapabilityValue('airco_vertical', 'off').catch(this.error);
          }
        } else {
          this.log(`Unknown vertical swing value: ${params.ac_vdir}, defaulting to 'off'`);
          await this.setCapabilityValue('airco_vertical', 'off').catch(this.error);
        }
      }

      if (params.ac_hdir !== undefined && this.hasCapability('airco_horizontal')) {
        const homeySwing = AUX_SWING_TO_HOMEY[params.ac_hdir];
        if (homeySwing !== undefined) {
          try {
            await this.setCapabilityValue('airco_horizontal', homeySwing);
          } catch (err) {
            this.error(`Failed to set horizontal swing to ${homeySwing}:`, err);
            await this.setCapabilityValue('airco_horizontal', 'off').catch(this.error);
          }
        } else {
          this.log(`Unknown horizontal swing value: ${params.ac_hdir}, defaulting to 'off'`);
          await this.setCapabilityValue('airco_horizontal', 'off').catch(this.error);
        }
      }

      // Update toggle capabilities - only if device supports them
      if (params.ecomode !== undefined && this.hasCapability('eco_mode')) {
        await this.setCapabilityValue('eco_mode', params.ecomode === 1).catch(this.error);
      }

      if (params.ac_health !== undefined && this.hasCapability('health_mode')) {
        await this.setCapabilityValue('health_mode', params.ac_health === 1).catch(this.error);
      }

      if (params.ac_slp !== undefined && this.hasCapability('sleep_mode')) {
        await this.setCapabilityValue('sleep_mode', params.ac_slp === 1).catch(this.error);
      }

      if (params.scrdisp !== undefined && this.hasCapability('display_light')) {
        await this.setCapabilityValue('display_light', params.scrdisp === 1).catch(this.error);
      }

      if (params.ac_clean !== undefined && this.hasCapability('self_cleaning')) {
        await this.setCapabilityValue('self_cleaning', params.ac_clean === 1).catch(this.error);
      }

      if (params.childlock !== undefined && this.hasCapability('child_lock')) {
        await this.setCapabilityValue('child_lock', params.childlock === 1).catch(this.error);
      }

      if (params.mldprf !== undefined && this.hasCapability('mildew_proof')) {
        await this.setCapabilityValue('mildew_proof', params.mldprf === 1).catch(this.error);
      }

      if (params.comfwind !== undefined && this.hasCapability('comfortable_wind')) {
        await this.setCapabilityValue('comfortable_wind', params.comfwind === 1).catch(this.error);
      }

      if (params.ac_astheat !== undefined && this.hasCapability('auxiliary_heat')) {
        await this.setCapabilityValue('auxiliary_heat', params.ac_astheat === 1).catch(this.error);
      }

      // Update power limit capabilities
      if (params.pwrlimit !== undefined && this.hasCapability('power_limit')) {
        // Convert number to string for enum picker
        const pwrLimitStr = String(params.pwrlimit);
        this.log(`Cloud reports pwrlimit: ${params.pwrlimit} (setting as "${pwrLimitStr}")`);
        await this.setCapabilityValue('power_limit', pwrLimitStr).catch(this.error);
      }

      if (params.pwrlimitswitch !== undefined && this.hasCapability('power_limit_enabled')) {
        await this.setCapabilityValue('power_limit_enabled', params.pwrlimitswitch === 1).catch(this.error);
      }

      // Remove error_status capability if device doesn't support it
      if (!params.hasOwnProperty('err_flag')) {
        if (this.hasCapability('error_status')) {
          this.log('Device does not support err_flag - removing error_status capability');
          try {
            await this.removeCapability('error_status');
          } catch (err) {
            // Capability might already be removed, ignore error
            this.log('Could not remove error_status capability:', err.message);
          }
        }
      } else {
        // Update error status (read-only diagnostic)
        if (this.hasCapability('error_status')) {
          const errorMsg = params.err_flag === 0 ? 'No error' : `Error: ${params.err_flag}`;
          await this.setCapabilityValue('error_status', errorMsg).catch(this.error);
        }
      }

      // Update temperature unit - with validation
      // Update temperature unit (but skip if user recently changed it manually)
      if (params.tempunit !== undefined && this.hasCapability('temperature_unit')) {
        this.log(`Cloud reports tempunit: ${params.tempunit} (1=C, 2=F)`);

        // Skip sync if user changed it in the last 60 seconds
        const now = Date.now();
        const timeSinceUserChange = this._lastTempUnitChange ? (now - this._lastTempUnitChange) : Infinity;

        if (timeSinceUserChange < 60000) {
          this.log(`Skipping tempunit sync (user changed it ${Math.round(timeSinceUserChange / 1000)}s ago)`);
        } else {
          // 1=Celsius, 2=Fahrenheit
          const unit = params.tempunit === 1 ? 'celsius' : (params.tempunit === 2 ? 'fahrenheit' : 'celsius');
          const validUnits = ['celsius', 'fahrenheit'];
          if (validUnits.includes(unit)) {
            try {
              await this.setCapabilityValue('temperature_unit', unit);
            } catch (err) {
              this.error(`Failed to set temperature_unit to ${unit}:`, err);
              await this.setCapabilityValue('temperature_unit', 'celsius').catch(this.error);
            }
          } else {
            this.log(`Unknown temperature unit: ${params.tempunit}, defaulting to celsius`);
            await this.setCapabilityValue('temperature_unit', 'celsius').catch(this.error);
          }
        }
      }

      // Update error status (read-only diagnostic)
      if (params.err_flag !== undefined && this.hasCapability('error_status')) {
        const errorMsg = params.err_flag === 0 ? 'No error' : `Error: ${params.err_flag}`;
        await this.setCapabilityValue('error_status', errorMsg).catch(this.error);
      }

      // Reset consecutive sync failures on success
      this._syncFailures = 0;

    } catch (error) {
      this.error('Failed to sync device state:', error);

      // Track consecutive failures for smarter error handling
      this._syncFailures = (this._syncFailures || 0) + 1;

      // Only mark unavailable after multiple consecutive failures
      // This prevents transient network issues from causing device flicker
      if (this._syncFailures >= 3) {
        this.setUnavailable('Failed to sync state - check connection').catch(this.error);
      }
    }
  }

  /**
   * Sync energy consumption data from cloud
   * Fetches yearly cumulative energy data and updates meter_power capability
   */
  async syncEnergyData() {
    try {
      if (!this.hasCapability('meter_power')) {
        return;
      }

      // Get current year for date range
      const now = new Date();
      const year = now.getFullYear();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Query yearly energy consumption data
      // Using fw_auxoverseayearconsum_v1 for overseas devices (gives monthly totals for the year)
      const result = await this.api.queryDeviceData(
        this.deviceInfo,
        'fw_auxoverseayearconsum_v1',
        startDate,
        endDate
      );

      if (result.status === 0 && result.table && result.table.length > 0) {
        const deviceData = result.table[0];

        // Sum up all monthly values to get yearly total
        let totalEnergy = 0;
        if (deviceData.values && deviceData.values.length > 0) {
          for (const entry of deviceData.values) {
            // tenelec is energy in kWh
            if (entry.tenelec !== undefined) {
              totalEnergy += entry.tenelec;
            }
          }
        }

        // Update meter_power capability (in kWh)
        await this.setCapabilityValue('meter_power', totalEnergy).catch(this.error);
        this.log(`Energy data updated: ${totalEnergy.toFixed(2)} kWh (${year})`);

        // Reset energy sync failures on success
        this._energySyncFailures = 0;
      } else {
        this.log('No energy data available or unsupported by device');
      }

    } catch (error) {
      this.error('Failed to sync energy data:', error);

      // Track failures but don't mark device unavailable for energy sync issues
      this._energySyncFailures = (this._energySyncFailures || 0) + 1;

      // If energy data consistently fails, log it but continue
      if (this._energySyncFailures >= 3) {
        this.log('Energy data sync repeatedly failed - device may not support energy monitoring');
      }
    }
  }

  /**
   * Update device capabilities dynamically based on what params the device reports
   * This allows different AC models to show only the features they support
   */
  async _updateDynamicCapabilities(params) {
    const reportedParams = Object.keys(params);

    // Check each param -> capability mapping
    for (const [param, capability] of Object.entries(PARAM_TO_CAPABILITY)) {
      const deviceSupportsParam = reportedParams.includes(param);
      const hasCapability = this.hasCapability(capability);

      if (deviceSupportsParam && !hasCapability) {
        // Device supports this param but we don't have the capability - add it
        this.log(`Adding capability ${capability} (device reports ${param})`);
        try {
          await this.addCapability(capability);
          // Register listener for the new capability if it's not read-only
          this._registerDynamicCapabilityListener(capability);
        } catch (error) {
          this.error(`Failed to add capability ${capability}:`, error);
        }
      } else if (!deviceSupportsParam && hasCapability) {
        // Device doesn't support this param but we have the capability - keep it for now
        // Note: We don't remove capabilities because the device might just not be 
        // reporting them in this response. User can manually reset if needed.
        this.log(`Device does not report ${param}, but capability ${capability} exists`);
      }
    }
  }

  /**
   * Register a listener for a dynamically added capability
   */
  _registerDynamicCapabilityListener(capability) {
    const listenerMap = {
      'airco_vertical': this.onCapabilitySwingVertical,
      'airco_horizontal': this.onCapabilitySwingHorizontal,
      'eco_mode': this.onCapabilityEcoMode,
      'health_mode': this.onCapabilityHealthMode,
      'fan_speed': this.onCapabilityFanSpeed,
      'sleep_mode': this.onCapabilitySleepMode,
      'display_light': this.onCapabilityDisplayLight,
      'self_cleaning': this.onCapabilitySelfCleaning,
      'child_lock': this.onCapabilityChildLock,
      'mildew_proof': this.onCapabilityMildewProof,
      'comfortable_wind': this.onCapabilityComfortableWind,
      'auxiliary_heat': this.onCapabilityAuxiliaryHeat,
      'power_limit': this.onCapabilityPowerLimit,
      'power_limit_enabled': this.onCapabilityPowerLimitEnabled,
      'temperature_unit': this.onCapabilityTemperatureUnit
      // error_status is read-only, no listener needed
    };

    const handler = listenerMap[capability];
    if (handler) {
      this.registerCapabilityListener(capability, handler.bind(this));
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

      // Update thermostat_mode to reflect power state
      if (value) {
        // Power ON - restore last mode or default to auto
        const modeToSet = this._lastActiveMode || 'auto';
        await this.setCapabilityValue('thermostat_mode', modeToSet).catch(this.error);
      } else {
        // Power OFF - set mode to 'off'
        await this.setCapabilityValue('thermostat_mode', 'off').catch(this.error);
      }

      // Wait before syncing to allow device to process command
      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

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

      // Wait before syncing to allow device to process command
      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

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
      // Special handling for "off" mode - turn power off
      if (value === 'off') {
        this.log('OFF mode selected - turning power off');

        const params = {
          pwr: 0
        };

        const success = await this.api.setDeviceParams(this.deviceInfo, params);

        if (!success) {
          throw new Error('Failed to turn off');
        }

        // Update onoff capability to reflect power off
        await this.setCapabilityValue('onoff', false).catch(this.error);

        this.homey.setTimeout(() => {
          this.syncDeviceState().catch(this.error);
        }, SYNC_DELAY_MS);

        return value;
      }

      // For any other mode, make sure power is on and set the mode
      const auxMode = HOMEY_MODE_TO_AUX[value];

      if (auxMode === undefined) {
        throw new Error('Invalid mode');
      }

      // Store the last active mode (so we can restore it when turning on)
      this._lastActiveMode = value;

      const params = {
        pwr: 1,  // Ensure power is on when setting a mode
        ac_mode: auxMode
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);

      if (!success) {
        throw new Error('Failed to set mode');
      }

      // Update onoff capability to reflect power on
      await this.setCapabilityValue('onoff', true).catch(this.error);

      // Wait before syncing to allow device to process command
      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

      return value;
    } catch (error) {
      this.error('Failed to set thermostat_mode:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Handle fan_speed capability
   */
  async onCapabilityFanSpeed(value) {
    this.log('fan_speed changed to:', value);

    try {
      const auxFan = HOMEY_FAN_TO_AUX[value];

      if (auxFan === undefined) {
        throw new Error('Invalid fan speed');
      }

      const params = {
        ac_mark: auxFan
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);

      if (!success) {
        throw new Error('Failed to set fan speed');
      }

      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

      return value;
    } catch (error) {
      this.error('Failed to set fan_speed:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Handle vertical swing capability
   */
  async onCapabilitySwingVertical(value) {
    this.log('airco_vertical changed to:', value);

    try {
      const auxSwing = HOMEY_SWING_TO_AUX[value];

      if (auxSwing === undefined) {
        throw new Error('Invalid swing position');
      }

      const params = {
        ac_vdir: auxSwing
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);

      if (!success) {
        throw new Error('Failed to set swing position');
      }

      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

      return value;
    } catch (error) {
      this.error('Failed to set airco_vertical:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Handle horizontal swing capability
   */
  async onCapabilitySwingHorizontal(value) {
    this.log('airco_horizontal changed to:', value);

    try {
      const auxSwing = HOMEY_SWING_TO_AUX[value];

      if (auxSwing === undefined) {
        throw new Error('Invalid swing position');
      }

      const params = {
        ac_hdir: auxSwing
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);

      if (!success) {
        throw new Error('Failed to set swing position');
      }

      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

      return value;
    } catch (error) {
      this.error('Failed to set airco_horizontal:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Handle eco_mode capability
   */
  async onCapabilityEcoMode(value) {
    return this._setBooleanParam('eco_mode', 'ecomode', value);
  }

  /**
   * Handle health_mode capability
   */
  async onCapabilityHealthMode(value) {
    return this._setBooleanParam('health_mode', 'ac_health', value);
  }

  /**
   * Handle sleep_mode capability
   */
  async onCapabilitySleepMode(value) {
    return this._setBooleanParam('sleep_mode', 'ac_slp', value);
  }

  /**
   * Handle display_light capability
   */
  async onCapabilityDisplayLight(value) {
    return this._setBooleanParam('display_light', 'scrdisp', value);
  }

  /**
   * Handle self_cleaning capability
   */
  async onCapabilitySelfCleaning(value) {
    return this._setBooleanParam('self_cleaning', 'ac_clean', value);
  }

  /**
   * Handle child_lock capability
   */
  async onCapabilityChildLock(value) {
    return this._setBooleanParam('child_lock', 'childlock', value);
  }

  /**
   * Handle mildew_proof capability
   */
  async onCapabilityMildewProof(value) {
    return this._setBooleanParam('mildew_proof', 'mldprf', value);
  }

  /**
   * Handle comfortable_wind capability
   */
  async onCapabilityComfortableWind(value) {
    return this._setBooleanParam('comfortable_wind', 'comfwind', value);
  }

  /**
   * Handle auxiliary_heat capability
   */
  async onCapabilityAuxiliaryHeat(value) {
    return this._setBooleanParam('auxiliary_heat', 'ac_astheat', value);
  }

  /**
   * Handle power_limit capability
   */
  async onCapabilityPowerLimit(value) {
    this.log('power_limit changed to:', value);

    try {
      // Convert string value from picker to number
      const numValue = parseInt(value, 10);

      const params = {
        pwrlimit: numValue
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);

      if (!success) {
        throw new Error('Failed to set power limit');
      }

      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

      return value;
    } catch (error) {
      this.error('Failed to set power_limit:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Handle power_limit_enabled capability
   */
  async onCapabilityPowerLimitEnabled(value) {
    return this._setBooleanParam('power_limit_enabled', 'pwrlimitswitch', value);
  }

  /**
   * Handle temperature_unit capability
   */
  async onCapabilityTemperatureUnit(value) {
    this.log('temperature_unit changed to:', value);

    try {
      // Track when user manually changed this to prevent sync from overwriting
      this._lastTempUnitChange = Date.now();

      // 1 = Celsius, 2 = Fahrenheit (NOT 0!)
      const tempunitValue = value === 'celsius' ? 1 : 2;
      const params = {
        tempunit: tempunitValue
      };

      this.log(`Setting tempunit API parameter to: ${tempunitValue} (${value})`);
      const success = await this.api.setDeviceParams(this.deviceInfo, params);
      this.log(`Temperature unit API call result: ${success ? 'SUCCESS' : 'FAILED'}`);

      if (!success) {
        throw new Error('Failed to set temperature unit');
      }

      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

      return value;
    } catch (error) {
      this.error('Failed to set temperature_unit:', error);
      throw new Error('Failed to control device');
    }
  }

  /**
   * Helper to set boolean parameters
   */
  async _setBooleanParam(capabilityName, paramName, value) {
    this.log(`${capabilityName} changed to:`, value);

    try {
      const params = {
        [paramName]: value ? 1 : 0
      };

      const success = await this.api.setDeviceParams(this.deviceInfo, params);

      if (!success) {
        throw new Error(`Failed to set ${capabilityName}`);
      }

      this.homey.setTimeout(() => {
        this.syncDeviceState().catch(this.error);
      }, SYNC_DELAY_MS);

      return value;
    } catch (error) {
      this.error(`Failed to set ${capabilityName}:`, error);
      throw new Error('Failed to control device');
    }
  }

}

module.exports = AuxACDevice;
