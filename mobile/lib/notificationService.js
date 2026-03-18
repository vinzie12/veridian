/**
 * Notification Service
 * Handles push notifications for incoming calls
 * Uses expo-notifications for cross-platform support
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase, API_URL } from './supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request permissions
export const requestNotificationPermissions = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }
  
  return true;
};

// Get Expo push token
export const getExpoPushToken = async () => {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }
  
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'ba2befdf-eb29-43fb-9a48-5a6daff9fb2b', // From app.json
    });
    
    return token.data;
  } catch (error) {
    // Firebase not configured - push notifications won't work on Android
    // but app should still function
    console.log('Push notifications not available:', error.message);
    return null;
  }
};

// Save push token to Supabase user profile
export const savePushToken = async (userId, token) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);
    
    if (error) throw error;
    
    console.log('Push token saved');
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
};

// Register for push notifications
export const registerForPushNotifications = async (userId) => {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;
  
  const token = await getExpoPushToken();
  if (token && userId) {
    await savePushToken(userId, token);
  }
  
  return token;
};

// Send notification via backend (called by Supabase trigger or Edge Function)
export const sendCallNotification = async (calleeId, callSessionId, callerName) => {
  try {
    // This would typically be called from backend/Edge Function
    // Here we call our Express backend which then sends the notification
    const response = await fetch(`${API_URL}/notifications/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        calleeId,
        callSessionId,
        callerName,
        type: 'incoming_call',
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
};

// Notification listener setup
export const setupNotificationListeners = (onNotification, onResponse) => {
  // Received notification while app is foregrounded
  const receivedSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log('Notification received:', notification);
      if (onNotification) {
        onNotification(notification);
      }
    }
  );
  
  // User tapped on notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      console.log('Notification response:', response);
      if (onResponse) {
        onResponse(response);
      }
    }
  );
  
  return {
    received: receivedSubscription,
    response: responseSubscription,
  };
};

// Remove notification listeners
export const removeNotificationListeners = (subscriptions) => {
  if (subscriptions?.received) {
    Notifications.removeNotificationSubscription(subscriptions.received);
  }
  if (subscriptions?.response) {
    Notifications.removeNotificationSubscription(subscriptions.response);
  }
};

// Schedule local notification (for testing)
export const scheduleLocalNotification = async (title, body, data = {}) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null, // Immediately
  });
};

export default {
  requestNotificationPermissions,
  getExpoPushToken,
  savePushToken,
  registerForPushNotifications,
  sendCallNotification,
  setupNotificationListeners,
  removeNotificationListeners,
  scheduleLocalNotification,
};
