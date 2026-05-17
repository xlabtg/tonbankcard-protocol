/**
 * Root navigator: a single native stack that hosts the five core screens.
 */

import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { SendPaymentScreen } from '../screens/SendPaymentScreen';
import { ReceivePaymentScreen } from '../screens/ReceivePaymentScreen';
import { TransactionHistoryScreen } from '../screens/TransactionHistoryScreen';
import { AccountSettingsScreen } from '../screens/AccountSettingsScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Home: undefined;
  SendPayment: undefined;
  ReceivePayment: undefined;
  TransactionHistory: undefined;
  AccountSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator(): React.ReactElement {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'TONBANKCARD' }} />
        <Stack.Screen name="SendPayment" component={SendPaymentScreen} options={{ title: 'Send' }} />
        <Stack.Screen
          name="ReceivePayment"
          component={ReceivePaymentScreen}
          options={{ title: 'Receive' }}
        />
        <Stack.Screen
          name="TransactionHistory"
          component={TransactionHistoryScreen}
          options={{ title: 'History' }}
        />
        <Stack.Screen
          name="AccountSettings"
          component={AccountSettingsScreen}
          options={{ title: 'Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
