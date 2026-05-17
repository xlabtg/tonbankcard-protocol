/**
 * Minimal React Native type stubs for the platform-agnostic build.
 *
 * The full `react-native` package is intentionally NOT installed in this
 * scaffold because the iOS/Android binaries require Xcode and Gradle. These
 * stubs declare only the public surface the scaffold screens reference so the
 * scaffold can be type-checked, linted, and unit-tested in any node
 * environment.
 *
 * Developers building the actual iOS/Android binaries replace these stubs
 * with the real React Native install (see `mobile-app/README.md` →
 * "Building the iOS/Android binaries"). The real install is a drop-in
 * superset of these declarations.
 */
declare module 'react-native' {
  import type {
    ComponentType,
    ReactNode,
    Ref,
  } from 'react';

  export interface ViewStyle {
    [key: string]: string | number | undefined;
  }
  export interface TextStyle extends ViewStyle {
    color?: string;
    fontSize?: number;
    fontWeight?: string;
  }
  export interface ImageStyle extends ViewStyle {}

  export type StyleProp<T> = T | T[] | null | undefined | false;

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: ReactNode;
    testID?: string;
    accessible?: boolean;
    accessibilityLabel?: string;
    onLayout?: (event: unknown) => void;
  }
  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: ReactNode;
    numberOfLines?: number;
    testID?: string;
    accessibilityLabel?: string;
  }
  export interface ScrollViewProps extends ViewProps {
    horizontal?: boolean;
    contentContainerStyle?: StyleProp<ViewStyle>;
    refreshControl?: ReactNode;
  }
  export interface PressableProps extends ViewProps {
    onPress?: () => void;
    disabled?: boolean;
    accessibilityRole?: string;
  }
  export interface TextInputProps {
    style?: StyleProp<TextStyle>;
    value?: string;
    placeholder?: string;
    onChangeText?: (text: string) => void;
    keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    secureTextEntry?: boolean;
    testID?: string;
    ref?: Ref<unknown>;
  }
  export interface SwitchProps {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    testID?: string;
  }
  export interface FlatListProps<TItem> extends ViewProps {
    data: readonly TItem[];
    keyExtractor?: (item: TItem, index: number) => string;
    renderItem: (info: { item: TItem; index: number }) => ReactNode;
    ListEmptyComponent?: ComponentType | ReactNode;
    onRefresh?: () => void;
    refreshing?: boolean;
  }

  export const View: ComponentType<ViewProps>;
  export const Text: ComponentType<TextProps>;
  export const ScrollView: ComponentType<ScrollViewProps>;
  export const Pressable: ComponentType<PressableProps>;
  export const TextInput: ComponentType<TextInputProps>;
  export const Switch: ComponentType<SwitchProps>;
  export const ActivityIndicator: ComponentType<ViewProps & { size?: 'small' | 'large'; color?: string }>;
  export const SafeAreaView: ComponentType<ViewProps>;
  export const Image: ComponentType<ViewProps & { source: { uri: string } | number }>;
  export class FlatList<TItem = unknown> {
    constructor(props: FlatListProps<TItem>);
    render(): ReactNode;
  }

  export const StyleSheet: {
    create<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(styles: T): T;
    flatten(style: StyleProp<ViewStyle | TextStyle | ImageStyle>): ViewStyle & TextStyle & ImageStyle;
    hairlineWidth: number;
  };

  export const Platform: {
    OS: 'ios' | 'android' | 'web' | 'macos' | 'windows';
    select<T>(spec: { ios?: T; android?: T; default?: T }): T | undefined;
    Version: string | number;
  };

  export const Linking: {
    openURL(url: string): Promise<void>;
    canOpenURL(url: string): Promise<boolean>;
    addEventListener(type: 'url', handler: (event: { url: string }) => void): { remove(): void };
    getInitialURL(): Promise<string | null>;
  };

  export const Alert: {
    alert(title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>): void;
  };

  export const Clipboard: {
    setString(content: string): void;
    getString(): Promise<string>;
  };

  export const Share: {
    share(content: { message?: string; url?: string; title?: string }): Promise<{ action: string }>;
  };

  export const Dimensions: {
    get(dim: 'window' | 'screen'): { width: number; height: number; scale: number; fontScale: number };
  };
}

declare module '@react-navigation/native' {
  import type { ComponentType, ReactNode } from 'react';
  export const NavigationContainer: ComponentType<{ children?: ReactNode }>;
  export function useNavigation<T = unknown>(): T;
  export function useRoute<T = unknown>(): T;
}

declare module '@react-navigation/native-stack' {
  import type { ComponentType, ReactNode } from 'react';
  export interface NativeStackNavigationOptions {
    title?: string;
    headerShown?: boolean;
    headerStyle?: { backgroundColor?: string };
  }
  export function createNativeStackNavigator<T = Record<string, object | undefined>>(): {
    Navigator: ComponentType<{ initialRouteName?: keyof T; screenOptions?: NativeStackNavigationOptions; children?: ReactNode }>;
    Screen: ComponentType<{ name: keyof T; component: ComponentType<unknown>; options?: NativeStackNavigationOptions }>;
  };
}

declare module 'react-native-safe-area-context' {
  import type { ComponentType, ReactNode } from 'react';
  export const SafeAreaProvider: ComponentType<{ children?: ReactNode }>;
  export function useSafeAreaInsets(): { top: number; right: number; bottom: number; left: number };
}

declare module 'react-native-keychain' {
  export interface KeychainOptions {
    service?: string;
    accessControl?: string;
    accessible?: string;
    authenticationPrompt?: { title?: string; subtitle?: string; description?: string; cancel?: string };
  }
  export interface UserCredentials {
    username: string;
    password: string;
    service?: string;
  }
  export const ACCESS_CONTROL: {
    BIOMETRY_ANY: string;
    BIOMETRY_CURRENT_SET: string;
    BIOMETRY_ANY_OR_DEVICE_PASSCODE: string;
  };
  export const ACCESSIBLE: {
    WHEN_UNLOCKED: string;
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: string;
    AFTER_FIRST_UNLOCK: string;
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: string;
  };
  export function setGenericPassword(username: string, password: string, options?: KeychainOptions): Promise<false | { service: string; storage: string }>;
  export function getGenericPassword(options?: KeychainOptions): Promise<false | UserCredentials>;
  export function resetGenericPassword(options?: KeychainOptions): Promise<boolean>;
}

declare module 'react-native-biometrics' {
  export type BiometryType = 'TouchID' | 'FaceID' | 'Biometrics';
  export interface BiometricsSensorAvailability {
    available: boolean;
    biometryType?: BiometryType;
    error?: string;
  }
  export interface SimplePromptResult {
    success: boolean;
    error?: string;
  }
  export default class ReactNativeBiometrics {
    constructor(options?: { allowDeviceCredentials?: boolean });
    isSensorAvailable(): Promise<BiometricsSensorAvailability>;
    simplePrompt(options: { promptMessage: string; cancelButtonText?: string }): Promise<SimplePromptResult>;
  }
}

declare module 'react-native-camera' {
  import type { ComponentType, ReactNode } from 'react';
  export interface BarCodeReadEvent {
    type: string;
    data: string;
  }
  export interface RNCameraProps {
    style?: unknown;
    type?: 'front' | 'back';
    onBarCodeRead?: (event: BarCodeReadEvent) => void;
    captureAudio?: boolean;
    children?: ReactNode;
  }
  export const RNCamera: ComponentType<RNCameraProps>;
}
