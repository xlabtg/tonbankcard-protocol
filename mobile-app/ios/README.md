# iOS build

The `mobile-app/ios/` directory contains the iOS-specific configuration for
the React Native wrapper. It targets **iOS 14+** as required by issue #137.

## Bundle identifier

```
app.tonbankcard.mobile
```

Update the value in `tonbankcard/Info.plist` and Xcode signing settings if you
fork the project for a different distribution.

## Building the binary

1. Install JavaScript dependencies from the `mobile-app/` directory:

   ```bash
   npm install
   ```

2. Install CocoaPods (one-off):

   ```bash
   sudo gem install cocoapods
   ```

3. Install native pods:

   ```bash
   cd ios && pod install && cd -
   ```

4. Build via React Native:

   ```bash
   npx react-native run-ios
   ```

5. Open `ios/tonbankcard.xcworkspace` in Xcode to configure signing and submit
   to TestFlight.

## Permissions

The Info.plist declares user-facing strings for camera, Face ID, and photo
library access. These usage descriptions are mandatory for App Store review.

## TestFlight checklist

- [ ] Update `CFBundleShortVersionString` and `CFBundleVersion`.
- [ ] Sign with a distribution provisioning profile.
- [ ] Archive in Xcode (`Product → Archive`) and upload via Organizer.
- [ ] Submit for external testing in App Store Connect.
