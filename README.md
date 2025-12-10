# AUX Cloud for Homey

Control your AUX Cloud-connected mini-split air conditioners and heat pumps directly from your Homey smart home hub.

## Description

This Homey app allows you to control AUX-branded and compatible mini-split air conditioning units and heat pumps that are connected to the AUX Cloud platform (also known as AC Freedom). The app integrates with the Broadlink-based AUX Cloud service to provide full climate control capabilities.

## ⚠️ Supported Device Types

**This app is designed specifically for HVAC climate control devices:**

### ✅ Supported Devices

| Device Type | Product IDs | Status |
|-------------|-------------|--------|
| **Mini-Split Air Conditioners** | `c0620000`, `2a4e0000` | ✅ Full Support |
| **Heat Pumps (Climate Control)** | `c3aa0000` | ✅ Full Support |

### ❌ NOT Supported

The Broadlink DNA platform (used by AUX Cloud) also connects other device types that are **NOT supported** by this app:

- Dehumidifiers
- Air purifiers
- Smart plugs/switches
- Lighting controls
- Other non-HVAC devices

If your device uses the AUX Cloud / AC Freedom app but is not a mini-split AC or heat pump, it will not work with this Homey app.

## Compatible Brands

This app works with various mini-split brands that use the AUX Cloud platform, including:

- **AUX** - Air conditioners and heat pumps
- **Various OEM/rebranded units** - Many brands use the Broadlink-based AUX Cloud service, including some models from:
  - Dunham
  - Rcool
  - Akai
  - Rinnai
  - Kenwood
  - Tornado
  - Ballu
  - And other brands using the AC Freedom / AUX Cloud app

If your air conditioner uses the "AC Freedom" or "AUX Cloud" mobile app, it should work with this Homey app.

## Features

- **Power Control** - Turn your AC unit on/off
- **Temperature Control** - Set target temperature (16-30°C)
- **Current Temperature** - View current room temperature
- **Mode Selection** - Choose between Auto, Cool, Heat, Dry, and Fan Only modes
- **Automatic State Sync** - Device state is polled every 30 seconds to keep Homey in sync
- **Multi-Region Support** - Works with EU, USA, and China AUX Cloud servers

## Installation

1. Install the app from the Homey App Store or install manually
2. Go to Devices → Add Device → AUX Cloud
3. Follow the pairing wizard

## Configuration

### Pairing Your Devices

1. **Login** - Enter your AUX Cloud account credentials (the same email and password you use in the AUX Cloud or AC Freedom mobile app)
2. **Select Devices** - Choose which AC units you want to add to Homey
3. **Done** - Your devices are now ready to use!

**Note**: The app currently defaults to the EU region. If you're in the USA or China, you may need to contact support for region configuration assistance.

### Region Selection

The app defaults to the EU region server. If you need to use a different region (USA or China), this will need to be configured manually by editing the device settings after pairing.

## Usage

Once configured, your AUX air conditioner will appear as a thermostat device in Homey. You can:

- **Control via Homey app** - Use the mobile or web app to control your AC
- **Use in Flows** - Create automations using the standard thermostat capabilities:
  - Turn on/off when temperature exceeds/drops below a threshold
  - Change mode based on time of day or weather conditions
  - Set target temperature based on presence detection
- **Voice Control** - Control via Google Assistant, Amazon Alexa, or other voice assistants connected to Homey

### Capabilities

The app exposes these capabilities based on what your specific device supports:

**Core Capabilities (All Devices):**
- `onoff` - Turn the AC on or off
- `target_temperature` - Set the desired temperature (16-30°C)
- `measure_temperature` - Current room temperature reading
- `thermostat_mode` - Operating mode (auto, cool, heat, dry, fan_only)

