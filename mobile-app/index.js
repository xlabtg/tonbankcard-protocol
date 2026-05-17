/**
 * TONBANKCARD Mobile App entry point.
 *
 * Registers the root React component with React Native's AppRegistry.
 * The actual UI tree lives in `App.tsx`.
 */
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
