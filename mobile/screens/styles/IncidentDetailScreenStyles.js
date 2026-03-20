import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
  },
  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#00ff88',
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 16,
  },
  // Loading
  loadingIndicator: {
    marginTop: 100,
  },
  // Cards
  card: {
    marginHorizontal: 24,
    marginBottom: 12,
  },
  cardPrimary: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardSecondary: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  cardDark: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  // Card Header Row
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Incident Type
  incidentIcon: {
    fontSize: 32,
  },
  incidentTypeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  incidentIdText: {
    color: '#666',
    fontSize: 12,
  },
  // Status Badge
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Labels
  label: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  labelLarge: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 12,
  },
  // Severity
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  severityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  severityText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIcon: {
    fontSize: 24,
  },
  locationContent: {
    flex: 1,
  },
  locationAddress: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationCoords: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  locationLink: {
    color: '#00ff88',
    fontSize: 12,
  },
  // Description
  descriptionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
  },
  // Timestamps
  timestampContainer: {
    gap: 16,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timestampIcon: {
    fontSize: 20,
  },
  timestampLabel: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  timestampValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Contact
  contactText: {
    color: '#fff',
    fontSize: 14,
  },
  // Status Buttons
  statusButtonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  statusButtonActive: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Call Banner
  callBannerActive: {
    backgroundColor: '#0a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  callBannerStart: {
    backgroundColor: '#0a2a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  callIcon: {
    fontSize: 32,
  },
  callContent: {
    flex: 1,
  },
  callTitle: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  callSubtext: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  callSubtextDark: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  callLink: {
    color: '#00ff88',
    fontSize: 12,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
  },
  // Call Mode Options
  callModeOption: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  callModeOptionJitsi: {
    backgroundColor: '#0a2a1a',
  },
  callModeOptionInApp: {
    backgroundColor: '#0a1a2a',
  },
  callModeIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callModeIconWrapperJitsi: {
    backgroundColor: '#1a3a2a',
  },
  callModeIconWrapperInApp: {
    backgroundColor: '#1a2a3a',
  },
  callModeIcon: {
    fontSize: 24,
  },
  callModeContent: {
    flex: 1,
  },
  callModeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  callModeTitleJitsi: {
    color: '#00ff88',
  },
  callModeTitleInApp: {
    color: '#00aaff',
  },
  callModeDesc: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  callModeArrow: {
    fontSize: 16,
  },
  callModeArrowJitsi: {
    color: '#00ff88',
  },
  callModeArrowInApp: {
    color: '#00aaff',
  },
  cancelButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Citizen Status
  citizenStatusContainer: {
    alignItems: 'center',
    gap: 12,
  },
  citizenStatusIcon: {
    fontSize: 48,
  },
  citizenStatusText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  citizenStatusDesc: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});
