'use strict';

const fetch = require('node-fetch');
const crypto = require('crypto');

// Adapted from the Home Assistant AUX Cloud integration by @maeek:
// https://github.com/maeek/ha-aux-cloud

// AUX Cloud API constants
const LICENSE_ID = '3c015b249dd66ef0f11f9bef59ecd737';
const COMPANY_ID = '48eb1b36cf0202ab2ef07b880ecda60d';
const SPOOF_APP_VERSION = '2.2.10.456537160';
const SPOOF_USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 12; SM-G991B Build/SP1A.210812.016)';

// Encryption keys
const TIMESTAMP_TOKEN_ENCRYPT_KEY = 'kdixkdqp54545^#*';
const PASSWORD_ENCRYPT_KEY = '4969fj#k23#';
const BODY_ENCRYPT_KEY = 'xgx3d*fe3478$ukx';

// Body encryption IV
const AES_INITIAL_VECTOR = Buffer.from([
  234, 170, 170, 58, 187, 88, 98, 162,
  25, 24, 181, 119, 29, 22, 21, 170
]);

// License (base64 encoded)
const LICENSE = 'PAFbJJ3WbvDxH5vvWezXN5BujETtH/iuTtIIW5CE/SeHN7oNKqnEajgljTcL0fBQQWM0XAAAAAAnBhJyhMi7zIQMsUcwR/PEwGA3uB5HLOnr+xRrci+FwHMkUtK7v4yo0ZHa+jPvb6djelPP893k7SagmffZmOkLSOsbNs8CAqsu8HuIDs2mDQAAAAA=';

// API Server URLs
const API_SERVERS = {
  eu: 'https://app-service-deu-f0e9ebbb.smarthomecs.de',
  usa: 'https://app-service-usa-fd7cc04c.smarthomecs.com',
  china: 'https://app-service-chn-31a93883.ibroadlink.com'
};

// AC Mode constants
const AC_MODE = {
  COOLING: 0,
  HEATING: 1,
  DRY: 2,
  FAN: 3,
  AUTO: 4
};

// Fan Speed constants
const FAN_SPEED = {
  AUTO: 0,
  LOW: 1,
  MID: 2,
  HIGH: 3,
  TURBO: 4,
  MUTE: 5,
  MID_LOWER: 6,
  MID_HIGHER: 7
};

// AC Parameter names (matching Python source)
const AC_PARAMS = {
  // Power
  POWER: 'pwr',

  // Temperature
  TARGET_TEMP: 'temp',
  AMBIENT_TEMP: 'envtemp',

  // Mode
  MODE: 'ac_mode',

  // Fan
  FAN_SPEED: 'ac_mark',

  // Swing/Airflow direction
  SWING_VERTICAL: 'ac_vdir',
  SWING_HORIZONTAL: 'ac_hdir',

  // Features
  ECO_MODE: 'ecomode',
  HEALTH: 'ac_health',
  SLEEP: 'ac_slp',
  SCREEN_DISPLAY: 'scrdisp',
  SELF_CLEAN: 'ac_clean',
  CHILD_LOCK: 'childlock',
  MILDEW_PROOF: 'mldprf',
  COMFORTABLE_WIND: 'comfwind',
  AUXILIARY_HEAT: 'ac_astheat',

  // Power limiting
  POWER_LIMIT: 'pwrlimit',
  POWER_LIMIT_SWITCH: 'pwrlimitswitch',

  // Other
  ERROR_FLAG: 'err_flag',
  TEMP_UNIT: 'tempunit',
  SLEEP_DIY: 'sleepdiy'
};

