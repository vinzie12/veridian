import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import {
  getJitsiMeetUrl,
  fetchCallInfo,
  notifyCallStarted,
  notifyCallEnded
} from '../lib/callService';

export default function VerificationCallScreen({ route, navigation }) {
  const { incidentId, user, token, callerName, reporterName } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const [error, setError] = useState(null);
  const [browserRef, setBrowserRef] = useState(null);

  const isHost = user?.role === 'admin';
  const displayName = isHost ? callerName : reporterName;

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Check for active call
        const callInfo = await fetchCallInfo(incidentId, user?.role, token);
        setHasActiveCall(callInfo.hasActiveCall);

        setLoading(false);
      } catch (err) {
        console.error('Init error:', err);
        setError(err?.message || 'Failed to initialize call');
        setLoading(false);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      if (browserRef) {
        WebBrowser.dismissBrowser();
      }
      notifyCallEnded(incidentId, token);
    };
  }, []);

  // Join call - opens Jitsi Meet in browser
  const handleJoinCall = async () => {
    try {
      // Notify backend that call started
      await notifyCallStarted(incidentId, token);
      
      // Get Jitsi Meet URL
      const jitsiUrl = getJitsiMeetUrl(incidentId, displayName || user?.full_name, true);
      
      console.log('Opening Jitsi Meet:', jitsiUrl);
      
      // Open in system browser (works better for WebRTC)
      const supported = await Linking.canOpenURL(jitsiUrl);
      if (supported) {
        await Linking.openURL(jitsiUrl);
      } else {
        // Fallback to expo-web-browser
        const result = await WebBrowser.openBrowserAsync(jitsiUrl, {
          enableBarCollapsing: true,
          showTitle: true,
          toolbarColor: '#0a0a0a',
        });
        setBrowserRef(result);
      }
      
      // Navigate back after opening call
      // User will return to app via back button or call end
    } catch (err) {
      console.error('Join error:', err);
      Alert.alert('Error', 'Failed to open call. Please try again.');
    }
  };

  // Share call link (for reporter to join)
  const handleShareLink = async () => {
    const roomName = `veridian-${incidentId?.slice(0, 8)}`;
    const shareUrl = `https://meet.jit.si/${roomName}`;
    
    try {
      const { isAvailable } = await import('expo-sharing');
      if (isAvailable) {
        // Copy to clipboard instead
        await import('expo-clipboard').then(Clipboard => 
          Clipboard.default.setStringAsync(shareUrl)
        );
        Alert.alert('Link Copied', `Share this link with the caller:\n\n${shareUrl}`);
      }
    } catch {
      Alert.alert('Call Link', `Join the call at:\n\n${shareUrl}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#00ff88" size="large" />
          <Text style={styles.loadingText}>Initializing call...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Call Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Pre-join screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.preJoinContainer}>
        <Text style={styles.headerTitle}>Verification Call</Text>
        <Text style={styles.subTitle}>
          {isHost ? 'Call the incident reporter' : 'Join the verification call'}
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>INCIDENT</Text>
          <Text style={styles.infoValue}>#{incidentId?.slice(0, 8)?.toUpperCase()}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>CALL MODE</Text>
          <Text style={styles.infoValue}>{isHost ? 'Host (Admin)' : 'Guest (Reporter)'}</Text>
        </View>

        <View style={styles.audioOnlyBadge}>
          <Text style={styles.audioOnlyText}>🎧 Audio Call via Jitsi Meet</Text>
        </View>

        {hasActiveCall && (
          <View style={styles.activeCallBadge}>
            <Text style={styles.activeCallText}>📞 Active call in progress</Text>
          </View>
        )}

        <TouchableOpacity style={styles.joinButton} onPress={handleJoinCall}>
          <Text style={styles.joinButtonText}>
            {isHost ? '📞 Start Call' : '📞 Join Call'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButton} onPress={handleShareLink}>
          <Text style={styles.shareButtonText}>📋 Copy Call Link</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <Text style={styles.infoBoxTitle}>How it works:</Text>
          <Text style={styles.infoBoxText}>
            1. Tap "Start/Join Call" to open Jitsi Meet{'\n'}
            2. Allow microphone access when prompted{'\n'}
            3. Wait for the other person to join{'\n'}
            4. Tap the red phone to end the call
          </Text>
        </View>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
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
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#ff4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  preJoinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subTitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
  },
  infoLabel: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  infoValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  audioOnlyBadge: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 16,
  },
  audioOnlyText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeCallBadge: {
    backgroundColor: '#0a2a1a',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  activeCallText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  joinButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    marginBottom: 12,
  },
  joinButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  shareButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 24,
  },
  shareButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  infoBoxTitle: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoBoxText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
  },
});
