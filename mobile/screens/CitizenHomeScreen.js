import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, ScrollView, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { useAuth } from '../src/context/AuthContext';
import { incidentService } from '../src/services/apiClient';
import { 
  STATUS_COLORS, STATUS_ICONS, INCIDENT_ICONS, 
  EMERGENCY_CONTACTS 
} from '../constants';

export default function CitizenHomeScreen({ navigation }) {
  const { user } = useAuth();
  const [myReports, setMyReports] = useState([]);
  const [nearbyIncidents, setNearbyIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchData = async () => {
    try {
      // Fetch user's own reports
      const myReportsRes = await incidentService.list({ reporter_id: 'me' });
      setMyReports(myReportsRes?.data || []);

      // Fetch nearby active incidents
      const nearbyRes = await incidentService.list({ status: 'active', limit: 5 });
      setNearbyIncidents(nearbyRes?.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      setLoading(true);
      fetchData();
    }
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [isFocused]);

  const handleEmergencyCall = (number) => {
    Linking.openURL(`tel:${number}`);
  };

  const renderMyReport = ({ item }) => (
    <TouchableOpacity 
      style={styles.reportCard}
      onPress={() => navigation.navigate('IncidentDetail', { incidentId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.reportLeft}>
        <Text style={styles.reportIcon}>{item.incident_icon || INCIDENT_ICONS[item.incident_type] || '⚠️'}</Text>
      </View>
      <View style={styles.reportMiddle}>
        <View style={styles.reportTypeRow}>
          <Text style={styles.reportType}>{(item.incident_type || 'unknown').toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || '#666' }]}>
            <Text style={styles.statusText}>{(item.status || 'unknown').toUpperCase().replace('_', ' ')}</Text>
          </View>
        </View>
        <Text style={styles.reportAddress}>{item.address || 'No address'}</Text>
        <Text style={styles.reportTime}>
          {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderNearbyIncident = (item) => (
    <View key={item.id} style={styles.nearbyCard}>
      <Text style={styles.nearbyIcon}>{item.incident_icon || INCIDENT_ICONS[item.incident_type] || '⚠️'}</Text>
      <View style={styles.nearbyInfo}>
        <Text style={styles.nearbyType}>{(item.incident_type || 'unknown').toUpperCase()}</Text>
        <Text style={styles.nearbyAddress} numberOfLines={1}>{item.address || 'No address'}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || '#666' }]}>
        <Text style={styles.statusText}>{(item.status || 'unknown').toUpperCase().replace('_', ' ')}</Text>
      </View>
    </View>
  );

  const renderEmergencyContact = (contact) => (
    <TouchableOpacity
      key={contact.id}
      style={styles.emergencyBtn}
      onPress={() => handleEmergencyCall(contact.number)}
      activeOpacity={0.7}
    >
      <Text style={styles.emergencyIcon}>{contact.icon}</Text>
      <Text style={styles.emergencyLabel}>{contact.label.toUpperCase()}</Text>
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
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>CITIZEN</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings', { user })}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section 1: Report an Incident */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>REPORT AN INCIDENT</Text>
          <TouchableOpacity
            style={styles.reportIncidentBtn}
            onPress={() => navigation.navigate('QuickReport')}
            activeOpacity={0.8}
          >
            <Text style={styles.reportIncidentText}>⚡ REPORT INCIDENT</Text>
          </TouchableOpacity>
        </View>

        {/* Section 2: My Reports */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MY REPORTS</Text>
          {loading ? (
            <ActivityIndicator color="#00ff88" size="large" style={styles.loadingIndicator} />
          ) : myReports.length === 0 ? (
            <Text style={styles.emptyText}>No reports submitted yet</Text>
          ) : (
            <FlatList
              data={myReports}
              keyExtractor={item => item.id}
              renderItem={renderMyReport}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Section 3: Nearby Active Incidents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NEARBY ACTIVITY</Text>
          {loading ? (
            <ActivityIndicator color="#00ff88" size="large" style={styles.loadingIndicator} />
          ) : nearbyIncidents.length === 0 ? (
            <Text style={styles.emptyText}>No nearby active incidents</Text>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.nearbyScroll}
            >
              {nearbyIncidents.map(renderNearbyIncident)}
            </ScrollView>
          )}
        </View>

        {/* Section 4: Emergency Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EMERGENCY CONTACTS</Text>
          <View style={styles.emergencyRow}>
            {EMERGENCY_CONTACTS.map(renderEmergencyContact)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0a' 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  logo: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#00ff88', 
    letterSpacing: 4 
  },
  welcome: { 
    fontSize: 12, 
    color: '#666', 
    marginTop: 2 
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  roleBadge: {
    backgroundColor: '#1a1a1a',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00ff88'
  },
  roleText: { 
    color: '#00ff88', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  settingsBtn: {
    marginLeft: 12,
    padding: 8
  },
  settingsIcon: {
    fontSize: 20
  },
  content: { 
    flex: 1 
  },
  section: { 
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  sectionTitle: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16
  },
  emptyText: { 
    color: '#333', 
    fontSize: 14, 
    textAlign: 'center', 
    marginTop: 20 
  },
  loadingIndicator: {
    marginTop: 20
  },
  // Report Incident Button
  reportIncidentBtn: {
    backgroundColor: '#00ff88',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  reportIncidentText: {
    color: '#0a0a0a',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2
  },
  // My Reports
  reportCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  reportLeft: { 
    marginRight: 12 
  },
  reportIcon: { 
    fontSize: 28 
  },
  reportMiddle: { 
    flex: 1 
  },
  reportTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  reportType: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: 'bold' 
  },
  reportAddress: { 
    color: '#888', 
    fontSize: 12, 
    marginTop: 2 
  },
  reportTime: { 
    color: '#444', 
    fontSize: 11, 
    marginTop: 4 
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  statusText: { 
    color: '#fff', 
    fontSize: 8, 
    fontWeight: 'bold' 
  },
  // Nearby Incidents
  nearbyScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20
  },
  nearbyCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    width: 180,
    flexDirection: 'row',
    alignItems: 'center'
  },
  nearbyIcon: { 
    fontSize: 24, 
    marginRight: 8 
  },
  nearbyInfo: { 
    flex: 1 
  },
  nearbyType: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: 'bold' 
  },
  nearbyAddress: { 
    color: '#888', 
    fontSize: 10, 
    marginTop: 2 
  },
  // Emergency Contacts
  emergencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  emergencyBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333'
  },
  emergencyIcon: { 
    fontSize: 28, 
    marginBottom: 8 
  },
  emergencyLabel: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: 'bold',
    letterSpacing: 1
  }
});
