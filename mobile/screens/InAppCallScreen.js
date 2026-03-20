/**
 * In-App Call Screen
 * Audio call UI that stays inside the app
 * Uses WebSocket audio streaming (not WebRTC)
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { formatDuration } from '../src/utils/time';
import {
  getCallSession,
  subscribeToCallUpdates,
  endCall,
  CALL_STATUS,
} from '../lib/callSessionService';
import { InAppCallConnection, configureAudioMode } from '../lib/callProviders/inAppProvider';

export default function InAppCallScreen({ route, navigation }) {
  const { callSessionId, isCaller, connection: existingConnection } = route.params;
  const { user } = useAuth();
  
  const [callSession, setCallSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const connectionRef = useRef(existingConnection || null);
  const subscriptionRef = useRef(null);
  const durationTimerRef = useRef(null);

  useEffect(() => {
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (callStatus === 'connected') {
      durationTimerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callStatus]);

  const initializeCall = async () => {
    try {
      // Load call session
      const result = await getCallSession(callSessionId);
      if (!result.success) {
        Alert.alert('Error', 'Call not found');
        navigation.goBack();
        return;
      }
      
      const session = result.callSession;
      setCallSession(session);
      
      // Subscribe to updates
      subscriptionRef.current = subscribeToCallUpdates(session.id, (updated) => {
        setCallSession(updated);
        
        if (updated.status === CALL_STATUS.ENDED) {
          handleCallEnded();
        } else if (updated.status === CALL_STATUS.DECLINED) {
          handleCallDeclined();
        } else if (updated.status === CALL_STATUS.MISSED) {
          handleCallMissed();
        }
      });
      
      // If already accepted, connect
      if (session.status === CALL_STATUS.ACCEPTED) {
        await connectToCall(session);
      } else if (isCaller) {
        // Caller waits for acceptance
        setCallStatus('waiting');
        setLoading(false);
      } else {
        // Callee should have accepted already
        await connectToCall(session);
      }
    } catch (error) {
      console.error('Failed to initialize call:', error);
      Alert.alert('Error', 'Failed to initialize call');
      navigation.goBack();
    }
  };

  const connectToCall = async (session) => {
    try {
      setCallStatus('connecting');
      
      // Configure audio
      await configureAudioMode();
      
      // Create connection if not provided
      if (!connectionRef.current) {
        connectionRef.current = new InAppCallConnection(
          session.room_name,
          user?.id,
          user?.full_name || 'User'
        );
        
        // Set up callbacks
        connectionRef.current.onStatusChange = (status) => {
          setCallStatus(status);
        };
        
        connectionRef.current.onParticipantLeft = () => {
          handleRemoteLeft();
        };
        
        connectionRef.current.onError = (error) => {
          Alert.alert('Call Error', 'Connection failed');
        };
        
        // Connect
        await connectionRef.current.connect();
        await connectionRef.current.startStreaming();
      }
      
      setCallStatus('connected');
      setLoading(false);
    } catch (error) {
      console.error('Failed to connect to call:', error);
      Alert.alert('Error', 'Failed to connect to call');
      setCallStatus('error');
      setLoading(false);
    }
  };

  const handleToggleMute = async () => {
    if (!connectionRef.current) return;
    
    try {
      await connectionRef.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  };

  const handleEndCall = async () => {
    try {
      // End connection
      if (connectionRef.current) {
        await connectionRef.current.end();
      }
      
      // Update status in database
      await endCall(callSessionId);
      
      cleanup();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to end call:', error);
      navigation.goBack();
    }
  };

  const handleCallEnded = () => {
    Alert.alert('Call Ended', 'The other participant ended the call');
    cleanup();
    navigation.goBack();
  };

  const handleCallDeclined = () => {
    Alert.alert('Call Declined', 'The reporter declined the call');
    cleanup();
    navigation.goBack();
  };

  const handleCallMissed = () => {
    Alert.alert('Call Missed', 'The reporter did not answer');
    cleanup();
    navigation.goBack();
  };

  const handleRemoteLeft = () => {
    Alert.alert('Participant Left', 'The other participant left the call');
    handleEndCall();
  };

  const cleanup = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    if (connectionRef.current) {
      connectionRef.current.end();
    }
  };

  // Duration is now formatted using formatDuration utility

  const getStatusText = () => {
    switch (callStatus) {
      case 'connecting': return 'Connecting...';
      case 'waiting': return 'Waiting for answer...';
      case 'connected': return 'Connected';
      case 'error': return 'Connection Error';
      default: return callStatus;
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'connected': return '#00ff88';
      case 'waiting': return '#ffaa00';
      case 'error': return '#ff4444';
      default: return '#888';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading call...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const otherName = isCaller 
    ? (callSession?.callee_name || 'Reporter')
    : (callSession?.caller_name || 'Admin');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>In-App Call</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20', borderColor: getStatusColor() }]}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>{getStatusText()}</Text>
          </View>
        </View>

        {/* Participant Card */}
        <View style={styles.participantCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{isCaller ? '👤' : '👮'}</Text>
          </View>
          <Text style={styles.participantName}>{otherName}</Text>
          <Text style={styles.participantRole}>{isCaller ? 'Reporter' : 'Admin'}</Text>
          
          {isMuted && (
            <View style={styles.mutedBadge}>
              <Text style={styles.mutedText}>🔇 Muted</Text>
            </View>
          )}
        </View>

        {/* Duration */}
        {callStatus === 'connected' && (
          <View style={styles.durationContainer}>
            <Text style={styles.durationLabel}>Duration</Text>
            <Text style={styles.durationValue}>{formatDuration(duration)}</Text>
          </View>
        )}

        {/* Audio Indicator */}
        {callStatus === 'connected' && (
          <View style={styles.audioIndicator}>
            <Text style={styles.audioIndicatorText}>🎙️ Audio Active</Text>
          </View>
        )}

        {/* Waiting */}
        {callStatus === 'waiting' && (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Waiting for {otherName} to answer...</Text>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={handleToggleMute}
            disabled={callStatus !== 'connected'}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={handleEndCall}
          >
            <Text style={styles.endCallIcon}>📵</Text>
            <Text style={styles.endCallLabel}>End Call</Text>
          </TouchableOpacity>

          {/* Video placeholder */}
          <TouchableOpacity
            style={[styles.controlButton, styles.disabledButton]}
            disabled={true}
          >
            <Text style={styles.controlIcon}>📷</Text>
            <Text style={styles.controlLabel}>Video Off</Text>
          </TouchableOpacity>
        </View>

        {/* Incident Info */}
        {callSession && (
          <View style={styles.incidentCard}>
            <Text style={styles.incidentLabel}>INCIDENT</Text>
            <Text style={styles.incidentId}>#{callSession.incident_id?.slice(0, 8).toUpperCase()}</Text>
          </View>
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
    justifyContent: 'space-between',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  participantCard: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
  },
  participantName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  participantRole: {
    color: '#666',
    fontSize: 14,
  },
  mutedBadge: {
    backgroundColor: '#2a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 12,
  },
  mutedText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  durationContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  durationLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  durationValue: {
    color: '#00ff88',
    fontSize: 32,
    fontWeight: 'bold',
  },
  audioIndicator: {
    backgroundColor: '#1a2a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 24,
  },
  audioIndicatorText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  waitingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  waitingText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  controlButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 80,
  },
  controlButtonActive: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  disabledButton: {
    opacity: 0.5,
  },
  controlIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  controlLabel: {
    color: '#888',
    fontSize: 12,
  },
  endCallButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 80,
  },
  endCallIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  endCallLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  incidentCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
});
