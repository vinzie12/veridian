import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { incidentService } from '../src/services/apiClient';
import { styles } from './styles/TrackReportScreenStyles';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { formatDate } from '../src/utils/time';

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
      const response = await incidentService.getPublic(trackingId.trim().toUpperCase());
      setIncident(response.incident);
      Keyboard.dismiss();
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Incident not found. Check your tracking ID.';
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
            style={styles.trackingInput}
            placeholder="e.g. A7X9K2M4"
            placeholderTextColor="#444"
            value={trackingId}
            onChangeText={setTrackingId}
            autoCapitalize="characters"
            maxLength={8}
          />
          <TouchableOpacity
            style={styles.trackButton}
            onPress={handleTrack}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.trackButtonText}>TRACK REPORT</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Result Section */}
        {incident && (
          <View style={styles.section}>
            <View style={styles.resultCard}>
              {/* Status Badge */}
              <View style={styles.cardHeader}>
                <Text style={styles.trackingIdText}>#{incident.tracking_id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[incident.status] || '#666' }]}>
                  <Text style={styles.statusText}>
                    {STATUS_LABELS[incident.status] || incident.status || 'UNKNOWN'}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Details */}
              <View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>📍</Text>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>LOCATION</Text>
                    <Text style={styles.detailValue}>
                      {incident.address || 'Location recorded'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>⚠️</Text>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>SEVERITY</Text>
                    <Text style={styles.detailValue}>
                      {(incident.severity || 'unknown').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>🕐</Text>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>REPORTED</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(incident.created_at)}
                    </Text>
                  </View>
                </View>

                {incident.updated_at && incident.updated_at !== incident.created_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailIcon}>🔄</Text>
                    <View style={styles.detailContent}>
                      <Text style={styles.detailLabel}>LAST UPDATED</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(incident.updated_at)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Status Info */}
            <View style={styles.statusInfo}>
              <Text style={styles.statusInfoText}>
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
          style={styles.homeButton}
          onPress={() => navigation.replace('Login')}
        >
          <Text style={styles.homeButtonText}>BACK TO LOGIN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
