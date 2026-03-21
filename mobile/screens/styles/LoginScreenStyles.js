import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 60, // ✅ extra bottom padding so content clears keyboard
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    marginTop: 24,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#00ff88',
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    letterSpacing: 2,
  },
  form: {
    gap: 16,
  },
  label: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  inputFlex: {
    flex: 1,
    color: '#fff',
    padding: 16,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 16,
  },
  eyeIcon: {
    fontSize: 18,
  },
  button: {
    backgroundColor: '#00ff88',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  // ✅ Shared outline style — used by Track Report + Login toggle
  outlineButton: {
    backgroundColor: '#1a1a1a',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  outlineButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  outlineButtonSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  signupButton: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  signupText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: {
    color: '#00ff88',
    fontSize: 14,
  },
  modeToggle: {
    alignItems: 'center',
    padding: 12,
  },
  modeToggleText: {
    color: '#666',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    fontSize: 12,
    marginHorizontal: 16,
  },
  quickReportButton: {
    backgroundColor: '#FF6600',
    padding: 22,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickReportText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  quickReportSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 4,
  },
  backText: {
    color: '#00ff88',
    fontSize: 14,
  },
});
