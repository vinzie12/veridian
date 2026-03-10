import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import * as Location from 'expo-location';
import axios from 'axios';

const API_URL = 'http://192.168.254.100:3000';

const INCIDENT_TYPES = [
  { type: 'fire', label: 'FIRE', icon: '🔥', color: '#FF3300' },
  { type: 'medical', label: 'MEDICAL', icon: '🚑', color: '#0066FF' },
  { type: 'police', label: 'POLICE', icon: '🚔', color: '#0044CC' }
];

const SEVERITIES = [
  { level: 'critical', label: 'CRITICAL', color: '#FF0000' },
  { level: 'high', label: 'HIGH', color: '#FF6600' },
  { level: 'medium', label: 'MEDIUM', color: '#FFAA00' },
  { level: 'low', label: 'LOW', color: '#00CC44' }
];

export default function QuickReportScreen({ route, navigation }) {
  const { token, user } = route.params;
  const [incidentType, setIncidentType] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleSubmit = async () => {
    if (!incidentType || !severity) {
      Alert.alert('Required', 'Please select incident type and severity');
      return;
    }

    setSubmitting(true);
    setGettingLocation(true);

    let latitude = null;
    let longitude = null;
    let address = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 5000
        });
        latitude = location.coords.latitude;
        longitude = location.coords.longitude;

        const geocode = await Location.reverseGeocodeAsync({
          latitude,
          longitude
        });
        if (geocode.length > 0) {
          const g = geocode[0];
          address = `${g.street || ''} ${g.city || ''} ${g.region || ''}`.trim();
        }
      }
    } catch (err) {
      console.log('Location error:', err);
    }

    setGettingLocation(false);

    try {
      const response = await axios.post(
        `${API_URL}/incidents`,
        { incident_type: incidentType, severity, latitude, longitude, address },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const incident = response.data.incident;
      navigation.replace('Confirmation', {
        token,
        user,
        incident: {
            id: incident.id.slice(0, 8).toUpperCase(),
            type: incidentType,
            severity,
            address: address || 'GPS Unavailable',
            time: new Date().toLocaleTimeString()
        }
        });
    } catch (error) {
      Alert.alert('Error', 'Failed to submit incident. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.title}>QUICK REPORT</Text>
        </View>

        {/* Incident Type */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INCIDENT TYPE</Text>
          <View style={styles.typeGrid}>
            {INCIDENT_TYPES.map(item => (
              <TouchableOpacity
                key={item.type}
                style={[
                  styles.typeButton,
                  { borderColor: item.color },
                  incidentType === item.type && { backgroundColor: item.color }
                ]}
                onPress={() => setIncidentType(item.type)}
              >
                <Text style={styles.typeIcon}>{item.icon}</Text>
                <Text style={[
                  styles.typeLabel,
                  incidentType === item.type && { color: '#fff' }
                ]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SEVERITY</Text>
          <View style={styles.severityGrid}>
            {SEVERITIES.map(item => (
              <TouchableOpacity
                key={item.level}
                style={[
                  styles.severityButton,
                  { borderColor: item.color },
                  severity === item.level && { backgroundColor: item.color }
                ]}
                onPress={() => setSeverity(item.level)}
              >
                <Text style={[
                  styles.severityLabel,
                  severity === item.level && { color: '#fff' }
                ]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* GPS Notice */}
        <View style={styles.gpsNotice}>
          <Text style={styles.gpsText}>
            📍 GPS location will be captured automatically on submit
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!incidentType || !severity) && styles.submitBtnDisabled
          ]}
          onPress={handleSubmit}
          disabled={submitting || !incidentType || !severity}
        >
          {submitting ? (
            <View style={styles.submittingRow}>
              <ActivityIndicator color="#0a0a0a" />
              <Text style={styles.submitText}>
                {gettingLocation ? '  GETTING GPS...' : '  SUBMITTING...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.submitText}>⚡ SUBMIT INCIDENT</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  back: { color: '#00ff88', fontSize: 14, marginRight: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 3 },
  section: { padding: 20 },
  sectionLabel: {
    color: '#666', fontSize: 11,
    fontWeight: 'bold', letterSpacing: 2, marginBottom: 16
  },
  typeGrid: { flexDirection: 'row', gap: 12 },
  typeButton: {
    flex: 1, borderWidth: 2, borderRadius: 12,
    padding: 20, alignItems: 'center', gap: 8
  },
  typeIcon: { fontSize: 36 },
  typeLabel: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  severityGrid: { gap: 10 },
  severityButton: {
    borderWidth: 2, borderRadius: 10,
    padding: 18, alignItems: 'center'
  },
  severityLabel: { color: '#888', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 },
  gpsNotice: {
    marginHorizontal: 20, padding: 16,
    backgroundColor: '#1a1a1a', borderRadius: 8
  },
  gpsText: { color: '#666', fontSize: 12, textAlign: 'center' },
  submitBtn: {
    backgroundColor: '#00ff88', margin: 20,
    padding: 22, borderRadius: 12, alignItems: 'center'
  },
  submitBtnDisabled: { backgroundColor: '#1a1a1a' },
  submitText: { color: '#0a0a0a', fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
  submittingRow: { flexDirection: 'row', alignItems: 'center' }
});