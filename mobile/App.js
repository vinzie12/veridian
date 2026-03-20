/**
 * Main App Entry Point
 * Initializes app with proper architecture
 */

import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator, setNavigationRef } from './src/navigation';
import { FullScreenLoading } from './src/components/common';
import { configService, setApiBaseUrl, getApiBaseUrl } from './src/services/apiClient';

// Import existing services
import { loadSupabaseConfig, supabase, clearStaleTokens } from './lib/supabase';
import { subscribeToIncomingCalls } from './lib/callSessionService';
import { 
  registerForPushNotifications, 
  setupNotificationListeners,
  removeNotificationListeners 
} from './lib/notificationService';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('[App] Initializing...');

      // Load config from backend (sets API URL internally)
      // This also clears stale tokens before creating Supabase client
      const configLoaded = await loadSupabaseConfig();
      
      if (!configLoaded) {
        throw new Error('Failed to load configuration from server');
      }

      console.log('[App] Config loaded, API URL:', getApiBaseUrl());
      console.log('[App] Initialized successfully');
      
      setIsReady(true);
    } catch (err) {
      console.error('[App] Initialization failed:', err);
      setError(err.message);
      setIsReady(true);
    }
  };

  // Show loading screen during initialization
  if (!isReady) {
    return <FullScreenLoading message="Starting Veridian..." />;
  }

  // Show error if initialization failed
  if (error) {
    return (
      <SafeAreaProvider>
        <FullScreenLoading message={`Error: ${error}`} />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * App Content - sets up realtime subscriptions after auth
 */
function AppContent() {
  const { user } = useAuth();
  const incomingCallSubscription = useRef(null);
  const notificationSubscriptions = useRef(null);
  const navigationRef = useRef(null);

  useEffect(() => {
    if (user?.id && navigationRef.current) {
      setupRealtimeSubscriptions();
    }

    return () => {
      cleanupSubscriptions();
    };
  }, [user?.id]);

  const setupRealtimeSubscriptions = async () => {
    try {
      // Incoming calls
      incomingCallSubscription.current = subscribeToIncomingCalls(
        user.id,
        (callSession) => {
          console.log('[App] Incoming call:', callSession);
          if (navigationRef.current) {
            navigationRef.current.navigate('IncomingCall', {
              callSessionId: callSession.id,
              user,
            });
          }
        }
      );

      // Push notifications
      await registerForPushNotifications(user.id);
      
      notificationSubscriptions.current = setupNotificationListeners(
        (notification) => {
          const data = notification.request.content.data;
          if (data?.type === 'incoming_call') {
            console.log('[App] Call notification received');
          }
        },
        (response) => {
          const data = response.notification.request.content.data;
          if (data?.type === 'incoming_call' && data?.callSessionId) {
            if (navigationRef.current) {
              navigationRef.current.navigate('IncomingCall', {
                callSessionId: data.callSessionId,
                user,
              });
            }
          }
        }
      );
    } catch (err) {
      console.error('[App] Failed to setup subscriptions:', err);
    }
  };

  const cleanupSubscriptions = () => {
    if (incomingCallSubscription.current) {
      incomingCallSubscription.current.unsubscribe();
    }
    if (notificationSubscriptions.current) {
      removeNotificationListeners(notificationSubscriptions.current);
    }
  };

  return (
    <RootNavigator
      ref={(ref) => {
        navigationRef.current = ref;
        setNavigationRef(ref);
      }}
    />
  );
}