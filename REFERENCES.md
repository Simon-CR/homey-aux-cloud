# Reference Documentation

This document lists the primary sources used to develop this Homey app for AUX Cloud-connected HVAC devices.

## Primary Source Code Reference

### Home Assistant AUX Cloud Integration
- **Repository**: https://github.com/maeek/ha-aux-cloud
- **Author**: [@maeek](https://github.com/maeek)
- **Description**: The original Home Assistant custom integration for AUX Cloud devices. Our Homey app API implementation is based on this work.

Key files referenced:
- `custom_components/aux_cloud/api/aux_cloud.py` - Main API client implementation
- `custom_components/aux_cloud/api/const.py` - Parameter names and constants
- `custom_components/aux_cloud/climate.py` - Climate entity implementation
- `custom_components/aux_cloud/const.py` - Fan speed and mode mappings

## Official API Documentation

### Broadlink DNA Platform Documentation
- **API Reference**: https://docs.ibroadlink.com/public/appsdk/sdk_others/dnacontrol/
- **Description**: Official Broadlink documentation for the DNA platform which powers the AUX Cloud service

The AUX Cloud platform is built on Broadlink's DNA (Device Network Architecture) infrastructure, which provides:
- Device discovery and management
- KeyValueControl namespace for device parameters
- WebSocket for real-time updates

## API Details

### Endpoints by Region
| Region | API Server |
|--------|------------|
| EU | https://aiot-clean-eu.aux-home.com |
| USA | https://smarthomecs.com |
| China | https://aiot-clean.aux-home.com |

### Key API Parameters (ac_mark - Fan Speed)

From the HA integration (0-5) + our discovered extensions (6-7):

| Value | Name | Notes |
|-------|------|-------|
| 0 | Auto | Automatic fan speed |
| 1 | Low | Low speed |
| 2 | Medium/Mid | Medium speed |
| 3 | High | High speed |
| 4 | Turbo | Maximum speed |
| 5 | Mute | Quiet/Silent mode |
| 6 | Mid-Lower | Between Low and Mid (discovered) |
| 7 | Mid-Higher | Between Mid and High (discovered) |

*Note: Values 6-7 were discovered through testing with a heat pump device and are not documented in the HA integration.*

### Key API Parameters (ac_mode - HVAC Mode)

| Value | Mode |
|-------|------|
| 0 | Cool |
| 1 | Heat |
| 2 | Dry |
| 3 | Fan Only |
| 4 | Auto |

### Other Documented Parameters

| Parameter | Description | Values |
|-----------|-------------|--------|
| `pwr` | Power state | 0=Off, 1=On |
| `temp` | Target temperature | Value × 10 (e.g., 230 = 23.0°C) |
| `envtemp` | Ambient temperature | Value × 10 |
| `ac_vdir` | Vertical swing | 0=Off, 1=Swing |
| `ac_hdir` | Horizontal swing | 0=Off, 1=Swing |
| `ac_health` | Health/Ionizer mode | 0=Off, 1=On |
| `ac_clean` | Self-cleaning | 0=Off, 1=On |
| `ac_astheat` | Auxiliary heat | 0=Off, 1=On |
| `scrdisp` | Screen display | 0=Off, 1=On |
| `mldprf` | Mildew proof | 0=Off, 1=On |
| `ecomode` | Eco mode | 0=Off, 1=On |
| `childlock` | Child lock | 0=Off, 1=On |
| `comfwind` | Comfortable wind | 0=Off, 1=On |
| `ac_slp` | Sleep mode | 0=Off, 1=On |
| `pwrlimit` | Power limit percentage | 0-90 |
| `pwrlimitswitch` | Power limit enabled | 0=Off, 1=On |
| `tempunit` | Temperature display unit | 1=Celsius, 2=Fahrenheit |
| `sleepdiy` | Custom sleep mode | 0=Off, 1=On |

## Device Product IDs

| Product ID | Device Type |
|------------|-------------|
| `000000000000000000000000c0620000` | AC Generic |
| `0000000000000000000000002a4e0000` | AC Generic |
| `000000000000000000000000c3aa0000` | Heat Pump |

## Additional Resources

- **Broadlink AC MQTT** (LAN protocol): https://github.com/liaan/broadlink_ac_mqtt
  - Note: This uses a different LAN-based binary protocol, not the cloud API
  
## Known Issues and Workarounds

Based on issues reported in the maeek/ha-aux-cloud repository, we've implemented proactive fixes:

### Issue: Temperature/Value Reverting After Setting (maeek/ha-aux-cloud #53)
**Problem**: UI shows old value after setting a new temperature because polling reads stale data before device updates.
**Our Fix**: Added 5-second delay (`SYNC_DELAY_MS`) before syncing state after any control command to allow the device to process and update its internal state.

### Issue: Constant Disconnections and Session Errors (maeek/ha-aux-cloud #41)
**Problem**: Device becomes "unavailable" frequently due to session expiration, TypeError errors, and DNS errors.
**Our Fix**: 
- Added `_ensureLoggedIn()` for automatic re-authentication when session expires
- Wrapped API calls in `_withRetry()` with exponential backoff (3 retries)
- Fresh `devSession` and `cookie` are fetched on every sync from the device list
- Device only marked unavailable after 3 consecutive sync failures

### Issue: Commands Not Responding (maeek/ha-aux-cloud #48)
**Problem**: After errors, commands stop responding.
**Our Fix**: Retry logic with exponential backoff automatically recovers from transient failures.

### Issue: Fan Speed Changes When Turning Off (maeek/ha-aux-cloud #38)
**Problem**: When turning off from Silent mode, fan speed changes to Low. When turning off from Turbo, fan speed changes to High.
**Status**: This is **expected server-side behavior**. The device/cloud adjusts fan speed internally when powering off. This is not a bug we can fix client-side.

- **HiSense AirCon** (different platform): https://github.com/deiger/AirCon
  - Note: This is for HiSense/Ayla Networks devices, NOT AUX Cloud

## License Notes

The original HA integration by @maeek is a key reference for understanding the AUX Cloud API. This Homey implementation is an independent port designed for the Homey smart home platform.
