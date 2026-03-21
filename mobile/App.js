/**
 * Main App Entry Point
 * Initializes app with proper architecture
 */

import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator, navigate as navNavigate } from './src/navigation';
import { FullScreenLoading } from './src/components/common';
import { configService, setApiBaseUrl, getApiBaseUrl } from './src/services/apiClient';
import { apiRequest } from './src/services/apiClient';

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
  const pollingIntervalRef = useRef(null);
  const lastIncomingCallIdRef = useRef(null);

  useEffect(() => {
    // FIXED: removed navigationRef.current guard — it was always null
    if (user?.id) {
      setupRealtimeSubscriptions();
    }
    return () => {
      cleanupSubscriptions();
    };
  }, [user?.id]);

  const startIncomingCallPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log('[App] Polling for incoming calls, user:', user?.id?.slice(0, 8));
        const res = await apiRequest('/call/incoming', { method: 'GET' });
        const callSession = res?.data?.callSession;
        console.log('[App] Poll result:', callSession ? { id: callSession.id?.slice(0, 8), caller: callSession.caller_name } : null);
        if (!callSession?.id) return;
        if (lastIncomingCallIdRef.current === callSession.id) return;
        lastIncomingCallIdRef.current = callSession.id;
        console.log('[App] Navigating to IncomingCall screen');
        // FIXED: use navNavigate instead of navigationRef.current.navigate
        navNavigate('IncomingCall', { callSessionId: callSession.id, user });
      } catch (err) {
        console.log('[App] Poll error:', err?.message);
      }
    }, 2500);
  };

  const setupRealtimeSubscriptions = async () => {
    try {
      // Incoming calls via Supabase realtime
      incomingCallSubscription.current = subscribeToIncomingCalls(
        user.id,
        (callSession) => {
          console.log('[App] Incoming call:', callSession);
          // FIXED: use navNavigate instead of navigationRef.current.navigate
          navNavigate('IncomingCall', { callSessionId: callSession.id, user });
        }
      );

      // Polling fallback - only for users who can receive calls (citizens/reporters)
      if (user.role === 'citizen' || user.role === 'reporter') {
        startIncomingCallPolling();
      }

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
            navNavigate('IncomingCall', { callSessionId: data.callSessionId, user });
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
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    lastIncomingCallIdRef.current = null;
    if (notificationSubscriptions.current) {
      removeNotificationListeners(notificationSubscriptions.current);
    }
  };

  // FIXED: no ref needed on RootNavigator since we use navNavigate
  return <RootNavigator />;
}