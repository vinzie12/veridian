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
  // Section
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  // Input
  trackingInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    letterSpacing: 2,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#222',
  },
  // Track Button
  trackButton: {
    backgroundColor: '#00ff88',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
  },
  trackButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a0a0a',
    letterSpacing: 1,
  },
  // Result Card
  resultCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  trackingIdText: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginBottom: 16,
  },
  // Detail Row
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  detailIcon: {
    fontSize: 24,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    color: '#444',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  detailValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  // Status Info
  statusInfo: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#141414',
    borderRadius: 12,
  },
  statusInfoText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  // Bottom Button
  homeButton: {
    marginTop: 'auto',
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
