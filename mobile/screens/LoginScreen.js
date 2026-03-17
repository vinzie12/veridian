import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { API_URL } from '../lib/supabase';
import { styles } from './styles/LoginScreenStyles';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'otp'
  const [otpSent, setOtpSent] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: email,
        password: password
      });
      Keyboard.dismiss();
      
      // Route to appropriate home screen based on role
      const targetScreen = response.data.user.role === 'citizen' ? 'CitizenHome' : 'Home';
      navigation.replace(targetScreen, { 
        token: response.data.access_token,
        user: response.data.user 
      });
    } catch (error) {
      const message = error.response?.data?.error || 'Invalid email or password';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/login/otp`, { email });
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Check your email for a login link');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to send OTP';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!email || !otpToken) {
      Alert.alert('Error', 'Please enter your email and OTP token');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/login/verify-otp`, {
        email: email,
        token: otpToken,
        type: 'magiclink'
      });
      Keyboard.dismiss();
      
      // Route to appropriate home screen based on role
      const targetScreen = response.data.user.role === 'citizen' ? 'CitizenHome' : 'Home';
      navigation.replace(targetScreen, { 
        token: response.data.access_token,
        user: response.data.user 
      });
    } catch (error) {
      const message = error.response?.data?.error || 'Invalid OTP token';
      Alert.alert('Verification Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const resetOtp = () => {
    setOtpSent(false);
    setOtpToken('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>VERIDIAN</Text>
        <Text style={styles.tagline}>Verify. Report. Respond.</Text>
      </View>

      <View style={styles.form}>
        {/* Quick Report - Primary Action */}
        <TouchableOpacity
          style={styles.quickReportButton}
          onPress={() => navigation.navigate('QuickReport', { token: null, user: null })}
        >
          <Text style={styles.quickReportText}>⚠️ QUICK REPORT</Text>
          <Text style={styles.quickReportSubtext}>Report an emergency immediately</Text>
        </TouchableOpacity>

        {/* Track Report Button */}
        <TouchableOpacity
          style={styles.trackReportButton}
          onPress={() => navigation.navigate('TrackReport')}
        >
          <Text style={styles.trackReportText}>🔍 TRACK REPORT</Text>
          <Text style={styles.trackReportSubtext}>Check status of your incident</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Login Toggle Button */}
        {!showLoginForm && (
          <TouchableOpacity
            style={styles.loginToggleButton}
            onPress={() => setShowLoginForm(true)}
          >
            <Text style={styles.loginToggleText}>LOGIN TO YOUR ACCOUNT</Text>
          </TouchableOpacity>
        )}

        {/* Login Form - Only shown when toggled */}
        {showLoginForm && (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setShowLoginForm(false);
                resetOtp();
              }}
            >
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {loginMode === 'password' && (
              <>
                <Text style={styles.label}>PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={true}
                />

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#0a0a0a" />
                    : <Text style={styles.buttonText}>LOGIN</Text>
                  }
                </TouchableOpacity>
              </>
            )}

            {loginMode === 'otp' && !otpSent && (
              <TouchableOpacity
                style={styles.button}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#0a0a0a" />
                  : <Text style={styles.buttonText}>SEND MAGIC LINK</Text>
                }
              </TouchableOpacity>
            )}

            {loginMode === 'otp' && otpSent && (
              <>
                <Text style={styles.label}>OTP TOKEN</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter token from email"
                  placeholderTextColor="#666"
                  value={otpToken}
                  onChangeText={setOtpToken}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.button}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#0a0a0a" />
                    : <Text style={styles.buttonText}>VERIFY</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={resetOtp}
                >
                  <Text style={styles.linkText}>Resend OTP</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.modeToggle}
              onPress={() => {
                setLoginMode(loginMode === 'password' ? 'otp' : 'password');
                resetOtp();
              }}
            >
              <Text style={styles.modeToggleText}>
                {loginMode === 'password' ? 'Login with Magic Link (OTP)' : 'Login with Password'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signupButton}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.signupText}>Don't have an account? SIGN UP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}