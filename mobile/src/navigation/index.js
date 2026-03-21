/**
 * Navigation Configuration
 * Centralized navigation with auth guards
 */

import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text } from 'react-native';

import { useAuth } from '../context/AuthContext';

// Screens (will be lazy loaded)
import LoginScreen from '../../screens/LoginScreen';
import SignupScreen from '../../screens/SignupScreen';
import HomeScreen from '../../screens/HomeScreen';
import CitizenHomeScreen from '../../screens/CitizenHomeScreen';
import QuickReportScreen from '../../screens/QuickReportScreen';
import ConfirmationScreen from '../../screens/ConfirmationScreen';
import TrackReportScreen from '../../screens/TrackReportScreen';
import IncidentDetailScreen from '../../screens/IncidentDetailScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import VerificationCallScreen from '../../screens/VerificationCallScreen';
import IncomingCallScreen from '../../screens/IncomingCallScreen';
import InAppCallScreen from '../../screens/InAppCallScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * Auth Loading Screen
 */
const AuthLoadingScreen = () => (
  <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#00ff88" />
    <Text style={{ color: '#00ff88', marginTop: 16 }}>Loading...</Text>
  </View>
);

/**
 * Auth Stack (unauthenticated routes)
 */
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: '#0a0a0a' },
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen 
      name="QuickReport" 
      component={QuickReportScreen}
      initialParams={{ token: null, user: null }}
    />
    <Stack.Screen name="TrackReport" component={TrackReportScreen} />
  </Stack.Navigator>
);

/**
 * Responder Tab Navigator
 */
const ResponderTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#0a0a0a',
        borderTopColor: '#1a1a1a',
        borderTopWidth: 1,
      },
      tabBarActiveTintColor: '#00ff88',
      tabBarInactiveTintColor: '#666',
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Incidents: '📋',
          QuickReport: '⚡',
          Settings: '⚙️',
        };
        return <Text style={{ fontSize: size }}>{icons[route.name] || '📄'}</Text>;
      },
    })}
  >
    <Tab.Screen name="Incidents" component={HomeScreen} />
    <Tab.Screen name="QuickReport" component={QuickReportScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

/**
 * Citizen Tab Navigator
 */
const CitizenTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#0a0a0a',
        borderTopColor: '#1a1a1a',
        borderTopWidth: 1,
      },
      tabBarActiveTintColor: '#00ff88',
      tabBarInactiveTintColor: '#666',
      tabBarIcon: ({ color, size }) => {
        const icons = {
          Home: '🏠',
          QuickReport: '⚡',
          Track: '🔍',
          Settings: '⚙️',
        };
        return <Text style={{ fontSize: size }}>{icons[route.name] || '📄'}</Text>;
      },
    })}
  >
    <Tab.Screen name="Home" component={CitizenHomeScreen} />
    <Tab.Screen name="QuickReport" component={QuickReportScreen} />
    <Tab.Screen name="Track" component={TrackReportScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

/**
 * Main Stack (authenticated routes)
 */
const MainStack = () => {
  const { user } = useAuth();
  
  // Route based on user role
  const HomeTabs = user?.role === 'citizen' ? CitizenTabs : ResponderTabs;
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
      <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} />
      <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
      <Stack.Screen name="VerificationCall" component={VerificationCallScreen} />
      <Stack.Screen name="IncomingCall" component={IncomingCallScreen} />
      <Stack.Screen name="InAppCall" component={InAppCallScreen} />
    </Stack.Navigator>
  );
};

/**
 * Root Navigator with Auth Guard
 */
export const RootNavigator = () => {
  const { isLoading, isLoggedIn, user } = useAuth();

  // Show loading screen while checking auth
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isLoggedIn && user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

/**
 * Navigation reference for imperative navigation
 */
export const navigationRef = createNavigationContainerRef();

export const navigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  } else {
    console.warn('[Navigation] Cannot navigate - ref not ready');
  }
};

export const reset = (state) => {
  if (navigationRef.isReady()) {
    navigationRef.reset(state);
  }
};

export const goBack = () => {
  if (navigationRef.isReady()) {
    navigationRef.goBack();
  }
};

export default RootNavigator;
