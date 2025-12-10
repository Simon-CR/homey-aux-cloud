# Image Requirements for AUX Cloud Homey App

This app requires several PNG images to be created according to Homey's specifications.

## Required App Images (assets/images/)

- **small.png**: 250 x 175 pixels - App icon for small displays
- **large.png**: 500 x 350 pixels - App icon for medium displays  
- **xlarge.png**: 1000 x 700 pixels - App icon for large displays

## Required Driver Images (drivers/aux-ac/assets/images/)

- **small.png**: 75 x 75 pixels - Device icon for small displays
- **large.png**: 500 x 500 pixels - Device icon for medium displays
- **xlarge.png**: 1000 x 1000 pixels - Device icon for large displays

## Design Guidelines

- Use transparent backgrounds
- Feature the AUX brand color (#00A9E0)
- Include air conditioner or climate control iconography
- Keep designs simple and recognizable at all sizes
- Maximum file size: 5 MB per image

## Temporary Solution

For development and testing, you can:
1. Use the provided icon.svg as a reference
2. Convert the SVG to PNG at the required sizes using tools like:
   - ImageMagick: `convert -background none -size 250x175 icon.svg small.png`
   - Online converters
   - Design tools (Figma, Inkscape, GIMP, etc.)

## Alternative

The Homey CLI may auto-generate placeholders during development, but proper images should be created for production release.
