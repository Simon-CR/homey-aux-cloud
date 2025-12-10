# AUX Cloud for Homey

Control your AUX Cloud-connected mini-split air conditioners and heat pumps directly from your Homey smart home hub.

## Description

This Homey app allows you to control AUX-branded and compatible mini-split air conditioning units and heat pumps that are connected to the AUX Cloud platform (also known as AC Freedom). The app integrates with the Broadlink-based AUX Cloud service to provide full climate control capabilities.

## Supported Devices

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
2. **Select Region** - Choose your region:
   - **EU** - Europe (https://app-service-deu-f0e9ebbb.smarthomecs.de)
   - **USA** - United States (https://app-service-usa-fd7cc04c.smarthomecs.com)
   - **China** - China (https://app-service-chn-31a93883.ibroadlink.com)
3. **Select Devices** - Choose which AC units you want to add to Homey
4. **Done** - Your devices are now ready to use!

### Region Selection

Make sure to select the correct region based on where you created your AUX Cloud account. If you're not sure, try the region that matches your geographic location first.

## Usage

Once configured, your AUX air conditioner will appear as a thermostat device in Homey. You can:

- **Control via Homey app** - Use the mobile or web app to control your AC
- **Use in Flows** - Create automations using the standard thermostat capabilities:
  - Turn on/off when temperature exceeds/drops below a threshold
  - Change mode based on time of day or weather conditions
  - Set target temperature based on presence detection
- **Voice Control** - Control via Google Assistant, Amazon Alexa, or other voice assistants connected to Homey

### Capabilities

- `onoff` - Turn the AC on or off
- `target_temperature` - Set the desired temperature (16-30°C)
- `measure_temperature` - Current room temperature reading
- `thermostat_mode` - Operating mode:
  - `auto` - Automatic mode
  - `cool` - Cooling mode
  - `heat` - Heating mode
  - `dry` - Dehumidification mode
  - `fan_only` - Fan only (no heating/cooling)

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

## Technical Details

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

## Credits

This app is a port of the excellent Home Assistant integration created by [@maeek](https://github.com/maeek):
- Original HA Integration: https://github.com/maeek/ha-aux-cloud
- API implementation based on reverse-engineered AUX Cloud / Broadlink protocols

Special thanks to the Home Assistant community for documenting the AUX Cloud API.

## Support

- **Issues & Bug Reports**: https://github.com/Simon-CR/homey-aux-cloud/issues
- **Home Assistant Integration**: https://github.com/maeek/ha-aux-cloud

## License

GPL-3.0 License - See LICENSE file for details

## Disclaimer

This app is not affiliated with, endorsed by, or connected to AUX, Broadlink, or any air conditioner manufacturers. All product names, logos, and brands are property of their respective owners.
