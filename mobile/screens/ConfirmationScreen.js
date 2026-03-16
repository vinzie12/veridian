import {
  View, Text, StyleSheet,
  TouchableOpacity, SafeAreaView, Alert
} from 'react-native';

const SEVERITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFAA00',
  low: '#00CC44'
};

export default function ConfirmationScreen({ route, navigation }) {
  const { token, user, incident, isAnonymous } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Success Icon */}
        <View style={styles.successCircle}>
          <Text style={styles.successIcon}>✓</Text>
        </View>

        <Text style={styles.successTitle}>INCIDENT REPORTED</Text>
        <Text style={styles.successSubtitle}>
          {isAnonymous 
            ? 'Your report has been submitted anonymously' 
            : 'All units have been notified'}
        </Text>

        {/* Tracking ID for anonymous users */}
        {isAnonymous && incident.trackingId && (
          <View style={styles.trackingCard}>
            <Text style={styles.trackingLabel}>TRACKING ID</Text>
            <Text style={styles.trackingId}>{incident.trackingId}</Text>
            <Text style={styles.trackingNote}>Save this ID to check your report status</Text>
          </View>
        )}

        {/* Incident Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.incidentNumber}>
              #{incident.id}
            </Text>
            <View style={[
              styles.severityBadge,
              { backgroundColor: SEVERITY_COLORS[incident.severity] }
            ]}>
              <Text style={styles.severityText}>
                {incident.severity.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>
              {incident.typeIcon || '⚠️'}
            </Text>
            <View>
              <Text style={styles.detailLabel}>INCIDENT TYPE</Text>
              <Text style={styles.detailValue}>
                {incident.typeName?.toUpperCase() || 'UNKNOWN'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📍</Text>
            <View style={styles.detailFlex}>
              <Text style={styles.detailLabel}>LOCATION</Text>
              <Text style={styles.detailValue}>{incident.address}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🕐</Text>
            <View>
              <Text style={styles.detailLabel}>TIME REPORTED</Text>
              <Text style={styles.detailValue}>{incident.time}</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        {isAnonymous ? (
          <>
            <TouchableOpacity
              style={styles.trackBtn}
              onPress={() => {
                // TODO: Navigate to tracking screen
                Alert.alert('Track Report', 'Report tracking coming soon!');
              }}
            >
              <Text style={styles.trackBtnText}>TRACK MY REPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => navigation.replace('Login')}
            >
              <Text style={styles.homeBtnText}>BACK TO LOGIN</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.addDetailsBtn}
              onPress={() => navigation.replace('Home', { token, user })}
            >
              <Text style={styles.addDetailsText}>ADD MORE DETAILS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => navigation.replace('Home', { token, user })}
            >
              <Text style={styles.homeBtnText}>BACK TO HOME</Text>
            </TouchableOpacity>
          </>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: {
    flex: 1, padding: 24,
    alignItems: 'center', justifyContent: 'center'
  },
  successCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#00ff88',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20
  },
  successIcon: { fontSize: 48, color: '#0a0a0a', fontWeight: 'bold' },
  successTitle: {
    fontSize: 24, fontWeight: 'bold',
    color: '#fff', letterSpacing: 4, marginBottom: 8
  },
  successSubtitle: { fontSize: 13, color: '#666', marginBottom: 32 },
  card: {
    backgroundColor: '#1a1a1a', borderRadius: 16,
    padding: 20, width: '100%', marginBottom: 24
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16
  },
  incidentNumber: {
    color: '#00ff88', fontSize: 18,
    fontWeight: 'bold', letterSpacing: 2
  },
  severityBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6
  },
  severityText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  divider: {
    height: 1, backgroundColor: '#333', marginBottom: 16
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, marginBottom: 14
  },
  detailIcon: { fontSize: 24 },
  detailFlex: { flex: 1 },
  detailLabel: {
    color: '#444', fontSize: 10,
    fontWeight: 'bold', letterSpacing: 2
  },
  detailValue: {
    color: '#fff', fontSize: 14,
    fontWeight: 'bold', marginTop: 2
  },
  addDetailsBtn: {
    borderWidth: 2, borderColor: '#00ff88',
    borderRadius: 12, padding: 18,
    width: '100%', alignItems: 'center', marginBottom: 12
  },
  addDetailsText: {
    color: '#00ff88', fontSize: 14,
    fontWeight: 'bold', letterSpacing: 2
  },
  homeBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 18, width: '100%', alignItems: 'center'
  },
  homeBtnText: {
    color: '#666', fontSize: 14,
    fontWeight: 'bold', letterSpacing: 2
  },
  trackingCard: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  trackingLabel: {
    color: '#00ff88',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  trackingId: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 4,
  },
  trackingNote: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
  },
  trackBtn: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 18,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackBtnText: {
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});