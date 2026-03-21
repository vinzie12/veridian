import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();

  const isCitizen = user?.role === 'citizen';

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            // Navigation is handled by RootNavigator based on auth state
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SETTINGS</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{user.full_name}</Text>
            </View>
            {!isCitizen && user.badge_number && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Badge</Text>
                  <Text style={styles.value}>{user.badge_number}</Text>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.value}>{(user?.role || 'unknown').toUpperCase()}</Text>
            </View>
            {!isCitizen && user.agency && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Agency</Text>
                  <Text style={styles.value}>{user.agency}</Text>
                </View>
              </>
            )}
            {isCitizen && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.value}>{user.email}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP SETTINGS</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuText}>Notifications</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuText}>Location Services</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuText}>About Veridian</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0.0</Text>
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
  back: {
    color: '#00ff88',
    fontSize: 14
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3
  },
  headerSpacer: {
    width: 60
  },
  section: {
    padding: 20
  },
  sectionTitle: {
    color: '#666',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 12
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 16
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  label: {
    color: '#666',
    fontSize: 14
  },
  value: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 4
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14
  },
  menuText: {
    color: '#fff',
    fontSize: 16
  },
  menuArrow: {
    color: '#666',
    fontSize: 20
  },
  logoutButton: {
    backgroundColor: '#FF3333',
    margin: 20,
    padding: 18,
    borderRadius: 10,
    alignItems: 'center'
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2
  },
  version: {
    color: '#333',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20
  }
});