**Extended Capabilities (Device-Dependent):**
- `fan_speed` - Fan speed (auto, low, medium, high, turbo, mute)
- `airco_vertical` - Vertical swing/airflow direction (see [Swing Position Support](#swing-position-support))
- `airco_horizontal` - Horizontal swing/airflow direction (see [Swing Position Support](#swing-position-support))
- `eco_mode` - Energy saving mode
- `health_mode` - Health/ionizer function
- `sleep_mode` - Sleep mode for quieter nighttime operation
- `display_light` - Screen display on/off
- `self_cleaning` - Self-cleaning function
- `child_lock` - Child lock to prevent tampering
- `mildew_proof` - Mildew prevention mode
- `comfortable_wind` - Comfortable wind mode
- `auxiliary_heat` - Auxiliary/electric heating
- `power_limit` - Power consumption limit (0-90%)
- `power_limit_enabled` - Enable/disable power limit
- `temperature_unit` - Celsius/Fahrenheit display
- `error_status` - Current error status (read-only)

> **Note:** Not all devices support all capabilities. The app automatically detects which features your specific device supports and only shows those controls.

### Swing Position Support

The vertical and horizontal swing controls support two modes depending on your AC unit's capabilities:

**All Units Support:**
- `Fixed` - Vanes stay in a fixed position (not moving)
- `Swing` - Vanes continuously oscillate

**Some Units Also Support Fixed Positions:**
- Vertical: Up, Upper, Middle, Lower, Down
- Horizontal: Left, Left-Center, Center, Right-Center, Right

**Automatic Detection:** When you first add a device, the app tests whether your unit supports fixed vane positions:

1. If the current vane setting is already a position (2-6), positions are supported
2. Otherwise, the app briefly sets position 2, checks if the device accepts it, then restores the original setting
3. The detection result is stored and displayed in the device settings under "Feature Support"

Units that don't support positions will only show the "Fixed" and "Swing" options in the picker.

## Troubleshooting

### Device Not Found During Pairing

- Make sure your AC unit is online in the AUX Cloud mobile app
- Verify you're using the correct region
- Try logging out and back into the AUX Cloud mobile app

### Device Shows as Unavailable

- Check that your AC unit is powered on and connected to WiFi
- Verify the unit appears as online in the AUX Cloud mobile app
- Check your Homey's internet connection
- Try removing and re-adding the device

### Commands Not Working

- Ensure the AC unit is online (not showing as unavailable in Homey)
- Check that you can control the device from the AUX Cloud mobile app
- The app polls device state every 30 seconds - allow some time for sync
- Try restarting the Homey app

### Login Issues

- Double-check your email and password
- Ensure you're selecting the correct region
- Try logging into the AUX Cloud mobile app to verify your credentials
- Some regions may have temporary service disruptions
- If you see "Too many attempts", wait 5-10 minutes before trying again

## Technical Details

### Rate Limiting

The AUX Cloud API enforces rate limits to prevent abuse. This app includes built-in protection:

| Action | Limit | Notes |
|--------|-------|-------|
| Login attempts | 10 second cooldown | Between each attempt |
| API requests | 1 second cooldown | Between each request |
| Rate limit backoff | 5+ minutes | After receiving a rate limit error |
| Device polling | 30 seconds | Standard state refresh interval |

**If you get rate limited:**
- Wait at least 5 minutes before trying again
- Repeated rate limits increase the backoff exponentially (up to 1 hour)
- A successful login resets the backoff counter

> **Note:** The exact API rate limits are not publicly documented by Broadlink. These values are conservative estimates based on the Home Assistant integration behavior.

### API Communication

This app communicates with the AUX Cloud API using the following approach:

- **Authentication** - MD5/SHA1 hashed credentials with AES-128-CBC encryption
- **Session Management** - Maintains login sessions and automatically re-authenticates when needed
- **Device Control** - Uses the DNA.KeyValueControl namespace for sending commands
- **State Polling** - Queries device state every 30 seconds

### Known Limitations

- The app requires an active internet connection to function (cloud-based control only)
- Some advanced features available in the mobile app may not be implemented yet
- Device state updates may take up to 30 seconds to reflect in Homey
- Logging into Homey will log out your session in the AUX Cloud mobile app (and vice versa)

## Contributing: Adding New Device Types

The AUX Cloud / Broadlink DNA platform supports many device types beyond mini-split ACs. If you have an unsupported device and want to help add support, here's how:

### Step 1: Report Your Device

During pairing, the app logs unsupported devices. You can find the product ID in the Homey app logs. Please report it by opening an issue with:

- **Device name/model**
- **Product ID** (32-character hex string like `000000000000000000000000c0620000`)
- **Device type** (dehumidifier, air purifier, plug, etc.)
- **Screenshots** of available controls in the AUX Cloud mobile app

### Step 2: Device Registry

New devices can be added to the `DEVICE_REGISTRY` in `lib/AuxCloudAPI.js`:

```javascript
'000000000000000000000000XXXXXXXX': {
  type: 'DEHUMIDIFIER',
  name: 'Dehumidifier',
  class: 'fan',
  driver: 'aux-dehumidifier',
  supported: true
}
```

### Known Product IDs

| Product ID | Device Type | Status |
|------------|-------------|--------|
| `c0620000` | Mini-Split AC | ✅ Supported |
| `2a4e0000` | Mini-Split AC | ✅ Supported |
| `c3aa0000` | Heat Pump | ✅ Supported |

Help us expand this list by reporting your devices!

## Credits

This app is a port of the excellent Home Assistant integration created by [@maeek](https://github.com/maeek):
- Original HA Integration: https://github.com/maeek/ha-aux-cloud
- API implementation based on reverse-engineered AUX Cloud / Broadlink protocols

Special thanks to the Home Assistant community for documenting the AUX Cloud API.

## API Documentation

For developers and integrators, we provide comprehensive API documentation:

📖 **[API_REFERENCE.md](./API_REFERENCE.md)** - Complete AUX Cloud API reference including:
- Authentication & encryption details
- Device control endpoints
- Energy consumption data queries
- All AC parameters and their values

This documentation can help you build your own integrations for platforms like Home Assistant, OpenHAB, Node-RED, or custom smart home solutions.

## Support

- **Issues & Bug Reports**: https://github.com/Simon-CR/homey-aux-cloud/issues
- **Home Assistant Integration**: https://github.com/maeek/ha-aux-cloud

## License

GPL-3.0 License - See LICENSE file for details

## Disclaimer

This app is not affiliated with, endorsed by, or connected to AUX, Broadlink, or any air conditioner manufacturers. All product names, logos, and brands are property of their respective owners.
