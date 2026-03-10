import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

const API_URL = 'http://192.168.254.100:3000';

export default function SignupScreen({ navigation }) {
  const [badgeNumber, setBadgeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAgency, setSelectedAgency] = useState(null);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    try {
      const response = await axios.get(`${API_URL}/`);
      setAgencies(response.data.agencies);
    } catch (error) {
      console.error('Failed to fetch agencies:', error);
    }
  };

  const handleSignup = async () => {
    if (!badgeNumber || !password || !fullName || !email || !selectedAgency) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/signup`, {
        badge_number: badgeNumber,
        password: password,
        full_name: fullName,
        email: email,
        agency_id: selectedAgency
      });
      
      Alert.alert('Success', 'Account created successfully!', [
        { text: 'OK', onPress: () => navigation.replace('Home', { 
          token: response.data.token,
          user: response.data.user 
        })}
      ]);
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create account';
      Alert.alert('Signup Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.title}>CREATE ACCOUNT</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>BADGE NUMBER</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter badge number"
            placeholderTextColor="#666"
            value={badgeNumber}
            onChangeText={setBadgeNumber}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#666"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>AGENCY</Text>
          <View style={styles.agencyContainer}>
            {agencies.map(agency => (
              <TouchableOpacity
                key={agency.id}
                style={[
                  styles.agencyButton,
                  selectedAgency === agency.id && styles.agencyButtonSelected
                ]}
                onPress={() => setSelectedAgency(agency.id)}
              >
                <Text style={[
                  styles.agencyText,
                  selectedAgency === agency.id && styles.agencyTextSelected
                ]}>
                  {agency.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password (min 6 characters)"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />

          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#666"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={true}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#0a0a0a" />
              : <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
            }
          </TouchableOpacity>
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
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  back: {
    color: '#00ff88',
    fontSize: 14,
    marginRight: 16
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 3
  },
  form: {
    padding: 20,
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
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333'
  },
  agencyContainer: {
    gap: 10
  },
  agencyButton: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333'
  },
  agencyButtonSelected: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88'
  },
  agencyText: {
    color: '#888',
    fontSize: 14
  },
  agencyTextSelected: {
    color: '#0a0a0a',
    fontWeight: 'bold'
  },
  button: {
    backgroundColor: '#00ff88',
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16
  },
  buttonDisabled: {
    backgroundColor: '#1a1a1a'
  },
  buttonText: {
    color: '#0a0a0a',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2
  }
});
