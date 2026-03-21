import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, ScrollView, Linking, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './styles/IncidentDetailScreenStyles';

import { useAuth } from '../src/context/AuthContext';
import { incidentService, callService } from '../src/services/apiClient';
import { STATUS_COLORS, STATUS_ICONS, SEVERITY_COLORS } from '../constants';

// FIX: Only import CALL_MODE and CALL_STATUS constants from callSessionService
// Removed: getActiveCallForIncident (was using direct Supabase — blocked by RLS)
import { CALL_MODE, CALL_STATUS } from '../lib/callSessionService';

import { formatDate } from '../src/utils/time';


export default function IncidentDetailScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const { user } = useAuth();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showCallModeModal, setShowCallModeModal] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [startingCall, setStartingCall] = useState(false);

  const isCitizen = user?.role === 'citizen';

  useEffect(() => {
    fetchIncident();
  }, []);

  const fetchIncident = async () => {
  // Incident fetch — fatal if it fails
  try {
    const response = await incidentService.get(incidentId);
    const incidentData = response?.data?.incident || response?.data || response;
    setIncident(incidentData);
  } catch (error) {
    console.error('Failed to fetch incident:', error);
    Alert.alert('Error', 'Failed to load incident details');
    navigation.goBack();
    return;
  } finally {
    setLoading(false);
  }

  // Active call fetch — non-fatal, just leave activeCall as null if it fails
  try {
    const callResponse = await callService.getActiveCall(incidentId);
    const callSession = callResponse?.data?.callSession || null;
    setActiveCall(callSession);
  } catch (error) {
    console.warn('Could not fetch active call (non-fatal):', error.message);
  }
};

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      await incidentService.updateStatus(incidentId, newStatus);
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

  const handleStartCall = async (mode) => {
    setShowCallModeModal(false);
    setStartingCall(true);

    try {
      // FIX: Guard against null reporter_id (anonymous reports)
      if (!incident.reporter_id) {
        Alert.alert(
          'Cannot Call',
          'This incident was submitted anonymously. No reporter to call.'
        );
        setStartingCall(false);
        return;
      }

      console.log('[IncidentDetail] Starting call:', {
        incidentId: incident.id?.slice(0, 8),
        reporterId: incident.reporter_id?.slice(0, 8),
        reporterName: incident.reporter_name,
        callerName: user?.full_name,
        callerId: user?.id?.slice(0, 8),
        callerRole: user?.role
      });

      const response = await callService.createSession(
        incident.id,
        incident.reporter_id,
        mode,
        user?.full_name || 'Admin',
        incident.reporter_name || 'Reporter'
      );

      // FIX: Handle both response shapes from normalizeResponse
      const callSession =
        response?.data?.callSession ||
        response?.data ||
        null;

      if (callSession?.id) {
        // Update local activeCall state so the banner shows immediately
        setActiveCall(callSession);

        if (mode === CALL_MODE.JITSI) {
          navigation.navigate('VerificationCall', {
            incidentId: incident.id,
            callSessionId: callSession.id,
            callerName: user?.full_name || 'Admin',
            reporterName: incident.reporter_name || 'Reporter',
          });
        } else if (mode === CALL_MODE.IN_APP) {
          navigation.navigate('InAppCall', {
            incidentId: incident.id,
            callSessionId: callSession.id,
            callSession,
            isCaller: true,
          });
        }
      } else {
        console.error('Unexpected response shape:', JSON.stringify(response));
        Alert.alert('Error', response?.error || response?.message || 'Failed to start call');
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      Alert.alert('Error', error?.message || 'Failed to start call');
    } finally {
      setStartingCall(false);
    }
  };

  const handleJoinExistingCall = () => {
    if (!activeCall) return;

    if (activeCall.call_mode === CALL_MODE.JITSI) {
      navigation.navigate('VerificationCall', {
        incidentId: incident.id,
        callSessionId: activeCall.id,
        callerName: user?.full_name || 'Admin',
        reporterName: incident.reporter_name || 'Reporter',
      });
    } else {
      navigation.navigate('InAppCall', {
        incidentId: incident.id,
        callSessionId: activeCall.id,
        callSession: activeCall,
        isCaller: true,
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#00ff88" size="large" style={styles.loadingIndicator} />
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
        <View style={[styles.card, styles.cardPrimary]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.incidentIcon}>{incident.incident_icon || '⚠️'}</Text>
              <View>
                <Text style={styles.incidentTypeText}>
                  {(incident.incident_type || 'Unknown').toUpperCase()}
                </Text>
                <Text style={styles.incidentIdText}>
                  #{incident.id?.slice(0, 8).toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[incident.status] || '#666' }]}>
              <Text style={styles.statusText}>
                {(incident.status || 'unknown').toUpperCase().replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Severity */}
        <View style={[styles.card, styles.cardSecondary]}>
          <Text style={styles.label}>SEVERITY</Text>
          <View style={styles.severityRow}>
            <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[incident.severity] || '#666' }]} />
            <Text style={styles.severityText}>
              {(incident.severity || 'unknown').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Location */}
        <TouchableOpacity
          style={[styles.card, styles.cardSecondary]}
          onPress={openMap}
        >
          <Text style={styles.label}>LOCATION</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <View style={styles.locationContent}>
              <Text style={styles.locationAddress}>
                {incident.address || 'No address recorded'}
              </Text>
              {incident.latitude && incident.longitude && (
                <Text style={styles.locationCoords}>
                  {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}
                </Text>
              )}
            </View>
            <Text style={styles.locationLink}>OPEN MAP →</Text>
          </View>
        </TouchableOpacity>

        {/* Description */}
        {incident.description && (
          <View style={[styles.card, styles.cardSecondary]}>
            <Text style={styles.label}>DESCRIPTION</Text>
            <Text style={styles.descriptionText}>
              {incident.description}
            </Text>
          </View>
        )}

        {/* Timestamps */}
        <View style={[styles.card, styles.cardSecondary]}>
          <View style={styles.timestampContainer}>
            <View style={styles.timestampRow}>
              <Text style={styles.timestampIcon}>🕐</Text>
              <View>
                <Text style={styles.timestampLabel}>REPORTED</Text>
                <Text style={styles.timestampValue}>
                  {formatDate(incident.created_at)}
                </Text>
              </View>
            </View>
            {incident.updated_at && incident.updated_at !== incident.created_at && (
              <View style={styles.timestampRow}>
                <Text style={styles.timestampIcon}>🔄</Text>
                <View>
                  <Text style={styles.timestampLabel}>LAST UPDATED</Text>
                  <Text style={styles.timestampValue}>
                    {formatDate(incident.updated_at)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Reporter Contact (if anonymous) */}
        {incident.extra_fields?.reporter_contact && (
          <View style={[styles.card, styles.cardSecondary]}>
            <Text style={styles.label}>REPORTER CONTACT</Text>
            <Text style={styles.contactText}>{incident.extra_fields.reporter_contact}</Text>
          </View>
        )}

        {/* Status Actions - Only for non-citizens */}
        {!isCitizen && (
          <View style={[styles.card, styles.cardDark]}>
            <Text style={styles.labelLarge}>UPDATE STATUS</Text>
            <View style={styles.statusButtonContainer}>
              {['pending_review', 'acknowledged', 'en_route', 'on_scene', 'resolved', 'closed'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    incident.status === status && styles.statusButtonActive,
                    {
                      backgroundColor: incident.status === status ? STATUS_COLORS[status] : '#1a1a1a',
                      borderColor: STATUS_COLORS[status] || '#333',
                      opacity: updating ? 0.5 : 1,
                    }
                  ]}
                  onPress={() => updateStatus(status)}
                  disabled={updating || incident.status === status}
                >
                  <Text style={[
                    styles.statusButtonText,
                    { color: incident.status === status ? '#fff' : STATUS_COLORS[status] }
                  ]}>
                    {status.toUpperCase().replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Verification Call - Only for non-citizens */}
        {!isCitizen && (
          <View>
            {/* Active Call Banner */}
            {activeCall && (
              <TouchableOpacity
                style={[styles.card, styles.callBannerActive]}
                onPress={handleJoinExistingCall}
              >
                <Text style={styles.callIcon}>📞</Text>
                <View style={styles.callContent}>
                  <Text style={styles.callTitle}>
                    {activeCall.status === CALL_STATUS.RINGING ? 'CALL RINGING...' : 'ACTIVE CALL'}
                  </Text>
                  <Text style={styles.callSubtext}>
                    {activeCall.call_mode === CALL_MODE.JITSI ? 'Jitsi Browser Call' : 'In-App Call'} • Tap to join
                  </Text>
                </View>
                <Text style={styles.callLink}>JOIN →</Text>
              </TouchableOpacity>
            )}

            {/* Start Call Button */}
            {!activeCall && (
              <TouchableOpacity
                style={[styles.card, styles.callBannerStart]}
                onPress={() => setShowCallModeModal(true)}
                disabled={startingCall}
              >
                <Text style={styles.callIcon}>📞</Text>
                <View style={styles.callContent}>
                  <Text style={styles.callTitle}>
                    {startingCall ? 'STARTING CALL...' : 'START VERIFICATION CALL'}
                  </Text>
                  <Text style={styles.callSubtextDark}>
                    {incident.reporter_id
                      ? 'Choose call mode: Jitsi or In-App'
                      : 'Anonymous report — no reporter to call'}
                  </Text>
                </View>
                <Text style={styles.callLink}>→</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Call Mode Selection Modal */}
        <Modal
          visible={showCallModeModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCallModeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Choose Call Mode</Text>
              <Text style={styles.modalSubtitle}>Select how you want to call the reporter</Text>

              {/* Jitsi Option */}
              <TouchableOpacity
                style={[styles.callModeOption, styles.callModeOptionJitsi]}
                onPress={() => handleStartCall(CALL_MODE.JITSI)}
              >
                <View style={[styles.callModeIconWrapper, styles.callModeIconWrapperJitsi]}>
                  <Text style={styles.callModeIcon}>🌐</Text>
                </View>
                <View style={styles.callModeContent}>
                  <Text style={[styles.callModeTitle, styles.callModeTitleJitsi]}>Jitsi Browser Call</Text>
                  <Text style={styles.callModeDesc}>Opens in browser • Free • No account needed</Text>
                </View>
                <Text style={[styles.callModeArrow, styles.callModeArrowJitsi]}>→</Text>
              </TouchableOpacity>

              {/* In-App Option */}
              <TouchableOpacity
                style={[styles.callModeOption, styles.callModeOptionInApp]}
                onPress={() => handleStartCall(CALL_MODE.IN_APP)}
              >
                <View style={[styles.callModeIconWrapper, styles.callModeIconWrapperInApp]}>
                  <Text style={styles.callModeIcon}>📱</Text>
                </View>
                <View style={styles.callModeContent}>
                  <Text style={[styles.callModeTitle, styles.callModeTitleInApp]}>In-App Call</Text>
                  <Text style={styles.callModeDesc}>Stays in app • Audio only • Simple UI</Text>
                </View>
                <Text style={[styles.callModeArrow, styles.callModeArrowInApp]}>→</Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCallModeModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Citizen Status Info */}
        {isCitizen && (
          <View style={[styles.card, styles.cardDark]}>
            <Text style={styles.labelLarge}>REPORT STATUS</Text>
            <View style={styles.citizenStatusContainer}>
              <Text style={styles.citizenStatusIcon}>{STATUS_ICONS[incident.status] || '📋'}</Text>
              <Text style={styles.citizenStatusText}>
                {(incident.status || 'unknown').toUpperCase().replace('_', ' ')}
              </Text>
              <Text style={styles.citizenStatusDesc}>
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
