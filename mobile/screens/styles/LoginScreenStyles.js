import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    padding: 24
  },
  header: {
    alignItems: 'center',
    marginBottom: 48
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#00ff88',
    letterSpacing: 8
  },
  tagline: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    letterSpacing: 2
  },
  form: {
    gap: 16
  },
  label: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 16,
    borderRadius: 8,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#333'
  },
  button: {
    backgroundColor: '#00ff88',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  buttonText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2
  },
  signupButton: {
    alignItems: 'center',
    marginTop: 16
  },
  signupText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 12
  },
  linkText: {
    color: '#00ff88',
    fontSize: 14
  },
  modeToggle: {
    alignItems: 'center',
    marginTop: 24,
    padding: 12
  },
  modeToggleText: {
    color: '#666',
    fontSize: 14
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333'
  },
  dividerText: {
    color: '#666',
    fontSize: 12,
    marginHorizontal: 16
  },
  quickReportButton: {
    backgroundColor: '#FF6600',
    padding: 22,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  quickReportText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2
  },
  quickReportSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 4
  },
  trackReportButton: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#00ff88'
  },
  trackReportText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2
  },
  trackReportSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 4
  },
  loginToggleButton: {
    backgroundColor: '#1a1a1a',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff88'
  },
  loginToggleText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8
  },
  backText: {
    color: '#00ff88',
    fontSize: 14
  }
});
