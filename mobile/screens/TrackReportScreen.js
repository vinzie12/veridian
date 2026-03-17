import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { API_URL } from '../lib/supabase';
import { styles } from './styles/QuickReportScreenStyles';

const SEVERITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFAA00',
  low: '#00CC44'
};

const STATUS_COLORS = {
  pending: '#FFAA00',
  pending_review: '#FFAA00',
  acknowledged: '#0066FF',
  en_route: '#0066FF',
  on_scene: '#0066FF',
  resolved: '#00CC44',
  closed: '#666666',
  cancelled: '#666666'
};

export default function TrackReportScreen({ navigation }) {
  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [incident, setIncident] = useState(null);

  const handleTrack = async () => {
    if (!trackingId.trim()) {
      Alert.alert('Error', 'Please enter your tracking ID');
      return;
    }

    setLoading(true);
    setIncident(null);

    try {
      const response = await axios.get(`${API_URL}/incidents/public/${trackingId.trim().toUpperCase()}`);
      setIncident(response.data.incident);
      Keyboard.dismiss();
    } catch (error) {
      const message = error.response?.data?.error || 'Incident not found. Check your tracking ID.';
      Alert.alert('Not Found', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Report</Text>
        </View>

        {/* Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ENTER YOUR TRACKING ID</Text>
          <TextInput
            style={[styles.input, { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, fontSize: 18, letterSpacing: 2 }]}
            placeholder="e.g. A7X9K2M4"
            placeholderTextColor="#444"
            value={trackingId}
            onChangeText={setTrackingId}
            autoCapitalize="characters"
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: '#00ff88' }]}
            onPress={handleTrack}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={[styles.submitButtonText, { color: '#0a0a0a' }]}>TRACK REPORT</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Result Section */}
        {incident && (
          <View style={styles.section}>
            <View style={[styles.card, { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20 }]}>
              {/* Status Badge */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: '#00ff88', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 }}>
                  #{incident.tracking_id}
                </Text>
                <View style={[styles.severityBadge, { backgroundColor: STATUS_COLORS[incident.status] || '#666', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                    {(incident.status || 'unknown').toUpperCase().replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: '#333', marginBottom: 16 }} />

              {/* Details */}
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={{ fontSize: 24 }}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 }}>LOCATION</Text>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
                      {incident.address || 'Location recorded'}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={{ fontSize: 24 }}>⚠️</Text>
                  <View>
                    <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 }}>SEVERITY</Text>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
                      {(incident.severity || 'unknown').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Text style={{ fontSize: 24 }}>🕐</Text>
                  <View>
                    <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 }}>REPORTED</Text>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
                      {new Date(incident.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>

                {incident.updated_at && incident.updated_at !== incident.created_at && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Text style={{ fontSize: 24 }}>🔄</Text>
                    <View>
                      <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 }}>LAST UPDATED</Text>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
                        {new Date(incident.updated_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Status Info */}
            <View style={{ marginTop: 16, padding: 16, backgroundColor: '#141414', borderRadius: 12 }}>
              <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
                {incident.status === 'pending_review' && '⏳ Your report is being reviewed by dispatchers.'}
                {incident.status === 'acknowledged' && '✅ Your report has been acknowledged and is being addressed.'}
                {incident.status === 'en_route' && '🚨 Responders are on their way.'}
                {incident.status === 'on_scene' && '🚨 Responders are on scene working on your report.'}
                {incident.status === 'resolved' && '✓ Your report has been resolved.'}
                {incident.status === 'closed' && '📋 Your report has been closed.'}
              </Text>
            </View>
          </View>
        )}

        {/* Back to Login */}
        <TouchableOpacity
          style={[styles.homeBtn, { marginTop: 'auto' }]}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.homeBtnText}>BACK TO LOGIN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