// Known device types (product IDs)
// The AUX Cloud / Broadlink DNA platform supports various device types
// This registry can be extended to support new devices
const DEVICE_REGISTRY = {
  // ============================================
  // HVAC DEVICES (Currently Supported)
  // ============================================

  // Mini-split air conditioners
  '000000000000000000000000c0620000': {
    type: 'AC_GENERIC',
    name: 'Air Conditioner',
    class: 'thermostat',
    driver: 'aux-ac',
    supported: true
  },
  '0000000000000000000000002a4e0000': {
    type: 'AC_GENERIC',
    name: 'Air Conditioner',
    class: 'thermostat',
    driver: 'aux-ac',
    supported: true
  },

  // Heat pumps with water heating capability
  '000000000000000000000000c3aa0000': {
    type: 'HEAT_PUMP',
    name: 'Heat Pump',
    class: 'thermostat',
    driver: 'aux-ac',
    supported: true
  },

  // ============================================
  // PLACEHOLDER: Future Device Types
  // Add new product IDs here as they are discovered
  // ============================================

  // Example: Dehumidifiers (not yet implemented)
  // '000000000000000000000000XXXXXXXX': {
  //   type: 'DEHUMIDIFIER',
  //   name: 'Dehumidifier',
  //   class: 'fan',
  //   driver: 'aux-dehumidifier',
  //   supported: false
  // },

  // Example: Smart Plugs (not yet implemented)
  // '000000000000000000000000YYYYYYYY': {
  //   type: 'SMART_PLUG',
  //   name: 'Smart Plug',
  //   class: 'socket',
  //   driver: 'aux-plug',
  //   supported: false
  // }
};

// Legacy DEVICE_TYPES for backward compatibility
const DEVICE_TYPES = {
  AC_GENERIC: [
    '000000000000000000000000c0620000',
    '0000000000000000000000002a4e0000'
  ],
  HEAT_PUMP: [
    '000000000000000000000000c3aa0000'
  ]
};

/**
 * Get device info from the registry
 * @param {string} productId - The product ID to look up
 * @returns {Object|null} - Device info or null if unknown
 */
function getDeviceInfo(productId) {
  return DEVICE_REGISTRY[productId] || null;
}

/**
 * Check if a product ID is a supported device
 * @param {string} productId - The product ID to check
 * @returns {boolean} - True if the device is supported
 */
function isSupportedDevice(productId) {
  const info = DEVICE_REGISTRY[productId];
  return info ? info.supported : false;
}

/**
 * Get the device type name for a product ID
 * @param {string} productId - The product ID
 * @returns {string} - Human-readable device type name
 */
function getDeviceTypeName(productId) {
  const info = DEVICE_REGISTRY[productId];
  return info ? info.name : 'Unknown Device';
}

/**
 * Get the device class (thermostat, socket, fan, etc.)
 * @param {string} productId - The product ID
 * @returns {string} - Homey device class
 */
function getDeviceClass(productId) {
  const info = DEVICE_REGISTRY[productId];
  return info ? info.class : 'other';
}

/**
 * Get the driver ID for a product
 * @param {string} productId - The product ID
 * @returns {string|null} - Driver ID or null
 */
function getDriverId(productId) {
  const info = DEVICE_REGISTRY[productId];
  return info ? info.driver : null;
}

/**
 * Log an unknown device for future support
 * Returns device info for logging/debugging
 * @param {Object} device - The device object from API
 * @returns {Object} - Info about the unknown device
 */
function logUnknownDevice(device) {
  return {
    productId: device.productId,
    name: device.name || device.friendlyName,
    mac: device.mac,
    message: `Unknown device type: ${device.productId}. Please report this to help add support!`
  };
}

// Rate limiting constants (conservative values since not documented)
const RATE_LIMITS = {
  // Minimum time between login attempts (in ms)
  LOGIN_COOLDOWN: 10000, // 10 seconds
  // Time to wait after rate limit error (in ms)
  RATE_LIMIT_BACKOFF: 300000, // 5 minutes
  // Minimum time between API requests (in ms)
  REQUEST_COOLDOWN: 1000, // 1 second
  // Maximum retries for transient errors
  MAX_RETRIES: 3,
  // Exponential backoff base (in ms)
  BACKOFF_BASE: 2000, // 2 seconds
};

class AuxCloudAPI {

  constructor(region = 'eu') {
    this.url = API_SERVERS[region] || API_SERVERS.eu;
    this.region = region;
    this.loginsession = null;
    this.userid = null;
    this.email = null;
    this.password = null;

    // Rate limiting state
    this._lastLoginAttempt = 0;
    this._lastRequest = 0;
    this._rateLimitedUntil = 0;
    this._consecutiveErrors = 0;
  }

