import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import axios from 'axios';

const API_URL = 'http://192.168.254.100:3000';

export default function LoginScreen({ navigation }) {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!badgeNumber) {
      Alert.alert('Error', 'Please enter your badge number');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        badge_number: badgeNumber
      });
      navigation.replace('Home', { 
        token: response.data.token,
        user: response.data.user 
      });
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid badge number. Try BADGE001');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>VERIDIAN</Text>
        <Text style={styles.tagline}>Verify. Report. Respond.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>BADGE NUMBER</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your badge number"
          placeholderTextColor="#666"
          value={badgeNumber}
          onChangeText={setBadgeNumber}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>LOGIN</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  }
});