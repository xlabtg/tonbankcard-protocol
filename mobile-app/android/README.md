# Android build

The `mobile-app/android/` directory contains the Android-specific configuration
for the React Native wrapper. It targets **Android 8.0 (SDK 26) and up** as
required by issue #137.

## Package name

```
app.tonbankcard.mobile
```

Update the value in `app/build.gradle` and `app/src/main/AndroidManifest.xml`
if you fork the project.

## Building the APK / AAB

1. Install JavaScript dependencies from the `mobile-app/` directory:

   ```bash
   npm install
   ```

2. Install the Android SDK + JDK 17.

3. Build a debug APK:

   ```bash
   npx react-native run-android
   ```

4. Build a signed release AAB for Play Console:

   ```bash
   cd android
   ./gradlew bundleRelease
   ```

   Provide the release keystore via `gradle.properties`:

   ```properties
   TONBANKCARD_RELEASE_KEYSTORE=tonbankcard.release.keystore
   TONBANKCARD_RELEASE_STORE_PASSWORD=…
   TONBANKCARD_RELEASE_KEY_ALIAS=tonbankcard
   TONBANKCARD_RELEASE_KEY_PASSWORD=…
   ```

   **Never** commit keystores or passwords to source control.

## Permissions

The manifest requests `CAMERA`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, and
`INTERNET`. Camera and biometrics are runtime permissions and the app must
prompt the user before use.

## Play Console internal-testing checklist

- [ ] Increment `versionCode` in `app/build.gradle`.
- [ ] Build signed AAB (`./gradlew bundleRelease`).
- [ ] Upload to Play Console → Internal testing.
- [ ] Provide app content rating and data-safety form.