  /**
   * Check if we're currently rate limited
   */
  isRateLimited() {
    return Date.now() < this._rateLimitedUntil;
  }

  /**
   * Get remaining rate limit time in seconds
   */
  getRateLimitRemaining() {
    const remaining = this._rateLimitedUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Wait for rate limit cooldown if needed
   */
  async _waitForCooldown(type = 'request') {
    const now = Date.now();

    // Check if we're in rate limit backoff
    if (now < this._rateLimitedUntil) {
      const waitTime = this._rateLimitedUntil - now;
      throw new Error(`Rate limited. Please wait ${Math.ceil(waitTime / 1000)} seconds before retrying.`);
    }

    // Check cooldown based on type
    const cooldown = type === 'login' ? RATE_LIMITS.LOGIN_COOLDOWN : RATE_LIMITS.REQUEST_COOLDOWN;
    const lastTime = type === 'login' ? this._lastLoginAttempt : this._lastRequest;

    if (now - lastTime < cooldown) {
      const waitTime = cooldown - (now - lastTime);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Handle rate limit response
   */
  _handleRateLimit(message) {
    // Set backoff with exponential increase for consecutive errors
    const backoff = RATE_LIMITS.RATE_LIMIT_BACKOFF * Math.pow(2, this._consecutiveErrors);
    this._rateLimitedUntil = Date.now() + Math.min(backoff, 3600000); // Max 1 hour
    this._consecutiveErrors++;
    // Note: The server has rate-limited us, we'll automatically retry after backoff
  }

  /**
   * Reset rate limit state on success
   */
  _resetRateLimitState() {
    this._consecutiveErrors = 0;
  }

  /**
   * Encrypt data using AES-128-CBC with zero padding
   * Returns raw Buffer to match Python implementation
   */
  _encryptAES(key, data) {
    const cipher = crypto.createCipheriv('aes-128-cbc', key, AES_INITIAL_VECTOR);
    cipher.setAutoPadding(false);

    // Zero padding
    const blockSize = 16;
    const paddingLength = blockSize - (data.length % blockSize);
    const paddedData = Buffer.concat([data, Buffer.alloc(paddingLength, 0)]);

    // Return raw Buffer, not base64 - matching Python implementation
    return Buffer.concat([cipher.update(paddedData), cipher.final()]);
  }

  /**
   * Get request headers
   */
  _getHeaders(extraHeaders = {}) {
    return {
      'Content-Type': 'application/x-java-serialized-object',
      'licenseId': LICENSE_ID,
      'lid': LICENSE_ID,
      'language': 'en',
      'appVersion': SPOOF_APP_VERSION,
      'User-Agent': SPOOF_USER_AGENT,
      'system': 'android',
      'appPlatform': 'android',
      'loginsession': this.loginsession || '',
      'userid': this.userid || '',
      ...extraHeaders
    };
  }

  /**
   * Make HTTP request to API
   */
  /**
   * Query device data (stats) - matches the SDK payload structure
   * @param {Object} device - Device object
   * @param {string} type - Data type (e.g. fw_auxoverseadayconsum_v1, serv_auxdayelec_v1)
   * @param {string} startTime - Start time (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss)
   * @param {string} endTime - End time (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss)
   * @returns {Promise<Object>} - Data with table array
   */
  async queryDeviceData(device, type, startTime, endTime) {
    // Build payload matching the exact structure from BroadLink SDK
    const payload = {
      report: type,
      device: [
        {
          did: device.endpointId,
          offset: 0,
          step: 0,
          param: [],
          start: startTime,
          end: endTime
        }
      ]
    };
    return this.sendGenericRequest('POST', 'dataservice/v1/device/stats', payload);
  }

  /**
   * Send a generic request to any endpoint
   * @param {string} method - GET or POST
   * @param {string} endpoint - API endpoint
   * @param {Object} payload - Request body
   * @returns {Promise<Object>} - Response
   */
  async sendGenericRequest(method, endpoint, payload) {
    return this._makeRequest(method, endpoint, {
      data: payload,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async _makeRequest(method, endpoint, options = {}) {
    const url = `${this.url}/${endpoint}`;

    const requestOptions = {
      method,
      headers: this._getHeaders(options.headers || {})
    };

    // Handle body - either raw data, JSON data, or provided body
    if (options.body !== undefined) {
      requestOptions.body = options.body;
    } else if (options.data) {
      requestOptions.body = JSON.stringify(options.data);
    }

    const response = await fetch(url, requestOptions);
    const text = await response.text();

    // Update last request time
    this._lastRequest = Date.now();

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse response: ${text}`);
    }
  }

  /**
   * Login to AUX Cloud
   */
  async login(email, password) {
    // Check rate limit before attempting login
    await this._waitForCooldown('login');
    this._lastLoginAttempt = Date.now();

    this.email = email;
    this.password = password;

    // Use floating point timestamp like Python's time.time()
    const currentTime = Date.now() / 1000;

    // Hash password with SHA1
    const shaPassword = crypto
      .createHash('sha1')
      .update(`${password}${PASSWORD_ENCRYPT_KEY}`)
      .digest('hex');

    const payload = {
      email,
      password: shaPassword,
      companyid: COMPANY_ID,
      lid: LICENSE_ID
    };

    const jsonPayload = JSON.stringify(payload);

    // Create token for validation
    const token = crypto
      .createHash('md5')
      .update(`${jsonPayload}${BODY_ENCRYPT_KEY}`)
      .digest('hex');

    // Create encryption key from timestamp
    const md5Key = crypto
      .createHash('md5')
      .update(`${currentTime}${TIMESTAMP_TOKEN_ENCRYPT_KEY}`)
      .digest();

    // Encrypt body
    const encryptedBody = this._encryptAES(md5Key, Buffer.from(jsonPayload));

    const result = await this._makeRequest('POST', 'account/login', {
      headers: {
        timestamp: `${currentTime}`,
        token
      },
      body: encryptedBody
    });

    if (result.status === 0) {
      this.loginsession = result.loginsession;
      this.userid = result.userid;
      this._resetRateLimitState(); // Success - reset rate limit counters
      return true;
    }

    // Parse common error messages
    const errorMsg = result.msg || 'Unknown error';

    // Rate limiting - "尝试次数过多 请过一段时间后重试" 
    if (errorMsg.includes('尝试次数过多') || errorMsg.includes('too many')) {
      this._handleRateLimit(errorMsg);
      throw new Error(`Too many login attempts. Please wait ${this.getRateLimitRemaining()} seconds before retrying.`);
    }

    // Invalid credentials - "帐号或密码不正确"
    if (errorMsg.includes('帐号或密码不正确') || errorMsg.includes('password')) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    throw new Error(`Login failed: ${errorMsg}`);
  }

  /**
   * Check if logged in
   */
  isLoggedIn() {
    return !!(this.loginsession && this.userid);
  }

  /**
   * Ensure we're logged in, re-authenticate if needed
   * This handles session expiration issues (maeek/ha-aux-cloud #41)
   */
  async _ensureLoggedIn() {
    if (!this.isLoggedIn() && this.email && this.password) {
      await this.login(this.email, this.password);
    }
  }

  /**
   * Execute an API call with automatic retry and re-authentication
   * Handles transient failures and session expiration
   * @param {Function} apiCall - Async function to execute
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @returns {*} - Result of the API call
   */
  async _withRetry(apiCall, maxRetries = RATE_LIMITS.MAX_RETRIES) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this._ensureLoggedIn();
        return await apiCall();
      } catch (error) {
        lastError = error;
        const errorMsg = error.message || String(error);

        // Check if it's an auth error - try to re-login
        if (errorMsg.includes('session') ||
          errorMsg.includes('login') ||
          errorMsg.includes('auth') ||
          errorMsg.includes('401') ||
          errorMsg.includes('unauthorized')) {
          // Clear session and try to re-login on next attempt
          this.loginsession = null;
          this.userid = null;

          if (attempt < maxRetries - 1) {
            // Wait before retry with exponential backoff
            const backoffTime = RATE_LIMITS.BACKOFF_BASE * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            continue;
          }
        }

        // For other errors, apply exponential backoff
        if (attempt < maxRetries - 1) {
          const backoffTime = RATE_LIMITS.BACKOFF_BASE * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    throw lastError;
  }

  /**
   * Get families (homes) from account
   */
  async getFamilies() {
    const result = await this._makeRequest('POST', 'appsync/group/member/getfamilylist');

    if (result.status === 0) {
      return result.data.familyList || [];
    }

    throw new Error(`Failed to get families: ${result.msg || 'Unknown error'}`);
  }

  /**
   * Get devices for a family
   */
  async getDevices(familyid, shared = false) {
    const endpoint = shared
      ? 'appsync/group/sharedev/querylist?querytype=shared'
      : 'appsync/group/dev/query?action=select';

    const body = shared ? '{"endpointId":""}' : '{"pids":[]}';

    const result = await this._makeRequest('POST', endpoint, {
      headers: { familyid },
      body
    });

    if (result.status === 0) {
      let devices = [];

      if (result.data.endpoints) {
        devices = result.data.endpoints;
      } else if (result.data.shareFromOther) {
        devices = result.data.shareFromOther.map(item => item.devinfo);
      }

      // Get device states
      await this._bulkQueryDeviceState(devices);

      // Get device parameters
      // Per HA notebook: empty array returns ALL parameters (including envtemp)
      // BUT notebook also shows ['mode'] specifically for ambient temp - testing this
      for (const device of devices) {
        if (device.state === 1) { // Only query online devices
          try {
            // First try with mode parameter as HA notebook shows
            const params = await this.getDeviceParams(device, ['mode']);
            device.params = params || {};
          } catch (error) {
            console.error(`Failed to get params for device ${device.endpointId}:`, error);
            device.params = {};
          }
        } else {
          device.params = {};
        }
      }

      return devices;
    }

    throw new Error(`Failed to get devices: ${result.msg || 'Unknown error'}`);
  }

  /**
   * Bulk query device states
   */
  async _bulkQueryDeviceState(devices) {
    if (devices.length === 0) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const queriedDevices = devices.map(dev => ({
      did: dev.endpointId,
      devSession: dev.devSession
    }));

    const data = {
      directive: {
        header: {
          namespace: 'DNA.QueryState',
          name: 'queryState',
          messageType: 'controlgw.batch',
          senderId: 'sdk',
          messageId: `${this.userid}-${timestamp}`,
          interfaceVersion: '2',
          timstamp: `${timestamp}` // Note: intentionally misspelled as per AUX API
        },
        payload: {
          studata: queriedDevices,
          msgtype: 'batch'
        }
      }
    };

    const result = await this._makeRequest('POST', 'device/control/v2/querystate', {
      data
    });

    if (result.event && result.event.payload && result.event.payload.status === 0) {
      const states = result.event.payload.data || [];

      // Update device states
      devices.forEach(device => {
        const stateData = states.find(s => s.did === device.endpointId);
        device.state = stateData ? stateData.state : 0;
      });
    }
  }

  /**
   * Get device parameters with retry logic
   */
  async getDeviceParams(device, paramsList = []) {
    return this._withRetry(async () => {
      return this._getDeviceParamsInternal(device, paramsList);
    });
  }

  /**
   * Internal implementation of getDeviceParams
   */
  async _getDeviceParamsInternal(device, paramsList = []) {
    const cookie = JSON.parse(Buffer.from(device.cookie, 'base64').toString());
    const mappedCookie = Buffer.from(JSON.stringify({
      device: {
        id: cookie.terminalid,
        key: cookie.aeskey,
        devSession: device.devSession,
        aeskey: cookie.aeskey,
        did: device.endpointId,
        pid: device.productId,
        mac: device.mac
      }
    })).toString('base64');

    const data = {
      directive: {
        header: {
          namespace: 'DNA.KeyValueControl',
          name: 'KeyValueControl',
          senderId: 'sdk',
          messageId: `${device.endpointId}-${Date.now()}`,
          interfaceVersion: '2'
        },
        endpoint: {
          devicePairedInfo: {
            did: device.endpointId,
            pid: device.productId,
            mac: device.mac,
            devicetypeflag: device.devicetypeFlag,
            cookie: mappedCookie
          },
          endpointId: device.endpointId,
          cookie: {},
          devSession: device.devSession
        },
        payload: {
          act: 'get',
          params: paramsList,
          vals: [],
          did: device.endpointId
        }
      }
    };

    const result = await this._makeRequest('POST', 'device/control/v2/sdkcontrol', {
      data,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Debug logging for mode parameter investigation
    if (paramsList.includes('mode')) {
      console.log('[DEBUG] Mode parameter requested');
      console.log('[DEBUG] Raw result:', JSON.stringify(result));
    }

    if (result.event && result.event.payload && result.event.payload.data) {
      // Parse the JSON data string
      const data = JSON.parse(result.event.payload.data);

      // Debug logging
      if (paramsList.includes('mode')) {
        console.log('[DEBUG] Parsed data:', JSON.stringify(data));
        console.log('[DEBUG] data.params:', data.params);
        console.log('[DEBUG] data.vals:', data.vals);
      }

      // Match params to vals arrays
      const paramsObj = {};
      for (let i = 0; i < data.params.length; i++) {
        paramsObj[data.params[i]] = data.vals[i][0].val;
      }

      return paramsObj;
    }

    return {};
  }

  /**
   * Set device parameters with retry logic
   */
  async setDeviceParams(device, params) {
    return this._withRetry(async () => {
      return this._setDeviceParamsInternal(device, params);
    });
  }

  /**
   * Internal implementation of setDeviceParams
   */
  async _setDeviceParamsInternal(device, params) {
    const cookie = JSON.parse(Buffer.from(device.cookie, 'base64').toString());
    const mappedCookie = Buffer.from(JSON.stringify({
      device: {
        id: cookie.terminalid,
        key: cookie.aeskey,
        devSession: device.devSession,
        aeskey: cookie.aeskey,
        did: device.endpointId,
        pid: device.productId,
        mac: device.mac
      }
    })).toString('base64');

    const paramKeys = Object.keys(params);
    // Format vals as [[{idx: 1, val: x}]] for each parameter (matching Python source)
    const paramVals = Object.values(params).map(val => [{ idx: 1, val: val }]);

    const data = {
      directive: {
        header: {
          namespace: 'DNA.KeyValueControl',
          name: 'KeyValueControl',
          senderId: 'sdk',
          messageId: `${device.endpointId}-${Date.now()}`,
          interfaceVersion: '2'
        },
        endpoint: {
          devicePairedInfo: {
            did: device.endpointId,
            pid: device.productId,
            mac: device.mac,
            devicetypeflag: device.devicetypeFlag,
            cookie: mappedCookie
          },
          endpointId: device.endpointId,
          cookie: {},
          devSession: device.devSession
        },
        payload: {
          act: 'set',
          params: paramKeys,
          vals: paramVals,
          did: device.endpointId
        }
      }
    };

    const result = await this._makeRequest('POST', 'device/control/v2/sdkcontrol', {
      data,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Success is indicated by receiving a response with event.payload.data
    // The API returns the updated device state on success, not a status code
    if (result.event && result.event.payload) {
      // If we get data back, the command succeeded
      if (result.event.payload.data) {
        return true;
      }
      // Some responses may have status=0 for success
      if (result.event.payload.status === 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Refresh device session by fetching latest device info
   * Helps prevent stale devSession issues
   * @param {string} familyid - Family ID
   * @param {string} deviceId - Device endpoint ID
   * @returns {Object|null} - Updated device info or null
   */
  async refreshDeviceSession(familyid, deviceId) {
    try {
      const devices = await this.getDevices(familyid);
      return devices.find(d => d.endpointId === deviceId) || null;
    } catch (error) {
      return null;
    }
  }
}

// Export the class and constants
module.exports = {
  AuxCloudAPI,
  AC_MODE,
  FAN_SPEED,
  AC_PARAMS,
  API_SERVERS,
  DEVICE_TYPES,
  DEVICE_REGISTRY,
  RATE_LIMITS,
  getDeviceInfo,
  isSupportedDevice,
  getDeviceTypeName,
  getDeviceClass,
  getDriverId,
  logUnknownDevice
};
