/**
 * ============================================================================
 * FlakeSecure Mobile App - Login & Registration Screen v2.0
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { AppIcon } from '../components/CategoryIcons';
import { sendOtp, verifyOtp } from '../utils/api';

export default function LoginScreen({ navigation }) {
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedAge, setAcceptedAge] = useState(false);

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

    if (!acceptedTerms || !acceptedAge) {
      Alert.alert(t('error'), t('login.acceptTermsRequired'));
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
              <AppIcon name="snowflake" size={32} color={colors.gold} />
            </View>
            <Text style={[styles.title, { color: colors.textMain }]}>
              Flake<Text style={{ color: colors.gold }}>Secure</Text>
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSub }]}>
              {isRegisterMode ? t('login.registerTitle') : t('login.subtitle')}
            </Text>
          </View>

          <View style={[styles.form, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            {isRegisterMode ? (
              <>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('onboarding.account.email')}</Text>
                <View style={styles.otpRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                    placeholder="email@domain.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.sendOtpBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
                    onPress={handleSendOtp}
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : (
                      <Text style={[styles.sendOtpText, { color: colors.gold }]}>{otpSent ? t('login.resendOtp') : t('login.sendOtp')}</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {otpSent && (
                  <View style={styles.otpInputBox}>
                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('login.otpLabel')}</Text>
                    <TextInput
                      style={[styles.input, styles.otpCodeInput, { backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.gold }]}
                      placeholder={t('login.otpPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                )}

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('onboarding.account.username')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('onboarding.account.password')}</Text>
                <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textMain }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('onboarding.account.confirmPassword')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />

                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: colors.border, backgroundColor: colors.inputBg },
                    acceptedTerms && { backgroundColor: colors.gold, borderColor: colors.gold }
                  ]}>
                    {acceptedTerms && <AppIcon name="check" size={12} color="#ffffff" />}
                  </View>
                  <Text style={[styles.termsLabel, { color: colors.textSub }]}>
                    {t('login.acceptTermsCheckbox')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setAcceptedAge(!acceptedAge)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: colors.border, backgroundColor: colors.inputBg },
                    acceptedAge && { backgroundColor: colors.gold, borderColor: colors.gold }
                  ]}>
                    {acceptedAge && <AppIcon name="check" size={12} color="#ffffff" />}
                  </View>
                  <Text style={[styles.termsLabel, { color: colors.textSub }]}>
                    {t('login.acceptAgeCheckbox')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
                  <LinearGradient
                    colors={colors.goldGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.submitBtnText}>{t('login.registerButton')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('login.emailOrUsername')}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                  placeholder="user@domain.com / username"
                  placeholderTextColor={colors.textMuted}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('login.password')}</Text>
                <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textMain }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleLogin} disabled={loading}>
                  <LinearGradient
                    colors={colors.goldGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
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
              <Text style={[styles.toggleModeText, { color: colors.gold }]}>
                {isRegisterMode
                  ? t('login.toggleToLogin')
                  : t('login.toggleToRegister')}
              </Text>
            </TouchableOpacity>

            <View style={[styles.legalLinksRow, { borderTopColor: colors.border }]}>
              <TouchableOpacity onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/terms')}>
                <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>{t('login.termsLink')}</Text>
              </TouchableOpacity>
              <Text style={[styles.legalLinkSeparator, { color: colors.textMuted }]}>•</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/legal')}>
                <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>{t('login.privacyLink')}</Text>
              </TouchableOpacity>
              <Text style={[styles.legalLinkSeparator, { color: colors.textMuted }]}>•</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/imprint')}>
                <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>{t('login.imprintLink')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  form: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendOtpBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendOtpText: {
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
    borderWidth: 1,
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  eyeButton: {
    padding: 10,
  },
  submitBtn: {
    marginTop: 18,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientBtn: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  toggleModeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  toggleModeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  termsLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  legalLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  legalLinkText: {
    fontSize: 11,
    fontWeight: '500',
  },
  legalLinkSeparator: {
    marginHorizontal: 8,
    fontSize: 10,
  },
});
