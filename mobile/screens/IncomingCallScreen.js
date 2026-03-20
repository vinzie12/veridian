/**
 * Incoming Call Screen
 * Shown to reporter when they receive an incoming call
 * Displays caller info and accept/decline buttons
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { formatTime } from '../src/utils/time';
import {
  subscribeToCallUpdates,
  acceptCall,
  declineCall,
  getCallSession,
  joinCallByMode,
  CALL_STATUS,
  CALL_MODE,
} from '../lib/callSessionService';

export default function IncomingCallScreen({ route, navigation }) {
  const { callSessionId } = route.params;
  const { user } = useAuth();
  
  const [callSession, setCallSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(60);
  
  const ringAnimation = useRef(new Animated.Value(0)).current;
  const subscriptionRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    loadCallSession();
    startRingAnimation();
    
    return () => {
      cleanup();
    };
  }, []);

  // Update timer based on expires_at
  useEffect(() => {
    if (callSession?.expires_at) {
      const expiry = new Date(callSession.expires_at).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeRemaining(remaining);
      
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Call missed - timeout
            handleMissed();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callSession?.expires_at]);

  // Subscribe to call updates
  useEffect(() => {
    if (callSession?.id) {
      subscriptionRef.current = subscribeToCallUpdates(callSession.id, (updatedSession) => {
        setCallSession(updatedSession);
        
        // Handle status changes
        if (updatedSession.status === CALL_STATUS.CANCELLED) {
          // Caller cancelled - go back
          navigation.goBack();
        } else if (updatedSession.status === CALL_STATUS.MISSED) {
          // Call missed - go back
          navigation.goBack();
        }
      });
    }
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [callSession?.id]);

  const loadCallSession = async () => {
    try {
      const result = await getCallSession(callSessionId);
      if (result.success) {
        setCallSession(result.callSession);
        
        // If not ringing anymore, handle accordingly
        if (result.callSession.status !== CALL_STATUS.RINGING) {
          handleExistingStatus(result.callSession);
        }
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to load call session:', error);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleExistingStatus = (session) => {
    if (session.status === CALL_STATUS.ACCEPTED) {
      // Already accepted - join the call
      handleJoinCall(session);
    } else {
      // Declined, missed, cancelled, or ended - go back
      navigation.goBack();
    }
  };

  const startRingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnimation, {
          toValue: 1,
          duration: 500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnimation, {
          toValue: 0,
          duration: 500,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const ringScale = ringAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const handleAccept = async () => {
    if (processing) return;
    setProcessing(true);
    
    try {
      const result = await acceptCall(callSessionId);
      
      if (result.success) {
        // Join the call based on mode
        await handleJoinCall(result.callSession);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept call');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Failed to accept call:', error);
      Alert.alert('Error', 'Failed to accept call');
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (processing) return;
    setProcessing(true);
    
    try {
      await declineCall(callSessionId);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to decline call:', error);
      navigation.goBack();
    }
  };

  const handleMissed = async () => {
    cleanup();
    navigation.goBack();
  };

  const handleJoinCall = async (session) => {
    try {
      const result = await joinCallByMode(session, user);
      
      if (result.success) {
        if (session.call_mode === CALL_MODE.JITSI) {
          // Jitsi opens browser, navigate back or stay
          navigation.goBack();
        } else {
          // In-app call - navigate to InAppCallScreen
          navigation.replace('InAppCall', {
            callSessionId: session.id,
            isCaller: false,
            connection: result.connection,
          });
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to join call');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Failed to join call:', error);
      Alert.alert('Error', 'Failed to join call');
      setProcessing(false);
    }
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
  };

  // Timer is now formatted using formatTime utility

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading call...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!callSession) {
    return null;
  }

  const callerName = callSession.caller_name || 'Admin';
  const callModeLabel = callSession.call_mode === CALL_MODE.JITSI ? 'Jitsi Browser Call' : 'In-App Call';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Ring Animation */}
        <Animated.View style={[styles.ringContainer, { transform: [{ scale: ringScale }] }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>📞</Text>
          </View>
        </Animated.View>

        {/* Caller Info */}
        <Text style={styles.title}>Incoming Call</Text>
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callMode}>{callModeLabel}</Text>

        {/* Timer */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerLabel}>Time remaining</Text>
          <Text style={styles.timerValue}>{formatTime(timeRemaining)}</Text>
        </View>

        {/* Incident Info */}
        <View style={styles.incidentCard}>
          <Text style={styles.incidentLabel}>INCIDENT</Text>
          <Text style={styles.incidentId}>#{callSession.incident_id?.slice(0, 8).toUpperCase()}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Decline Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={handleDecline}
            disabled={processing}
          >
            <Text style={styles.actionIcon}>📵</Text>
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>

          {/* Accept Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAccept}
            disabled={processing}
          >
            <Text style={styles.actionIcon}>📞</Text>
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>

        {/* Processing Indicator */}
        {processing && (
          <Text style={styles.processingText}>Connecting...</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ringContainer: {
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a3a2a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00ff88',
  },
  avatarText: {
    fontSize: 48,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  callerName: {
    color: '#00ff88',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  callMode: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
  },
  timerContainer: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  timerLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  timerValue: {
    color: '#ff6600',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  incidentCard: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 32,
    alignItems: 'center',
  },
  incidentLabel: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  incidentId: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 32,
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
  },
  actionIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  declineButton: {
    backgroundColor: '#2a1a1a',
    borderRadius: 50,
    width: 100,
    height: 100,
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#1a2a1a',
    borderRadius: 50,
    width: 100,
    height: 100,
    justifyContent: 'center',
  },
  declineText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  acceptText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  processingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 24,
  },
});
