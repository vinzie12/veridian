import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { API_URL } from '../lib/supabase';
import { styles } from './styles/QuickReportScreenStyles';

import { STATUS_COLORS, STATUS_ICONS } from '../constants';

const SEVERITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFAA00',
  low: '#00CC44'
};

export default function IncidentDetailScreen({ route, navigation }) {
  const { token, incidentId, user } = route.params;
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const isCitizen = user?.role === 'citizen';

  useEffect(() => {
    fetchIncident();
  }, []);

  const fetchIncident = async () => {
    try {
      const response = await axios.get(`${API_URL}/incidents/${incidentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIncident(response.data.incident);
    } catch (error) {
      console.error('Failed to fetch incident:', error);
      Alert.alert('Error', 'Failed to load incident details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await axios.patch(`${API_URL}/incidents/${incidentId}`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIncident({ ...incident, status: newStatus });
      Alert.alert('Success', `Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const openMap = () => {
    if (incident?.latitude && incident?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${incident.latitude},${incident.longitude}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open maps');
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#00ff88" size="large" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!incident) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Incident Details</Text>
        </View>

        {/* Status Badge */}
        <View style={[styles.card, { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20, marginBottom: 16 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 32 }}>{incident.incident_icon || '⚠️'}</Text>
              <View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                  {(incident.incident_type || 'Unknown').toUpperCase()}
                </Text>
                <Text style={{ color: '#666', fontSize: 12 }}>
                  #{incident.id?.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={[styles.severityBadge, { backgroundColor: STATUS_COLORS[incident.status] || '#666', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }]}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                {(incident.status || 'unknown').toUpperCase().replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Severity */}
        <View style={[styles.card, { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 }]}>
          <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 }}>SEVERITY</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: SEVERITY_COLORS[incident.severity] || '#666' }} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
              {(incident.severity || 'unknown').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Location */}
        <TouchableOpacity 
          style={[styles.card, { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 }]}
          onPress={openMap}
        >
          <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 }}>LOCATION</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 24 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                {incident.address || 'No address recorded'}
              </Text>
              {incident.latitude && incident.longitude && (
                <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
                  {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}
                </Text>
              )}
            </View>
            <Text style={{ color: '#00ff88', fontSize: 12 }}>OPEN MAP →</Text>
          </View>
        </TouchableOpacity>

        {/* Description */}
        {incident.description && (
          <View style={[styles.card, { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 }]}>
            <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 }}>DESCRIPTION</Text>
            <Text style={{ color: '#fff', fontSize: 14, lineHeight: 22 }}>
              {incident.description}
            </Text>
          </View>
        )}

        {/* Timestamps */}
        <View style={[styles.card, { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 }]}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 20 }}>🕐</Text>
              <View>
                <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 }}>REPORTED</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                  {new Date(incident.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
            {incident.updated_at && incident.updated_at !== incident.created_at && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 20 }}>🔄</Text>
                <View>
                  <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 }}>LAST UPDATED</Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                    {new Date(incident.updated_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Reporter Contact (if anonymous) */}
        {incident.extra_fields?.reporter_contact && (
          <View style={[styles.card, { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 }]}>
            <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 }}>REPORTER CONTACT</Text>
            <Text style={{ color: '#fff', fontSize: 14 }}>{incident.extra_fields.reporter_contact}</Text>
          </View>
        )}

        {/* Status Actions - Only for non-citizens */}
        {!isCitizen && (
          <View style={[styles.card, { backgroundColor: '#141414', borderRadius: 12, padding: 16, marginBottom: 20 }]}>
            <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 12 }}>UPDATE STATUS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['pending_review', 'acknowledged', 'en_route', 'on_scene', 'resolved', 'closed'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={{
                    backgroundColor: incident.status === status ? STATUS_COLORS[status] : '#1a1a1a',
                    borderWidth: 1,
                    borderColor: STATUS_COLORS[status] || '#333',
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    opacity: updating ? 0.5 : 1
                  }}
                  onPress={() => updateStatus(status)}
                  disabled={updating || incident.status === status}
                >
                  <Text style={{ 
                    color: incident.status === status ? '#fff' : STATUS_COLORS[status], 
                    fontSize: 11, 
                    fontWeight: 'bold' 
                  }}>
                    {status.toUpperCase().replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Wi-Fi Calling - Only for non-citizens */}
        {!isCitizen && (
          <View style={[styles.card, { backgroundColor: '#141414', borderRadius: 12, padding: 16, marginBottom: 20, alignItems: 'center' }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📞</Text>
            <Text style={{ color: '#666', fontSize: 14, fontWeight: 'bold' }}>WI-FI CALLING</Text>
            <Text style={{ color: '#444', fontSize: 11, marginTop: 4 }}>Coming Soon</Text>
          </View>
        )}
        
        {/* Citizen Status Info */}
        {isCitizen && (
          <View style={[styles.card, { backgroundColor: '#141414', borderRadius: 12, padding: 16, marginBottom: 20 }]}>
            <Text style={{ color: '#444', fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginBottom: 12 }}>REPORT STATUS</Text>
            <View style={{ alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 48 }}>{STATUS_ICONS[incident.status] || '📋'}</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                {(incident.status || 'unknown').toUpperCase().replace('_', ' ')}
              </Text>
              <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
                {incident.status === 'pending_review' && 'Your report is being reviewed by responders'}
                {incident.status === 'acknowledged' && 'Responders have acknowledged your report'}
                {incident.status === 'en_route' && 'Help is on the way!'}
                {incident.status === 'on_scene' && 'Responders are on scene'}
                {incident.status === 'resolved' && 'This incident has been resolved'}
                {incident.status === 'closed' && 'This incident has been closed'}
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
