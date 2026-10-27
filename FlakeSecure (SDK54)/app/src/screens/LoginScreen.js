/**
 * ============================================================================
 * FlakeSecure Mobile App - Login & Registration Screen v2.1
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import { AppIcon } from '../components/CategoryIcons';
import PasswordChecklist, { usePasswordValidation } from '../components/PasswordChecklist';
import { formatAuthServerError } from '../utils/passwordPolicy';
import { sendOtp, verifyOtp } from '../utils/api';

export default function LoginScreen() {
  const {
    login,
    register,
    isOfflineMode,
    hasSavedBiometricCredentials,
    unlockLocalVaultOffline,
  } = useAuth();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const toast = useToast();

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

  // Rich Login Error states
  const [hasAuthError, setHasAuthError] = useState(false);
  const [showOfflineCard, setShowOfflineCard] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
  const [policyHighlight, setPolicyHighlight] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (rateLimitRemaining <= 0) return;
    const timer = setInterval(() => {
      setRateLimitRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitRemaining]);

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const { evaluation: pwEval, pwnedState, isPasswordReady } = usePasswordValidation(
    isRegisterMode ? password : '',
    username,
    email
  );
  const canSubmitRegister =
    !loading &&
    rateLimitRemaining <= 0 &&
    isPasswordReady &&
    password === confirmPassword &&
    email.trim().includes('@') &&
    username.trim().length > 0 &&
    otpSent &&
    otpCode.trim().length === 6 &&
    acceptedTerms &&
    acceptedAge;

  const handleLogin = async () => {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      toast.warn(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    setHasAuthError(false);
    setShowOfflineCard(false);
    setLoading(true);
    try {
      await login(cleanIdentifier, cleanPassword);
    } catch (err) {
      if (err?.isNetworkError || !err?.status) {
        setShowOfflineCard(true);
        toast.warn(
          t('offline.loginOfflineCardTitle'),
          t('offline.loginOfflineCardDesc')
        );
      } else if (err.status === 401) {
        setHasAuthError(true);
        triggerShake();
        toast.error(t('offline.wrongPasswordTitle'), t('offline.wrongPasswordMsg'));
      } else if (err.status === 429) {
        const secs = err.retryAfter || 30;
        setRateLimitRemaining(secs);
        toast.warn(
          t('offline.rateLimitedTitle'),
          t('offline.rateLimitedCountdown', { seconds: secs })
        );
      } else if (err.status >= 500) {
        toast.error(
          t('offline.serverErrorTitle', { status: err.status }),
          t('offline.serverErrorMsg')
        );
      } else {
        setHasAuthError(true);
        triggerShake();
        toast.error(t('login.failed'), err.message || t('login.invalidCredentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.warn(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }

    setSendingOtp(true);
    try {
      await sendOtp(cleanEmail, 'register');
      setOtpSent(true);
      toast.success(t('success'), t('login.otpSentAlert', { email: cleanEmail }));
    } catch (e) {
      if (e?.isNetworkError || !e?.status) {
        setShowOfflineCard(true);
        toast.warn(
          t('offline.loginOfflineCardTitle'),
          t('offline.loginOfflineCardDesc')
        );
      } else {
        toast.error(t('error'), e.message || t('login.otpSendFailed'));
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanOtp = otpCode.trim();

    if (!cleanEmail || !cleanUsername || !password) {
      toast.warn(t('error'), t('viewCredential.allFieldsRequired'));
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      toast.warn(t('error'), t('onboarding.account.usernameRules'));
      return;
    }
    if (!pwEval.isValid) {
      setPolicyHighlight(true);
      toast.error(t('error'), t('passwordPolicy.errWeakPassword'));
      return;
    }
    if (pwnedState.pwned) {
      setPolicyHighlight(true);
      toast.error(t('error'), t('passwordPolicy.pwnedWarning', { count: pwnedState.count }));
      return;
    }
    if (password !== confirmPassword) {
      toast.warn(t('error'), t('onboarding.account.passwordsDoNotMatch'));
      return;
    }

    if (!otpSent || !cleanOtp || cleanOtp.length !== 6) {
      toast.warn(t('error'), t('onboarding.account.otpLabel'));
      return;
    }

    if (!acceptedTerms || !acceptedAge) {
      toast.warn(t('error'), t('login.acceptTermsRequired'));
      return;
    }

    setPolicyHighlight(false);
    setLoading(true);
    try {
      const verifyRes = await verifyOtp(cleanEmail, cleanOtp, 'register');
      const otpToken = verifyRes.token;
      await register(cleanEmail, cleanUsername, password, otpToken);
    } catch (err) {
      if (err?.code === 'PASSWORD_POLICY_FAILED') {
        setPolicyHighlight(true);
      }
      toast.error(t('error'), formatAuthServerError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleOfflineBiometricOpen = async () => {
    const res = await unlockLocalVaultOffline();
    if (!res?.success && res?.reason !== 'cancelled') {
      toast.error(t('error'), t('biometricUnlock.failed'));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.goldBg, borderColor: colors.goldBorder },
              ]}
            >
              <AppIcon name="snowflake" size={32} color={colors.gold} />
            </View>
            <Text style={[styles.title, { color: colors.textMain }]}>
              Flake<Text style={{ color: colors.gold }}>Secure</Text>
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSub }]}>
              {isRegisterMode ? t('login.registerTitle') : t('login.subtitle')}
            </Text>
          </View>

          {(showOfflineCard || isOfflineMode) && (
            <View
              style={[
                styles.offlineCard,
                {
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  borderColor: 'rgba(245, 158, 11, 0.45)',
                },
              ]}
            >
              <View style={styles.offlineCardHeader}>
                <AppIcon name="offline-cloud" size={20} color="#f59e0b" />
                <Text style={[styles.offlineCardTitle, { color: colors.textMain }]}>
                  {t('offline.loginOfflineCardTitle')}
                </Text>
              </View>
              <Text style={[styles.offlineCardDesc, { color: colors.textSub }]}>
                {t('offline.loginOfflineCardDesc')}
              </Text>
              {hasSavedBiometricCredentials && (
                <TouchableOpacity
                  style={styles.offlineUnlockBtn}
                  onPress={handleOfflineBiometricOpen}
                  activeOpacity={0.85}
                >
                  <AppIcon name="scan" size={16} color="#090b14" />
                  <Text style={styles.offlineUnlockBtnText}>
                    {t('offline.openLocalVaultBiometricBtn')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {rateLimitRemaining > 0 && (
            <View
              style={[
                styles.rateLimitBanner,
                {
                  backgroundColor: 'rgba(245, 158, 11, 0.14)',
                  borderColor: 'rgba(245, 158, 11, 0.5)',
                },
              ]}
            >
              <AppIcon name="clock" size={18} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rateLimitTitle, { color: '#f59e0b' }]}>
                  {t('offline.rateLimitedTitle')}
                </Text>
                <Text style={[styles.rateLimitText, { color: colors.textSub }]}>
                  {t('offline.rateLimitedCountdown', { seconds: rateLimitRemaining })}
                </Text>
              </View>
            </View>
          )}

          <Animated.View
            style={[
              styles.form,
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                transform: [{ translateX: shakeAnim }],
              },
            ]}
          >
            {isRegisterMode ? (
              <>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('onboarding.account.email')}
                </Text>
                <View style={styles.otpRow}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                        color: colors.textMain,
                      },
                    ]}
                    placeholder="email@domain.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendOtpBtn,
                      { backgroundColor: colors.goldBg, borderColor: colors.goldBorder },
                    ]}
                    onPress={handleSendOtp}
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : (
                      <Text style={[styles.sendOtpText, { color: colors.gold }]}>
                        {otpSent ? t('login.resendOtp') : t('login.sendOtp')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {otpSent && (
                  <View style={styles.otpInputBox}>
                    <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                      {t('login.otpLabel')}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.otpCodeInput,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.gold,
                          color: colors.gold,
                        },
                      ]}
                      placeholder={t('login.otpPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View
                      style={[
                        styles.otpHintRow,
                        { backgroundColor: colors.goldBg, borderColor: colors.goldBorder },
                      ]}
                    >
                      <AppIcon name="info" size={14} color={colors.gold} />
                      <Text style={[styles.otpHintText, { color: colors.textSub }]}>
                        {t('login.otpNoticeHint')}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('onboarding.account.username')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('onboarding.account.password')}
                </Text>
                <View
                  style={[
                    styles.passwordContainer,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: policyHighlight ? '#ef4444' : colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textMain }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setPolicyHighlight(false);
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <AppIcon
                      name={showPassword ? 'eyeOff' : 'eye'}
                      size={18}
                      color={colors.gold}
                    />
                  </TouchableOpacity>
                </View>
                <View
                  style={
                    policyHighlight
                      ? {
                          borderWidth: 1,
                          borderColor: 'rgba(239, 68, 68, 0.5)',
                          borderRadius: 8,
                          padding: 4,
                          marginTop: 4,
                        }
                      : null
                  }
                >
                  <PasswordChecklist
                    password={password}
                    evaluation={pwEval}
                    pwnedState={pwnedState}
                  />
                </View>

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('onboarding.account.confirmPassword')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: colors.isDark ? '#ffffff' : '#94a3b8',
                        backgroundColor: colors.inputBg,
                      },
                      acceptedTerms && {
                        backgroundColor: colors.gold,
                        borderColor: colors.gold,
                      },
                    ]}
                  >
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
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: colors.isDark ? '#ffffff' : '#94a3b8',
                        backgroundColor: colors.inputBg,
                      },
                      acceptedAge && {
                        backgroundColor: colors.gold,
                        borderColor: colors.gold,
                      },
                    ]}
                  >
                    {acceptedAge && <AppIcon name="check" size={12} color="#ffffff" />}
                  </View>
                  <Text style={[styles.termsLabel, { color: colors.textSub }]}>
                    {t('login.acceptAgeCheckbox')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, !canSubmitRegister && { opacity: 0.5 }]}
                  onPress={handleRegister}
                  disabled={!canSubmitRegister}
                >
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
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('login.emailOrUsername')}
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: hasAuthError ? '#ef4444' : colors.border,
                      color: colors.textMain,
                    },
                  ]}
                  placeholder="user@domain.com / username"
                  placeholderTextColor={colors.textMuted}
                  value={identifier}
                  onChangeText={(v) => {
                    setIdentifier(v);
                    if (hasAuthError) setHasAuthError(false);
                  }}
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {t('login.password')}
                </Text>
                <View
                  style={[
                    styles.passwordContainer,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: hasAuthError ? '#ef4444' : colors.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textMain }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (hasAuthError) setHasAuthError(false);
                    }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <AppIcon
                      name={showPassword ? 'eyeOff' : 'eye'}
                      size={18}
                      color={colors.gold}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (loading || rateLimitRemaining > 0) && { opacity: 0.55 },
                  ]}
                  onPress={handleLogin}
                  disabled={loading || rateLimitRemaining > 0}
                >
                  <LinearGradient
                    colors={colors.goldGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBtn}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : rateLimitRemaining > 0 ? (
                      <Text style={styles.submitBtnText}>
                        {t('login.loginButton')} ({rateLimitRemaining}s)
                      </Text>
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
                setHasAuthError(false);
              }}
            >
              <Text style={[styles.toggleModeText, { color: colors.gold }]}>
                {isRegisterMode ? t('login.toggleToLogin') : t('login.toggleToRegister')}
              </Text>
            </TouchableOpacity>

            <View style={[styles.legalLinksRow, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/terms')}
              >
                <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>
                  {t('login.termsLink')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.legalLinkSeparator, { color: colors.textMuted }]}>
                •
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://flakesecure.snowystudio.dev/legal')}
              >
                <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>
                  {t('login.privacyLink')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.legalLinkSeparator, { color: colors.textMuted }]}>
                •
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://flakesecure.snowystudio.dev/imprint')
                }
              >
                <Text style={[styles.legalLinkText, { color: colors.textMuted }]}>
                  {t('login.imprintLink')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    marginBottom: 20,
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
  offlineCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  offlineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  offlineCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  offlineCardDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  offlineUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 9,
  },
  offlineUnlockBtnText: {
    color: '#090b14',
    fontSize: 13,
    fontWeight: '800',
  },
  rateLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  rateLimitTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  rateLimitText: {
    fontSize: 12,
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
  otpHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  otpHintText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
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
