import { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import HomeScreen from './screens/HomeScreen';
import CitizenHomeScreen from './screens/CitizenHomeScreen';
import QuickReportScreen from './screens/QuickReportScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';
import TrackReportScreen from './screens/TrackReportScreen';
import IncidentDetailScreen from './screens/IncidentDetailScreen';
import SettingsScreen from './screens/SettingsScreen';
import VerificationCallScreen from './screens/VerificationCallScreen';
import IncomingCallScreen from './screens/IncomingCallScreen';
import InAppCallScreen from './screens/InAppCallScreen';
import { loadSupabaseConfig, supabase } from './lib/supabase';
import { subscribeToIncomingCalls } from './lib/callSessionService';
import { 
  registerForPushNotifications, 
  setupNotificationListeners,
  removeNotificationListeners 
} from './lib/notificationService';

const Stack = createStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const navigationRef = useRef(null);
  const incomingCallSubscription = useRef(null);
  const notificationSubscriptions = useRef(null);

  useEffect(() => {
    initializeApp();
    
    return () => {
      // Cleanup subscriptions on unmount
      if (incomingCallSubscription.current) {
        incomingCallSubscription.current.unsubscribe();
      }
      if (notificationSubscriptions.current) {
        removeNotificationListeners(notificationSubscriptions.current);
      }
    };
  }, []);

  useEffect(() => {
    // Subscribe to incoming calls when user is set
    if (user?.id && navigationRef.current) {
      setupIncomingCallListener();
      setupNotifications();
    }
    
    return () => {
      if (incomingCallSubscription.current) {
        incomingCallSubscription.current.unsubscribe();
      }
      if (notificationSubscriptions.current) {
        removeNotificationListeners(notificationSubscriptions.current);
      }
    };
  }, [user?.id]);

  const initializeApp = async () => {
    try {
      // Load Supabase config from backend
      await loadSupabaseConfig();
      
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      
      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null);
      });
      
      setIsReady(true);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setIsReady(true);
    }
  };

  const setupIncomingCallListener = () => {
    if (!user?.id) return;
    
    incomingCallSubscription.current = subscribeToIncomingCalls(
      user.id,
      (callSession) => {
        console.log('Incoming call received:', callSession);
        navigateToIncomingCall(callSession);
      }
    );
  };

  const setupNotifications = async () => {
    if (!user?.id) return;
    
    // Register for push notifications
    await registerForPushNotifications(user.id);
    
    // Set up notification listeners
    notificationSubscriptions.current = setupNotificationListeners(
      // On notification received (foreground)
      (notification) => {
        const data = notification.request.content.data;
        if (data?.type === 'incoming_call') {
          // Call session will be received via realtime subscription
          console.log('Call notification received');
        }
      },
      // On notification response (tap)
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'incoming_call' && data?.callSessionId) {
          // Navigate to incoming call screen
          navigateToIncomingCall({ id: data.callSessionId });
        }
      }
    );
  };

  const navigateToIncomingCall = (callSession) => {
    if (navigationRef.current) {
      navigationRef.current.navigate('IncomingCall', {
        callSessionId: callSession.id,
        user,
      });
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CitizenHome" component={CitizenHomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="QuickReport" component={QuickReportScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TrackReport" component={TrackReportScreen} options={{ headerShown: false }} />
        <Stack.Screen name="IncidentDetail" component={IncidentDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="VerificationCall" component={VerificationCallScreen} options={{ headerShown: false }} />
        <Stack.Screen name="IncomingCall" component={IncomingCallScreen} options={{ headerShown: false }} />
        <Stack.Screen name="InAppCall" component={InAppCallScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}