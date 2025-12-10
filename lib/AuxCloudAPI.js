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

// Device constants
const AC_MODE = {
  COOLING: 0,
  HEATING: 1,
  DRY: 2,
  FAN: 3,
  AUTO: 4
};

class AuxCloudAPI {
  
  constructor(region = 'eu') {
    this.url = API_SERVERS[region] || API_SERVERS.eu;
    this.region = region;
    this.loginsession = null;
    this.userid = null;
    this.email = null;
    this.password = null;
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
      return true;
    }

    throw new Error(`Login failed: ${result.msg || 'Unknown error'}`);
  }

  /**
   * Check if logged in
   */
  isLoggedIn() {
    return !!(this.loginsession && this.userid);
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
      for (const device of devices) {
        if (device.state === 1) { // Only query online devices
          try {
            const params = await this.getDeviceParams(device);
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
   * Get device parameters
   */
  async getDeviceParams(device, paramsList = []) {
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

    if (result.event && result.event.payload && result.event.payload.data) {
      // Parse the JSON data string
      const data = JSON.parse(result.event.payload.data);
      
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
   * Set device parameters
   */
  async setDeviceParams(device, params) {
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
    const paramVals = Object.values(params);

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

    if (result.event && result.event.payload) {
      return result.event.payload.status === 0;
    }

    return false;
  }
}

// Export the class and constants
module.exports = {
  AuxCloudAPI,
  AC_MODE,
  API_SERVERS
};
