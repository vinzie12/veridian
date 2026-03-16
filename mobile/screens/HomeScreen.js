import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

import { API_URL } from '../lib/supabase';

const SEVERITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFAA00',
  low: '#00CC44'
};

const INCIDENT_ICONS = {
  fire: '🔥',
  medical: '🚑',
  police: '🚔'
};

export default function HomeScreen({ route, navigation }) {
  const { token, user } = route.params;
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const response = await axios.get(`${API_URL}/incidents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIncidents(response.data.incidents);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, []);

  const renderIncident = ({ item }) => (
    <View style={styles.incidentCard}>
      <View style={styles.incidentLeft}>
        <Text style={styles.incidentIcon}>{INCIDENT_ICONS[item.incident_type]}</Text>
      </View>
      <View style={styles.incidentMiddle}>
        <Text style={styles.incidentType}>{item.incident_type.toUpperCase()}</Text>
        <Text style={styles.incidentAddress}>{item.address || 'No address'}</Text>
        <Text style={styles.incidentTime}>
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
      </View>
      <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[item.severity] }]}>
        <Text style={styles.severityText}>{item.severity.toUpperCase()}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>VERIDIAN</Text>
          <Text style={styles.welcome}>Welcome, {user.full_name}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.agencyBadge}>
            <Text style={styles.agencyText}>{user.role.toUpperCase()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings', { user })}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Incidents List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACTIVE INCIDENTS</Text>
        {loading ? (
          <ActivityIndicator color="#00ff88" size="large" style={{ marginTop: 40 }} />
        ) : incidents.length === 0 ? (
          <Text style={styles.emptyText}>No active incidents</Text>
        ) : (
          <FlatList
            data={incidents}
            keyExtractor={item => item.id}
            renderItem={renderIncident}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Quick Report Button */}
      <TouchableOpacity
        style={styles.quickReportBtn}
        onPress={() => navigation.navigate('QuickReport', { token, user })}
      >
        <Text style={styles.quickReportText}>⚡ QUICK REPORT</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#00ff88', letterSpacing: 4 },
  welcome: { fontSize: 12, color: '#666', marginTop: 2 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  agencyBadge: {
    backgroundColor: '#1a1a1a',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00ff88'
  },
  agencyText: { color: '#00ff88', fontSize: 10, fontWeight: 'bold' },
  settingsBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#1a1a1a'
  },
  settingsIcon: { fontSize: 18 },
  section: { flex: 1, padding: 20 },
  sectionTitle: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16
  },
  emptyText: { color: '#333', fontSize: 16, textAlign: 'center', marginTop: 40 },
  incidentCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  incidentLeft: { marginRight: 12 },
  incidentIcon: { fontSize: 28 },
  incidentMiddle: { flex: 1 },
  incidentType: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  incidentAddress: { color: '#888', fontSize: 12, marginTop: 2 },
  incidentTime: { color: '#444', fontSize: 11, marginTop: 4 },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  severityText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  quickReportBtn: {
    backgroundColor: '#00ff88',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  quickReportText: {
    color: '#0a0a0a',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2
  }
});