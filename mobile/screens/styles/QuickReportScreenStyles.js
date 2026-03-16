import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  // Emergency Banner
  emergencyBanner: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 102, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 102, 0, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  emergencyIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  emergencyText: {
    flex: 1,
    color: '#FF6600',
    fontSize: 13,
    lineHeight: 18,
  },
  // Section
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  requiredBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  requiredText: {
    color: '#00ff88',
    fontSize: 10,
    fontWeight: '600',
  },
  // Incident Type Cards
  typeGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '31%',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#222',
    marginBottom: 4,
  },
  typeCardSelected: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: '#00ff88',
  },
  // Show More/Less Button
  showMoreBtn: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
  },
  showMoreText: {
    color: '#00ff88',
    fontSize: 13,
    fontWeight: '600',
  },
  // Severity Pills
  severityContainer: {
    gap: 10,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#222',
  },
  severityPillSelected: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
  },
  severityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 14,
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  severityLabelSelected: {
    color: '#fff',
  },
  severityDesc: {
    fontSize: 12,
    color: '#444',
    marginLeft: 'auto',
  },
  // Input Fields
  inputContainer: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: '#00ff88',
  },
  textArea: {
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  inputLabel: {
    position: 'absolute',
    top: 12,
    left: 16,
    fontSize: 10,
    color: '#444',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  characterCount: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    fontSize: 11,
    color: '#333',
  },
  // Location Card
  locationCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#141414',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  locationIcon: {
    fontSize: 20,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  locationStatus: {
    fontSize: 12,
    color: '#00ff88',
  },
  // Location Map
  mapContainer: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  addressIcon: {
    fontSize: 20,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  addressValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  locationLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#666',
    fontSize: 12,
  },
  // Submit Button
  submitContainer: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#00ff88',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#1a1a1a',
    shadowOpacity: 0,
  },
  submitButtonSubmitting: {
    backgroundColor: '#0a0a0a',
  },
  submitIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a0a',
    letterSpacing: 1,
  },
  submitTextDisabled: {
    color: '#333',
  },
  submitTextLight: {
    color: '#fff',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Contact Section
  contactCard: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  contactTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },
  contactOptional: {
    fontSize: 11,
    color: '#444',
    marginLeft: 'auto',
  },
  // Loading state
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
});
