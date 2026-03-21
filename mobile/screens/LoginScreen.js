import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../src/context/AuthContext';
import { sendOtp } from '../src/services/auth';
import { styles } from './styles/LoginScreenStyles';

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function LoginScreen({ navigation }) {
  const { login: authLogin, loginWithOtp: authLoginWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('password');
  const [otpSent, setOtpSent] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);


  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const result = await authLogin(email, password);
      Keyboard.dismiss();
      if (!result.success) {
        Alert.alert('Login Failed', result.error?.message || 'Invalid email or password');
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };


  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(email);
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Check your email for a 6-digit code');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
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
      const result = await authLoginWithOtp(email, otpToken);
      Keyboard.dismiss();
      if (!result.success) {
        Alert.alert('Verification Failed', result.error?.message || 'Invalid OTP token');
      }
    } catch (error) {
      Alert.alert('Verification Failed', error.message || 'An error occurred');
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
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={150}
        extraHeight={180}
      >
          <View style={styles.header}>
            <Text style={styles.logo}>VERIDIAN</Text>
            <Text style={styles.tagline}>Verify. Report. Respond.</Text>
          </View>

          <View style={styles.form}>

            {/* Quick Report - Primary Action */}
            <TouchableOpacity
              style={styles.quickReportButton}
              onPress={() => navigation.navigate('QuickReport')}
            >
              <Text style={styles.quickReportText}>⚠️ QUICK REPORT</Text>
              <Text style={styles.quickReportSubtext}>Report an emergency immediately</Text>
            </TouchableOpacity>

            {/* Track Report Button */}
            <TouchableOpacity
              style={styles.outlineButton}
              onPress={() => navigation.navigate('TrackReport')}
            >
              <Text style={styles.outlineButtonText}>🔍 TRACK REPORT</Text>
              <Text style={styles.outlineButtonSubtext}>Check status of your incident</Text>
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
                style={styles.outlineButton}
                onPress={() => setShowLoginForm(true)}
              >
                <Text style={styles.outlineButtonText}>LOGIN TO YOUR ACCOUNT</Text>
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
                  testID="email-input"
                />

                {loginMode === 'password' && (
                  <>
                    <Text style={styles.label}>PASSWORD</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.inputFlex}
                        placeholder="Enter your password"
                        placeholderTextColor="#666"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        testID="password-input"
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(p => !p)}
                        style={styles.eyeButton}
                      >
                        <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.button}
                      onPress={handleLogin}
                      disabled={loading}
                      testID="login-button"
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
                      : <Text style={styles.buttonText}>SEND OTP CODE</Text>
                    }
                  </TouchableOpacity>
                )}

                {loginMode === 'otp' && otpSent && (
                  <>
                    <Text style={styles.label}>OTP TOKEN</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit code from email"
                      placeholderTextColor="#666"
                      value={otpToken}
                      onChangeText={setOtpToken}
                      autoCapitalize="none"
                      keyboardType="number-pad"
                      testID="otp-input"
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
                    {loginMode === 'password' ? 'Login with OTP Code' : 'Login with Password'}
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
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
