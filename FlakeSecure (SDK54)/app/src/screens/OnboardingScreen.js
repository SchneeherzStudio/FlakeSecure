/**
 * ============================================================================
 * FlakeSecure Mobile App - Onboarding Flow Screen (OnboardingScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. STEP-BY-STEP WALKTHROUGH:
 *    - Step 0 (Welcome): Introduction to key features (zero-knowledge, biometrics, autofill).
 *    - Step 1 (How it works): 3-step explanation of the authentication pipeline.
 *    - Step 2 (Browser Extension): Overview of Chrome and Firefox browser companion extensions.
 *    - Step 3 (Language): Interactive language picker (EN, DE, FR, ES) with instant localization switch.
 * 
 * 2. ACCOUNT CREATION & FINISH:
 *    - Step 4 (Account): Account registration with live password entropy indicator (getPasswordStrength) and validation.
 *    - Step 5 (Done): Success screen and persistence of onboarding completion in AsyncStorage.
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const { width } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function OnboardingScreen({ onComplete }) {
  const { register } = useAuth();
  const { t, locale, changeLanguage: setAppLang } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(locale || 'en');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  const totalSteps = 6;

  const changeLanguage = (code) => {
    setSelectedLanguage(code);
    setAppLang(code);
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert(t('error'), 'Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    setSendingOtp(true);
    try {
      const { sendOtp } = require('../utils/api');
      await sendOtp(cleanEmail, 'register');
      setOtpSent(true);
      Alert.alert('Code gesendet 📧', `Wir haben einen 6-stelligen Bestätigungscode an ${cleanEmail} gesendet.`);
    } catch (e) {
      Alert.alert('Fehler', e.message || 'Konnte Verifizierungscode nicht senden.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleCreateAccount = async () => {
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
      Alert.alert('E-Mail-Verifizierung', 'Bitte fordere zuerst einen Verifizierungscode für deine E-Mail an.');
      return;
    }

    if (!cleanOtp || cleanOtp.length !== 6) {
      Alert.alert('Code erforderlich', 'Bitte gib den 6-stelligen Verifizierungscode aus deiner E-Mail ein.');
      return;
    }

    setRegistering(true);
    try {
      const { verifyOtp } = require('../utils/api');
      const verifyRes = await verifyOtp(cleanEmail, cleanOtp, 'register');
      const otpToken = verifyRes.token;
      await register(cleanEmail, cleanUsername, cleanPassword, otpToken);
      handleNext();
    } catch (err) {
      Alert.alert(t('error'), err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    await AsyncStorage.setItem('app_language', selectedLanguage);
    if (onComplete) onComplete();
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return { level: 0, label: '', color: '#333' };
    if (password.length < 6) return { level: 1, label: t('onboarding.account.weak'), color: '#ef4444' };
    if (password.length < 8) return { level: 2, label: t('onboarding.account.fair'), color: '#f59e0b' };
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length;
    if (score >= 3 && password.length >= 10) return { level: 4, label: t('onboarding.account.strong'), color: '#22c55e' };
    if (score >= 2) return { level: 3, label: t('onboarding.account.good'), color: '#6391ff' };
    return { level: 2, label: t('onboarding.account.fair'), color: '#f59e0b' };
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.slide}>
            <Text style={styles.welcomeEmoji}>❄️</Text>
            <Text style={styles.welcomeTitle}>
              {t('common.appName').split('Secure')[0]}
              <Text style={styles.accent}>Secure</Text>
            </Text>
            <Text style={styles.welcomeSubtitle}>{t('onboarding.welcome.subtitle')}</Text>
            <View style={styles.featureList}>
              {['🔐', '🧬', '⚡'].map((icon, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Text style={styles.featureIcon}>{icon}</Text>
                  <Text style={styles.featureText}>
                    {t(`onboarding.welcome.feature${idx + 1}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.slide}>
            <Text style={styles.slideTitle}>{t('onboarding.howItWorks.title')}</Text>
            <View style={styles.stepsContainer}>
              {[1, 2, 3].map((step) => (
                <View key={step} style={styles.stepItem}>
                  <LinearGradient
                    colors={['#6391ff', '#7c6aff']}
                    style={styles.stepNumber}
                  >
                    <Text style={styles.stepNumberText}>{step}</Text>
                  </LinearGradient>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>{t(`onboarding.howItWorks.step${step}Title`)}</Text>
                    <Text style={styles.stepDesc}>{t(`onboarding.howItWorks.step${step}`)}</Text>
                  </View>
                  {step < 3 && <View style={styles.stepConnector} />}
                </View>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.slide}>
            <Text style={styles.bigEmoji}>🧩</Text>
            <Text style={styles.slideTitle}>{t('onboarding.extension.title')}</Text>
            <Text style={styles.slideText}>{t('onboarding.extension.description')}</Text>
            <View style={styles.browserCards}>
              <View style={styles.browserCard}>
                <Text style={styles.browserIcon}>🌐</Text>
                <Text style={styles.browserName}>{t('onboarding.extension.chrome')}</Text>
              </View>
              <View style={styles.browserCard}>
                <Text style={styles.browserIcon}>🦊</Text>
                <Text style={styles.browserName}>{t('onboarding.extension.firefox')}</Text>
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.slide}>
            <Text style={styles.bigEmoji}>🌍</Text>
            <Text style={styles.slideTitle}>{t('onboarding.language.title')}</Text>
            <Text style={styles.slideText}>{t('onboarding.language.subtitle')}</Text>
            <View style={styles.languageList}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageItem,
                    selectedLanguage === lang.code && styles.languageItemActive
                  ]}
                  onPress={() => changeLanguage(lang.code)}
                >
                  <Text style={styles.languageFlag}>{lang.flag}</Text>
                  <Text style={[
                    styles.languageLabel,
                    selectedLanguage === lang.code && styles.languageLabelActive
                  ]}>{lang.label}</Text>
                  {selectedLanguage === lang.code && (
                    <Text style={styles.languageCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 4:
        const strength = getPasswordStrength();
        return (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.slide}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountSlide}>
              <Text style={styles.slideTitle}>{t('onboarding.account.title')}</Text>
              <Text style={styles.slideText}>{t('onboarding.account.subtitle')}</Text>
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('onboarding.account.email')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="you@example.com"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <TouchableOpacity
                      style={{
                        backgroundColor: 'rgba(99, 145, 255, 0.15)',
                        borderColor: 'rgba(99, 145, 255, 0.3)',
                        borderWidth: 1,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                      }}
                      onPress={handleSendOtp}
                      disabled={sendingOtp}
                    >
                      {sendingOtp ? (
                        <ActivityIndicator color="#6391ff" size="small" />
                      ) : (
                        <Text style={{ color: '#6391ff', fontSize: 12, fontWeight: '700' }}>
                          {otpSent ? 'Erneut' : 'Code'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {otpSent && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>E-Mail Bestätigungscode (6-stellig)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { fontSize: 18, letterSpacing: 4, textAlign: 'center', fontWeight: '700' },
                      ]}
                      placeholder="123456"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                )}
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('onboarding.account.username')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="flakeuser"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={username}
                    onChangeText={(text) => setUsername(text.toLowerCase())}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.inputHint}>{t('onboarding.account.usernameRuleHint')}</Text>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('onboarding.account.password')}</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.showBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.showBtnText}>{showPassword ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inputHint}>{t('onboarding.account.passwordRuleHint')}</Text>
                  {password.length > 0 && (
                    <View style={styles.strengthBar}>
                      <View style={styles.strengthTrack}>
                        {[1, 2, 3, 4].map((level) => (
                          <View
                            key={level}
                            style={[
                              styles.strengthSegment,
                              { backgroundColor: level <= strength.level ? strength.color : 'rgba(255,255,255,0.08)' }
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthLabel, { color: strength.color }]}>
                        {strength.label}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>{t('onboarding.account.confirmPassword')}</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255,255,255,0.25)"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.createAccountBtn}
                onPress={handleCreateAccount}
                disabled={registering}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={registering ? ['#333', '#444'] : ['#6391ff', '#7c6aff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  {registering ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.createAccountBtnText}>{t('onboarding.account.createButton')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alreadyHaveAccountBtn}
                onPress={handleFinish}
                disabled={registering}
              >
                <Text style={styles.alreadyHaveAccountText}>
                  {t('onboarding.account.alreadyHaveAccount')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        );

      case 5:
        return (
          <View style={styles.slide}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={styles.doneTitle}>{t('onboarding.done.title')}</Text>
            <Text style={styles.doneSubtitle}>{t('onboarding.done.subtitle')}</Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleFinish}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#6391ff', '#7c6aff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.doneBtnText}>{t('onboarding.done.button')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.progressDot,
              idx === currentStep && styles.progressDotActive,
              idx < currentStep && styles.progressDotDone
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        {renderStep()}
      </View>

      {currentStep !== 4 && currentStep !== 5 && (
        <View style={styles.navRow}>
          {currentStep > 0 ? (
            <TouchableOpacity onPress={handleBack} style={styles.navBtn}>
              <Text style={styles.navBtnText}>{t('common.back')}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={handleNext} style={styles.navBtn}>
            <LinearGradient
              colors={['#6391ff', '#7c6aff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.navBtnGradient}
            >
              <Text style={styles.navBtnNextText}>{t('onboarding.next')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
      {currentStep === 4 && (
        <View style={styles.navRow}>
          <TouchableOpacity onPress={handleBack} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <View />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090b14' },
  progressContainer: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, paddingVertical: 16
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)'
  },
  progressDotActive: {
    width: 24, backgroundColor: '#6391ff'
  },
  progressDotDone: {
    backgroundColor: 'rgba(99,145,255,0.4)'
  },
  content: { flex: 1, paddingHorizontal: 24 },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  accountSlide: { paddingTop: 20, paddingBottom: 40 },

  welcomeEmoji: { fontSize: 72, marginBottom: 16 },
  welcomeTitle: { fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1, marginBottom: 8 },
  accent: { color: '#6391ff' },
  welcomeSubtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 24, marginBottom: 32
  },
  featureList: { gap: 16, width: '100%' },
  featureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, padding: 16
  },
  featureIcon: { fontSize: 24 },
  featureText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', flex: 1 },

  bigEmoji: { fontSize: 64, marginBottom: 20 },
  slideTitle: {
    fontSize: 24, fontWeight: '700', color: '#fff',
    textAlign: 'center', marginBottom: 12
  },
  slideText: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 22, marginBottom: 24
  },

  stepsContainer: { width: '100%', gap: 0 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  stepNumber: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center'
  },
  stepNumberText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  stepContent: { flex: 1, paddingBottom: 20 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  stepDesc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  stepConnector: {
    position: 'absolute', left: 17, top: 36, width: 2, height: 20,
    backgroundColor: 'rgba(99,145,255,0.25)'
  },

  browserCards: { flexDirection: 'row', gap: 14 },
  browserCard: {
    flex: 1, alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, padding: 20
  },
  browserIcon: { fontSize: 36 },
  browserName: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },

  languageList: { width: '100%', gap: 10 },
  languageItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14, padding: 16
  },
  languageItemActive: {
    borderColor: 'rgba(99,145,255,0.5)',
    backgroundColor: 'rgba(99,145,255,0.08)'
  },
  languageFlag: { fontSize: 28 },
  languageLabel: { fontSize: 16, color: 'rgba(255,255,255,0.7)', flex: 1 },
  languageLabelActive: { color: '#fff', fontWeight: '600' },
  languageCheck: { fontSize: 18, color: '#6391ff', fontWeight: '700' },

  form: { gap: 18, width: '100%', marginBottom: 20 },
  fieldGroup: { gap: 8 },
  label: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', letterSpacing: 0.08
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 15
  },
  inputHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
  },
  passwordRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  showBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, width: 50, height: 50,
    alignItems: 'center', justifyContent: 'center'
  },
  showBtnText: { fontSize: 18 },
  strengthBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4
  },
  strengthTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 50 },
  createAccountBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  createAccountBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  gradientBtn: {
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center'
  },
  alreadyHaveAccountBtn: {
    marginTop: 16, alignItems: 'center', paddingVertical: 12
  },
  alreadyHaveAccountText: {
    color: '#6391ff', fontSize: 15, fontWeight: '600'
  },

  doneEmoji: { fontSize: 72, marginBottom: 20 },
  doneTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 10 },
  doneSubtitle: {
    fontSize: 16, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 24, marginBottom: 32
  },
  doneButton: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  doneBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },

  navRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20
  },
  navBtn: { minWidth: 60 },
  navBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  navBtnGradient: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12
  },
  navBtnNextText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
