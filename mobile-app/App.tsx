/**
 * Root React Native component for TONBANKCARD.
 *
 * Wires the navigator into the safe-area provider. No business logic lives
 * here — every screen consumes the platform-agnostic `src/lib` layer.
 */

import * as React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}
