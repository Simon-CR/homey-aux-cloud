# AUX Cloud API Reference

> **Unofficial API documentation for AUX Air Conditioner / Heat Pump cloud control**
>
> Compatible with: AUX AC, Tornado AC, AC Freedom app, Broadlink DNA platform, SmartHomeCS

This document describes the AUX Cloud (Broadlink DNA) API endpoints discovered through reverse engineering of the AC Freedom app (v3.5.6) and the [Home Assistant AUX Cloud integration](https://github.com/maeek/ha-aux-cloud).

**Keywords**: AUX API, AUX Cloud API, AC Freedom API, Broadlink DNA API, AUX heat pump API, AUX air conditioner API, SmartHomeCS API, Tornado AC API, AUX HVAC control, AUX smart home integration

---

## Table of Contents

- [Authentication](#authentication)
- [API Servers](#api-servers)
- [Authentication Endpoints](#authentication-endpoints)
- [Family/Home Management](#familyhome-management)
- [Device Management](#device-management)
- [Device Control](#device-control)
- [Energy/Power Monitoring](#energypower-monitoring) ⚡
- [AC Device Parameters](#ac-device-parameters)
- [Error Codes](#error-codes)

---

## Authentication

### Headers (Required for all requests)
```
User-Agent: Dalvik/2.1.0 (Linux; U; Android 12; SM-G991B Build/SP1A.210812.016)
Content-Type: application/json
licenseid: 3c015b249dd66ef0f11f9bef59ecd737
lid: 3c015b249dd66ef0f11f9bef59ecd737
companyid: 48eb1b36cf0202ab2ef07b880ecda60d
appversion: 2.2.10.456537160
language: en
loginsession: <session_token>
userid: <user_id>
```

### Encryption
- **Timestamp Token**: AES-ECB with key `kdixkdqp54545^#*`
- **Password**: AES-ECB with key `4969fj#k23#`
- **Request Body**: AES-CBC with key `xgx3d*fe3478$ukx` and fixed IV

---

## API Servers

| Region | Base URL |
|--------|----------|
| EU | `https://app-service-deu-f0e9ebbb.smarthomecs.de` |
| USA | `https://app-service-usa-fd7cc04c.smarthomecs.com` |
| China | `https://app-service-chn-31a93883.ibroadlink.com` |

---

## Authentication Endpoints

### Login
```
POST /oauth/v2/token
```

**Request Body:**
```json
{
  "grant_type": "password",
  "clienttype": 2,
  "companyid": "48eb1b36cf0202ab2ef07b880ecda60d",
  "username": "<email>",
  "password": "<encrypted_password>",
  "client_id": "1",
  "client_secret": "0",
  "lid": "3c015b249dd66ef0f11f9bef59ecd737",
  "license": "<base64_license>"
}
```

**Response:**
```json
{
  "status": 0,
  "msg": "ok",
  "access_token": "...",
  "loginsession": "...",
  "userid": "...",
  "nickname": "..."
}
```

---

## Family/Home Management

### Get Families
```
POST /ec4/v1/user/getbasefamilylist
```

**Request Body:** `{}`

**Response:**
```json
{
  "status": 0,
  "msg": "ok",
  "familylist": [
    {
      "familyid": "...",
      "name": "My Home",
      "icon": "..."
    }
  ]
}
```

### Get Family Details
```
POST /ec4/v1/family/getallinfo
```

**Request Body:**
```json
{
  "familyid": "<family_id>"
}
```

---

## Device Management

### Get Devices in Family
```
POST /ec4/v1/dev/getconfigdev
```

**Request Body:**
```json
{
  "familyid": "<family_id>"
}
```

**Response:**
```json
{
  "status": 0,
  "endpoints": [
    {
      "endpointId": "00000000000000000000XXXXXXXXXXXX",
      "friendlyName": "Living Room AC",
      "mac": "xx:xx:xx:xx:xx:xx",
      "productId": "000000000000000000000000c3aa0000",
      "cookie": "<base64_cookie>",
      "devSession": "...",
      "state": 1,
      "params": { ... }
    }
  ]
}
```

### Query Device State (Batch)
```
POST /device/control/v2/querystate
```

**Request Body:**
```json
{
  "directive": {
    "header": {
      "namespace": "DNA.QueryState",
      "name": "QueryState",
      "messageType": "controlgw.batch",
      "senderId": "sdk",
      "messageId": "<userid>-<timestamp>",
      "interfaceVersion": "2",
      "timstamp": "<timestamp>"
    },
    "payload": {
      "studata": [
        {
          "did": "<endpoint_id>",
          "pid": "<product_id>",
          "devSession": "..."
        }
      ],
      "msgtype": "batch"
    }
  }
}
```

---

## Device Control

### Get Device Parameters
```
POST /device/control/v2/sdkcontrol
```

**Request Body:**
```json
{
  "directive": {
    "header": {
      "namespace": "DNA.KeyValueControl",
      "name": "KeyValueControl",
      "senderId": "sdk",
      "messageId": "<endpoint_id>-<timestamp>",
      "interfaceVersion": "2"
    },
    "endpoint": {
      "devicePairedInfo": {
        "did": "<endpoint_id>",
        "pid": "<product_id>",
        "mac": "<mac_address>",
        "devicetypeflag": 0,
        "cookie": "<mapped_cookie_base64>"
      },
      "endpointId": "<endpoint_id>",
      "cookie": {},
      "devSession": "..."
    },
    "payload": {
      "act": "get",
      "params": ["pwr", "temp", "ac_mode", "ac_mark", ...],
      "vals": [],
      "did": "<endpoint_id>"
    }
  }
}
```

### Set Device Parameters
```
POST /device/control/v2/sdkcontrol
```

**Request Body:**
```json
{
  "directive": {
    "header": {
      "namespace": "DNA.KeyValueControl",
      "name": "KeyValueControl",
      "senderId": "sdk",
      "messageId": "<endpoint_id>-<timestamp>",
      "interfaceVersion": "2"
    },
    "endpoint": {
      "devicePairedInfo": {
        "did": "<endpoint_id>",
        "pid": "<product_id>",
        "mac": "<mac_address>",
        "devicetypeflag": 0,
        "cookie": "<mapped_cookie_base64>"
      },
      "endpointId": "<endpoint_id>",
      "cookie": {},
      "devSession": "..."
    },
    "payload": {
      "act": "set",
      "params": ["pwr", "temp"],
      "vals": [[{"idx": 1, "val": 1}], [{"idx": 1, "val": 220}]],
      "did": "<endpoint_id>"
    }
  }
}
```

---

## Energy/Power Monitoring

This section documents how to retrieve electricity consumption data from your AC/heat pump. The API provides historical energy usage at various granularities (hourly, daily, monthly, yearly).

### Query Device Energy Statistics
```
POST /dataservice/v1/device/stats
```

**Request Body:**
```json
{
  "report": "<data_type>",
  "device": [
    {
      "did": "<endpoint_id>",
      "offset": 0,
      "step": 0,
      "param": [],
      "start": "2025-01-01",
      "end": "2025-12-31"
    }
  ]
}
```

### Available Energy Data Types

| Type | Description | Granularity |
|------|-------------|-------------|
| `fw_spminielec_v1` | Hourly electricity consumption | Hourly |
| `fw_auxoverseadayconsum_v1` | Daily consumption (overseas) | Daily |
| `fw_auxoverseamonthconsum_v1` | Monthly consumption (overseas) | Daily aggregates |
| `fw_auxoverseayearconsum_v1` | Yearly consumption (overseas) | Monthly aggregates |
| `serv_auxhourelec_v1` | Hourly consumption (domestic) | Hourly |
| `serv_auxdayelec_v1` | Daily consumption (domestic) | Daily |
| `serv_auxmonthelec_v1` | Monthly consumption (domestic) | Monthly |

**Response:**
```json
{
  "status": 0,
  "msg": "ok",
  "report": "fw_auxoverseadayconsum_v1",
  "table": [
    {
      "did": "...",
      "total": 30,
      "cnt": 30,
      "values": [
        {
          "_id": "...",
          "did": "...",
          "occurtime": "2025-12-01_00:00:00",
          "tenelec": 6.125
        }
      ]
    }
  ]
}
```

**Note:** `tenelec` is the energy consumption value in **kWh** (kilowatt-hours).

### Usage Notes for Energy Monitoring

- Use `fw_auxoversea*` types for devices outside China (EU, USA, etc.)
- Use `serv_aux*` types for devices in China
- The `start` and `end` dates determine the query range
- For yearly totals, query `fw_auxoverseayearconsum_v1` with a full year range
- Energy data may have a delay of up to 1 hour from real-time

---

## AC Device Parameters

### Power & Mode
| Parameter | Description | Values |
|-----------|-------------|--------|
| `pwr` | Power state | 0=Off, 1=On |
| `ac_mode` | Operating mode | 0=Cooling, 1=Heating, 2=Dry, 3=Fan, 4=Auto |
| `temp` | Target temperature | Integer (e.g., 230 = 23.0°C with tempunit=1) |
| `envtemp` | Ambient temperature | Integer (read-only) |
| `tempunit` | Temperature unit | 0=Fahrenheit, 1=Celsius |

### Fan & Airflow
| Parameter | Description | Values |
|-----------|-------------|--------|
| `ac_mark` | Fan speed | 0=Auto, 1=Low, 2=Mid, 3=High, 4=Turbo, 5=Mute, 6=Mid-Lower, 7=Mid-Higher |
| `ac_vdir` | Vertical swing | 0=Off, 1=On (or position values) |
| `ac_hdir` | Horizontal swing | 0=Off, 1=On (or position values) |

### Features
| Parameter | Description | Values |
|-----------|-------------|--------|
| `ecomode` | ECO mode | 0=Off, 1=On |
| `ac_health` | Health/Ionizer | 0=Off, 1=On |
| `ac_slp` | Sleep mode (built-in) | 0=Off, 1-4=Sleep curves |
| `sleepdiy` | DIY Sleep mode active | 0=Off, 1=On |
| `scrdisp` | Screen display | 0=Off, 1=On |
| `ac_clean` | Self-clean | 0=Off, 1=On |
| `childlock` | Child lock | 0=Off, 1=On |
| `mldprf` | Mildew proof | 0=Off, 1=On |
| `comfwind` | Comfortable wind | 0=Off, 1=On |
| `ac_astheat` | Auxiliary heat | 0=Off, 1=On |

### Power Limiting
| Parameter | Description | Values |
|-----------|-------------|--------|
| `pwrlimitswitch` | Power limit enabled | 0=Off, 1=On |
| `pwrlimit` | Power limit value | Integer (watts or percentage) |

### Other
| Parameter | Description | Values |
|-----------|-------------|--------|
| `err_flag` | Error flag | 0=No error |
| `ac_tempconvert` | Temperature conversion | 0=Off, 1=On |

---

## Known Product IDs

| Product ID | Device Type |
|------------|-------------|
| `000000000000000000000000c0620000` | Air Conditioner (Generic) |
| `0000000000000000000000002a4e0000` | Air Conditioner (Generic) |
| `000000000000000000000000c3aa0000` | Heat Pump |

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 0 | ok | Success |
| -1005 | 数据错误 | Data error / Invalid payload |
| -30102 | 数据错误 | Data error (GET request) |
| -30107 | 没有权限 | No permission |
| -31003 | server busy | Server busy |

---

## Cookie Structure

The device cookie (base64 decoded) contains:
```json
{
  "terminalid": "...",
  "aeskey": "..."
}
```

For control commands, map to:
```json
{
  "device": {
    "id": "<terminalid>",
    "key": "<aeskey>",
    "devSession": "...",
    "aeskey": "<aeskey>",
    "did": "<endpoint_id>",
    "pid": "<product_id>",
    "mac": "<mac_address>"
  }
}
```

---

## Rate Limiting

Recommended delays:
- Between consecutive requests: 500ms minimum
- Between control commands to same device: 1000ms minimum
- Maximum requests per minute: ~60

---

## Notes

1. **Temperature values** are typically multiplied by 10 (e.g., 230 = 23.0°C)
2. **Device state** in endpoints list: 1=Online, 0=Offline
3. **Endpoint ID format**: 32 hex characters, last 12 are MAC address (without colons)
4. **devSession** can become stale - refresh device info if commands fail
5. **Energy data** uses "overseas" types for non-China regions
