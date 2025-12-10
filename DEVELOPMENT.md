# Development Guide

## Prerequisites

- Node.js v16 or higher
- npm v7 or higher
- Homey CLI (optional, for app testing): `npm install -g homey`
- A Homey Pro device (for testing)
- AUX Cloud account with at least one AC device

## Installation

```bash
# Clone the repository
git clone https://github.com/Simon-CR/homey-aux-cloud.git
cd homey-aux-cloud

# Install dependencies
npm install
```

## Project Structure

```
homey-aux-cloud/
├── .homeycompose/          # Compose configuration
│   └── app.json           # App metadata
├── assets/                # App-level assets
│   └── IMAGES_README.md   # Image requirements
├── drivers/               # Device drivers
│   └── aux-ac/           # AUX AC driver
│       ├── assets/       # Driver assets
│       │   └── icon.svg  # Device icon
│       ├── device.js     # Device logic
│       ├── driver.js     # Driver logic
│       └── driver.compose.json
├── lib/                  # Shared libraries
│   └── AuxCloudAPI.js    # API client
├── locales/              # Translations
│   └── en.json          # English strings
├── app.js               # App entry point
├── app.json             # Generated manifest
└── package.json         # Node.js config
```

## Development Workflow

### 1. Making Code Changes

When editing code, focus on these key files:

- **lib/AuxCloudAPI.js** - API communication logic
- **drivers/aux-ac/device.js** - Device control and state management
- **drivers/aux-ac/driver.js** - Pairing and device discovery

### 2. Testing Locally

```bash
# Validate JSON files
npm run validate  # (if script exists)

# Or manually:
node -e "JSON.parse(require('fs').readFileSync('app.json', 'utf8'))"

# Check JavaScript syntax
node -c app.js
node -c lib/AuxCloudAPI.js
node -c drivers/aux-ac/driver.js
node -c drivers/aux-ac/device.js
```

### 3. Testing on Homey

Install the Homey CLI:
```bash
npm install -g homey
```

Login to your Homey:
```bash
homey login
```

Run the app on your Homey:
```bash
homey app run
```

View logs:
```bash
homey app log
```

### 4. Debugging

Enable debug logging by checking the Homey app logs:
```bash
homey app log
```

Add debug statements in your code:
```javascript
this.log('Debug message');
this.error('Error message', error);
```

## API Testing

You can test the API client independently:

```javascript
const { AuxCloudAPI } = require('./lib/AuxCloudAPI');

async function test() {
  const api = new AuxCloudAPI('eu');
  
  // Login
  await api.login('your-email@example.com', 'your-password');
  
  // Get families
  const families = await api.getFamilies();
  console.log('Families:', families);
  
  // Get devices
  const devices = await api.getDevices(families[0].familyid);
  console.log('Devices:', devices);
}

test().catch(console.error);
```

## Common Development Tasks

### Adding a New Capability

1. Add capability to `drivers/aux-ac/driver.compose.json`:
```json
"capabilities": [
  "onoff",
  "target_temperature",
  "your_new_capability"
]
```

2. Add listener in `drivers/aux-ac/device.js`:
```javascript
this.registerCapabilityListener('your_new_capability', this.onCapabilityYourNew.bind(this));
```

3. Implement handler:
```javascript
async onCapabilityYourNew(value) {
  // Your logic here
}
```

### Updating State Sync

Modify `syncDeviceState()` in `drivers/aux-ac/device.js` to handle new parameters.

### Adding Region Support

Update `lib/AuxCloudAPI.js` with new region URLs in the `API_SERVERS` object.

## Testing Checklist

Before submitting changes:

- [ ] All JavaScript files have valid syntax
- [ ] All JSON files are valid
- [ ] Code follows existing patterns
- [ ] Error handling is present
- [ ] Logging is appropriate
- [ ] Tested on real Homey hardware
- [ ] Tested with real AUX device
- [ ] Documentation updated

## Known Issues & Limitations

1. **Session Conflicts**: Logging into Homey logs out the mobile app session
2. **Polling Delay**: Up to 30 seconds for state updates
3. **Region Selection**: Currently defaults to EU
4. **Offline Devices**: Not queryable during pairing

## Troubleshooting

### "Login Failed"
- Verify credentials in AUX Cloud mobile app
- Check region selection
- Ensure internet connectivity

### "Device Not Found"
- Ensure device is online in mobile app
- Check device is in a family/home
- Verify product ID is in supported list

### "Failed to Control Device"
- Check device is online
- Verify session is still valid
- Check API response in logs

## Resources

- [Homey Apps SDK](https://apps.developer.homey.app/)
- [Homey SDK v3 API Reference](https://apps-sdk-v3.developer.homey.app/)
- [Original HA Integration](https://github.com/maeek/ha-aux-cloud)
- [AUX Cloud API Docs](https://github.com/maeek/ha-aux-cloud/blob/main/aux_cloud_api_usage.ipynb)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

- GitHub Issues: https://github.com/Simon-CR/homey-aux-cloud/issues
- Homey Community Forum: (to be created after release)

## License

GPL-3.0
