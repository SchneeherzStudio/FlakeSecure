/**
 * ============================================================================
 * FlakeSecure Mobile App - Login & Registration Screen v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. AUTHENTICATION & LOGIN:
 *    - handleLogin(): Validates credentials and logs user in via AuthContext.login.
 * 
 * 2. OTP EMAIL REGISTRATION:
 *    - handleSendOtp(): Requests 6-digit verification code to user's email via /api/otp/send.
 *    - handleRegister(): Verifies OTP code via /api/otp/verify and completes account registration.
 * 
 * 3. REACTIVE LOCALIZATION & FORM CONTROLS:
 *    - Uses useLanguage() hook for multi-language support (EN, DE, FR, ES).
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { sendOtp, verifyOtp } from '../utils/api';

export default function LoginScreen({ navigation }) {
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const handleLogin = async () => {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      Alert.alert(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    setLoading(true);
    try {
      await login(cleanIdentifier, cleanPassword);
    } catch (err) {
      Alert.alert(t('login.failed'), err.message || t('login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    setSendingOtp(true);
    try {
      await sendOtp(cleanEmail, 'register');
      setOtpSent(true);
      Alert.alert(t('success'), `OTP sent to ${cleanEmail}`);
    } catch (e) {
      Alert.alert(t('error'), e.message || 'Could not send verification code.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail || !cleanUsername || !cleanPassword) {
      Alert.alert(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      Alert.alert(t('error'), t('onboarding.account.usernameRules'));
      return;
    }
    if (/\s/.test(password)) {
      Alert.alert(t('error'), t('onboarding.account.passwordNoSpaces'));
      return;
    }
    if (cleanPassword.length < 8) {
      Alert.alert(t('error'), t('onboarding.account.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('onboarding.account.passwordsDoNotMatch'));
      return;
    }

    if (!otpSent) {
      Alert.alert(t('error'), t('onboarding.account.otpLabel'));
      return;
    }

    if (!cleanOtp || cleanOtp.length !== 6) {
      Alert.alert(t('error'), t('onboarding.account.otpLabel'));
      return;
    }

    setLoading(true);
    try {
      const verifyRes = await verifyOtp(cleanEmail, cleanOtp, 'register');
      const otpToken = verifyRes.token;
      await register(cleanEmail, cleanUsername, cleanPassword, otpToken);
    } catch (err) {
      Alert.alert(t('error'), err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>❄️</Text>
            </View>
            <Text style={styles.title}>
              Flake<Text style={styles.titleHighlight}>Secure</Text>
            </Text>
            <Text style={styles.subtitle}>
              {isRegisterMode ? t('login.registerTitle') : t('login.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            {isRegisterMode ? (
              <>
                <Text style={styles.inputLabel}>{t('onboarding.account.email')}</Text>
                <View style={styles.otpRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="email@domain.com"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.sendOtpBtn}
                    onPress={handleSendOtp}
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color="#6391ff" size="small" />
                    ) : (
                      <Text style={styles.sendOtpText}>{otpSent ? t('login.resendOtp') : t('login.sendOtp')}</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {otpSent && (
                  <View style={styles.otpInputBox}>
                    <Text style={styles.inputLabel}>{t('login.otpLabel')}</Text>
                    <TextInput
                      style={[styles.input, styles.otpCodeInput]}
                      placeholder={t('login.otpPlaceholder')}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                )}

                <Text style={styles.inputLabel}>{t('onboarding.account.username')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="username"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>{t('onboarding.account.password')}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>{t('onboarding.account.confirmPassword')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />

                <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
                  <LinearGradient
                    colors={['#6391ff', '#7c6aff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>{t('login.registerButton')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>{t('login.emailOrUsername')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="user@domain.com / username"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>{t('login.password')}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
                  <LinearGradient
                    colors={['#6391ff', '#7c6aff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>{t('login.loginButton')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.toggleModeBtn}
              onPress={() => {
                setIsRegisterMode(!isRegisterMode);
                setOtpSent(false);
                setOtpCode('');
              }}
            >
              <Text style={styles.toggleModeText}>
                {isRegisterMode
                  ? t('login.toggleToLogin')
                  : t('login.toggleToRegister')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090b14',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  titleHighlight: {
    color: '#6391ff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 22,
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendOtpBtn: {
    backgroundColor: 'rgba(99, 145, 255, 0.15)',
    borderColor: 'rgba(99, 145, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendOtpText: {
    color: '#6391ff',
    fontSize: 12,
    fontWeight: '700',
  },
  otpInputBox: {
    marginTop: 6,
  },
  otpCodeInput: {
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    fontWeight: '700',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  eyeButton: {
    padding: 12,
  },
  eyeText: {
    fontSize: 16,
  },
  submitBtn: {
    marginTop: 20,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleModeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleModeText: {
    color: '#6391ff',
    fontSize: 13,
    fontWeight: '600',
  },
});
