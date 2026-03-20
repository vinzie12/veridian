import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { useAuth } from '../src/context/AuthContext';
import { incidentService } from '../src/services/apiClient';
import { 
  SEVERITY_COLORS, STATUS_COLORS, STATUS_ICONS, 
  STATUS_LABELS, INCIDENT_ICONS 
} from '../constants';

const STATUS_FILTERS = ['all', 'pending_review', 'acknowledged', 'en_route', 'on_scene', 'resolved', 'closed'];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [allIncidents, setAllIncidents] = useState([]); // Store all incidents for counting
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const isFocused = useIsFocused();

  // Calculate counts per status from all incidents
  const statusCounts = useMemo(() => {
    const counts = { all: allIncidents.length };
    allIncidents.forEach(incident => {
      const status = incident.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [allIncidents]);

  const fetchIncidents = async () => {
    try {
      // Fetch all incidents for counting
      const allResponse = await incidentService.list({});
      const allIncidentsData = allResponse?.data || [];
      setAllIncidents(allIncidentsData);

      // If specific status selected, filter locally for exact match
      if (selectedStatus !== 'all') {
        const filtered = allIncidentsData.filter(
          inc => inc.status === selectedStatus
        );
        setIncidents(filtered);
      } else {
        setIncidents(allIncidentsData);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      setLoading(true);
      fetchIncidents();
    }
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, [isFocused, selectedStatus]);

  const renderStatusBadge = (status) => {
    const isSelected = selectedStatus === status;
    const count = statusCounts[status] || 0;
    const color = status === 'all' ? '#00ff88' : (STATUS_COLORS[status] || '#666');
    const icon = status === 'all' ? '📊' : (STATUS_ICONS[status] || '❓');
    const label = status === 'all' ? 'ALL' : (STATUS_LABELS[status] || status.toUpperCase());

    return (
      <TouchableOpacity
        key={status}
        style={styles.statusBadge}
        onPress={() => setSelectedStatus(status)}
        activeOpacity={0.7}
      >
        {/* Ring with icon */}
        <View style={[
          styles.statusRing,
          isSelected && { borderColor: color, shadowColor: color, shadowOpacity: 0.8, shadowRadius: 8 },
          !isSelected && { borderColor: '#333', opacity: 0.6 }
        ]}>
          <Text style={styles.statusIcon}>{icon}</Text>
          
          {/* Count bubble */}
          {count > 0 && (
            <View style={[styles.countBubble, { backgroundColor: color }]}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}
        </View>
        
        {/* Label */}
        <Text style={[
          styles.statusLabel,
          isSelected && { color: color },
          !isSelected && { color: '#444' }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderIncident = ({ item }) => (
    <TouchableOpacity 
      style={styles.incidentCard}
      onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.incidentLeft}>
        <Text style={styles.incidentIcon}>{item.incident_icon || INCIDENT_ICONS[item.incident_type] || '⚠️'}</Text>
      </View>
      <View style={styles.incidentMiddle}>
        <View style={styles.incidentTypeRow}>
          <Text style={styles.incidentType}>{(item.incident_type || 'unknown').toUpperCase()}</Text>
          <View style={[styles.incidentStatusBadge, { backgroundColor: STATUS_COLORS[item.status] || '#666' }]}>
            <Text style={styles.statusText}>{(item.status || 'unknown').toUpperCase().replace('_', ' ')}</Text>
          </View>
        </View>
        <Text style={styles.incidentAddress}>{item.address || 'No address'}</Text>
        <Text style={styles.incidentTime}>
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
      </View>
      <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[item.severity] || '#666' }]}>
        <Text style={styles.severityText}>{(item.severity || 'unknown').toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
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
        {/* Status Badge Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statusRow}
          contentContainerStyle={styles.statusRowContent}
        >
          {STATUS_FILTERS.map(renderStatusBadge)}
        </ScrollView>
        
        {loading ? (
          <ActivityIndicator color="#00ff88" size="large" style={styles.loadingIndicator} />
        ) : incidents.length === 0 ? (
          <Text style={styles.emptyText}>
            No incidents{selectedStatus !== 'all' ? ` with status "${selectedStatus}"` : ''}
          </Text>
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
        onPress={() => navigation.navigate('QuickReport')}
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
  statusRow: {
    marginBottom: 16
  },
  statusRowContent: {
    paddingHorizontal: 4,
    gap: 12
  },
  statusBadge: {
    alignItems: 'center',
    width: 70
  },
  statusRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: '#1a1a1a'
  },
  statusIcon: {
    fontSize: 22
  },
  countBubble: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  countText: {
    color: '#0a0a0a',
    fontSize: 11,
    fontWeight: 'bold'
  },
  statusLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  emptyText: { color: '#333', fontSize: 16, textAlign: 'center', marginTop: 40 },
  loadingIndicator: {
    marginTop: 40
  },
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
  incidentTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  incidentType: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  incidentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  incidentAddress: { color: '#888', fontSize: 12, marginTop: 2 },
  incidentTime: { color: '#444', fontSize: 11, marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  statusText: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
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