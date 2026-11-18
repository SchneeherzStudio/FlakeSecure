/**
 * ============================================================================
 * FlakeSecure Mobile App - Onboarding Flow Screen (OnboardingScreen)
 * ============================================================================
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import { AppIcon } from '../components/CategoryIcons';
import PasswordChecklist, { usePasswordValidation } from '../components/PasswordChecklist';
import YukiGuide from '../components/yuki/YukiGuide';
import { TOUR_STORAGE_KEYS } from '../tutorial/tours';
import { formatAuthServerError } from '../utils/passwordPolicy';
import { sendOtp, verifyOtp } from '../utils/api';
import { registerDeviceForPushNotifications } from '../utils/notifications';

const { width } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'en', label: 'English', badge: 'EN' },
  { code: 'de', label: 'Deutsch', badge: 'DE' },
  { code: 'fr', label: 'Français', badge: 'FR' },
  { code: 'es', label: 'Español', badge: 'ES' },
];

export default function OnboardingScreen({ onComplete }) {
  const { register } = useAuth();
  const { t, locale, changeLanguage: setAppLang } = useLanguage();
  const { colors } = useTheme();
  const toast = useToast();
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedAge, setAcceptedAge] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const { evaluation: pwEval, pwnedState, isPasswordReady } = usePasswordValidation(
    password,
    username,
    email
  );
  const canCreateAccount =
    !registering &&
    isPasswordReady &&
    password === confirmPassword &&
    email.trim().includes('@') &&
    username.trim().length > 0 &&
    otpSent &&
    otpCode.trim().length === 6 &&
    acceptedTerms &&
    acceptedAge;

  const totalSteps = 7;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateToStep = (nextStep) => {
    fadeAnim.setValue(0.35);
    setCurrentStep(nextStep);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const changeLanguage = (code) => {
    setSelectedLanguage(code);
    setAppLang(code);
  };

  const toggleLanguageQuick = () => {
    const list = ['de', 'en', 'fr', 'es'];
    const curIdx = list.indexOf(selectedLanguage || locale || 'de');
    const nextLang = list[(curIdx + 1) % list.length];
    changeLanguage(nextLang);
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      animateToStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      animateToStep(currentStep - 1);
    }
  };

  const handleSkipToAccount = () => {
    animateToStep(5);
  };

  const handleEnableNotifications = async () => {
    setNotifLoading(true);
    try {
      await AsyncStorage.removeItem('user_declined_notifications');
      let NotificationsModule = null;
      try {
        NotificationsModule = require('expo-notifications');
      } catch {}
      if (NotificationsModule?.requestPermissionsAsync) {
        const res = await NotificationsModule.requestPermissionsAsync();
        if (res?.status === 'granted') {
          await registerDeviceForPushNotifications(selectedLanguage || locale || 'de');
        }
      }
    } catch (e) {
      console.log('[Onboarding] Enable notifications error:', e?.message);
    } finally {
      setNotifLoading(false);
      handleNext();
    }
  };

  const handleDeclineNotifications = async () => {
    try {
      await AsyncStorage.setItem('user_declined_notifications', 'true');
    } catch (e) {
      console.log('[Onboarding] Decline notifications error:', e?.message);
    }
    handleNext();
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
      toast.error(t('error'), e.message || t('login.otpSendFailed'));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleCreateAccount = async () => {
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
      toast.warn(t('error'), t('passwordPolicy.errWeakPassword'));
      return;
    }
    if (pwnedState.pwned) {
      toast.error(t('error'), t('passwordPolicy.pwnedWarning', { count: pwnedState.count }));
      return;
    }
    if (password !== confirmPassword) {
      toast.warn(t('error'), t('onboarding.account.passwordsDoNotMatch'));
      return;
    }

    if (!otpSent) {
      toast.warn(t('error'), t('onboarding.account.otpLabel'));
      return;
    }

    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.warn(t('error'), t('onboarding.account.otpLabel'));
      return;
    }

    if (!acceptedTerms || !acceptedAge) {
      toast.warn(t('error'), t('login.acceptTermsRequired'));
      return;
    }

    setRegistering(true);
    try {
      const verifyRes = await verifyOtp(cleanEmail, cleanOtp, 'register');
      const otpToken = verifyRes.token;
      await register(cleanEmail, cleanUsername, password, otpToken);
      handleNext();
    } catch (err) {
      toast.error(t('error'), formatAuthServerError(err, t));
    } finally {
      setRegistering(false);
    }
  };

  const handleFinish = async (skipTour = false) => {
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    await AsyncStorage.setItem('app_language', selectedLanguage);
    if (skipTour) {
      await AsyncStorage.setItem(TOUR_STORAGE_KEYS.homeDone, 'true');
      await AsyncStorage.removeItem(TOUR_STORAGE_KEYS.homePending);
    } else {
      await AsyncStorage.setItem(TOUR_STORAGE_KEYS.homePending, 'true');
    }
    if (onComplete) onComplete();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <ScrollView style={styles.fullScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideScroll}>
            <YukiGuide
              mode="onboarding"
              pose="wave"
              text={t('onboarding.yuki.welcome')}
            />
            <View style={[styles.welcomeIconBox, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
              <AppIcon name="snowflake" size={44} color={colors.gold} />
            </View>
            <Text style={[styles.welcomeTitle, { color: colors.textMain }]}>
              {t('common.appName').split('Secure')[0]}
              <Text style={{ color: colors.gold }}>Secure</Text>
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.textSub }]}>{t('onboarding.welcome.subtitle')}</Text>
            <View style={styles.featureList}>
              {[
                { icon: 'lock', key: 'feature1' },
                { icon: 'scan', key: 'feature2' },
                { icon: 'shield', key: 'feature3' },
              ].map((item, idx) => (
                <View key={idx} style={[styles.featureItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={[styles.featureIconContainer, { backgroundColor: colors.goldBg }]}>
                    <AppIcon name={item.icon} size={20} color={colors.gold} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.textSub }]}>
                    {t(`onboarding.welcome.${item.key}`)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        );

      case 1:
        return (
          <ScrollView style={styles.fullScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideScroll}>
            <YukiGuide
              mode="onboarding"
              pose="stand"
              text={t('onboarding.yuki.howItWorks')}
            />
            <Text style={[styles.slideTitle, { color: colors.textMain }]}>{t('onboarding.howItWorks.title')}</Text>
            <View style={styles.stepsContainer}>
              {[1, 2, 3].map((step) => (
                <View key={step} style={styles.stepItem}>
                  <LinearGradient
                    colors={colors.goldGradient}
                    style={styles.stepNumber}
                  >
                    <Text style={styles.stepNumberText}>{step}</Text>
                  </LinearGradient>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, { color: colors.textMain }]}>{t(`onboarding.howItWorks.step${step}Title`)}</Text>
                    <Text style={[styles.stepDesc, { color: colors.textSub }]}>{t(`onboarding.howItWorks.step${step}`)}</Text>
                  </View>
                  {step < 3 && <View style={[styles.stepConnector, { backgroundColor: colors.goldBorder }]} />}
                </View>
              ))}
            </View>
          </ScrollView>
        );

      case 2:
        return (
          <ScrollView style={styles.fullScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideScroll}>
            <YukiGuide
              mode="onboarding"
              pose="sit"
              text={t('onboarding.yuki.requirements')}
            />
            <Text style={[styles.slideTitle, { color: colors.textMain }]}>
              {t('onboarding.requirements.title')}
            </Text>
            <Text style={[styles.slideText, { color: colors.textSub, marginBottom: 14 }]}>
              {t('onboarding.requirements.subtitle')}
            </Text>

            <View style={styles.reqList}>
              {[
                {
                  icon: 'scan',
                  titleKey: 'cameraTitle',
                  descKey: 'cameraDesc',
                  badgeKey: 'badgeOnDemand',
                  isOptional: false,
                },
                {
                  icon: 'bell',
                  titleKey: 'notifTitle',
                  descKey: 'notifDesc',
                  badgeKey: 'badgeOptional',
                  isOptional: true,
                },
                {
                  icon: 'shield',
                  titleKey: 'bioTitle',
                  descKey: 'bioDesc',
                  badgeKey: 'badgeOnDemand',
                  isOptional: false,
                },
                {
                  icon: 'key',
                  titleKey: 'autofillTitle',
                  descKey: 'autofillDesc',
                  badgeKey: 'badgeOptional',
                  isOptional: true,
                },
              ].map((req) => (
                <View
                  key={req.titleKey}
                  style={[styles.reqCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                >
                  <View style={[styles.reqIconBox, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                    <AppIcon name={req.icon} size={18} color={colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.reqHeaderRow}>
                      <Text style={[styles.reqTitle, { color: colors.textMain }]}>
                        {t(`onboarding.requirements.${req.titleKey}`)}
                      </Text>
                      <View
                        style={[
                          styles.reqBadge,
                          {
                            backgroundColor: req.isOptional ? colors.inputBg : colors.goldBg,
                            borderColor: req.isOptional ? colors.border : colors.goldBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reqBadgeText,
                            { color: req.isOptional ? colors.textMuted : colors.gold },
                          ]}
                        >
                          {t(`onboarding.requirements.${req.badgeKey}`)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.reqDesc, { color: colors.textSub }]}>
                      {t(`onboarding.requirements.${req.descKey}`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={[styles.reqFooterNote, { color: colors.textMuted }]}>
              {t('onboarding.requirements.footerNote')}
            </Text>
          </ScrollView>
        );

      case 3:
        return (
          <ScrollView style={styles.fullScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideScroll}>
            <YukiGuide
              mode="onboarding"
              pose="peek"
              text={t('onboarding.yuki.extension')}
            />
            <View style={[styles.welcomeIconBox, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder, marginBottom: 14 }]}>
              <AppIcon name="code" size={40} color={colors.gold} />
            </View>
            <Text style={[styles.slideTitle, { color: colors.textMain }]}>{t('onboarding.extension.title')}</Text>
            <Text style={[styles.slideText, { color: colors.textSub }]}>{t('onboarding.extension.description')}</Text>
            <View style={styles.browserCards}>
              <View style={[styles.browserCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Svg width={32} height={32} viewBox="0 0 24 24">
                  <Path
                    fill="#4285F4"
                    d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"
                  />
                </Svg>
                <Text style={[styles.browserName, { color: colors.textMain }]}>{t('onboarding.extension.chrome')}</Text>
              </View>
              <View style={[styles.browserCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <Svg width={32} height={32} viewBox="0 0 24 24">
                  <Path
                    fill="#FF7139"
                    d="M8.824 7.287c.008 0 .004 0 0 0zm-2.8-1.4c.006 0 .003 0 0 0zm16.754 2.161c-.505-1.215-1.53-2.528-2.333-2.943.654 1.283 1.033 2.57 1.177 3.53l.002.02c-1.314-3.278-3.544-4.6-5.366-7.477-.091-.147-.184-.292-.273-.446a3.545 3.545 0 01-.13-.24 2.118 2.118 0 01-.172-.46.03.03 0 00-.027-.03.038.038 0 00-.021 0l-.006.001a.037.037 0 00-.01.005L15.624 0c-2.585 1.515-3.657 4.168-3.932 5.856a6.197 6.197 0 00-2.305.587.297.297 0 00-.147.37c.057.162.24.24.396.17a5.622 5.622 0 012.008-.523l.067-.005a5.847 5.847 0 011.957.222l.095.03a5.816 5.816 0 01.616.228c.08.036.16.073.238.112l.107.055a5.835 5.835 0 01.368.211 5.953 5.953 0 012.034 2.104c-.62-.437-1.733-.868-2.803-.681 4.183 2.09 3.06 9.292-2.737 9.02a5.164 5.164 0 01-1.513-.292 4.42 4.42 0 01-.538-.232c-1.42-.735-2.593-2.121-2.74-3.806 0 0 .537-2 3.845-2 .357 0 1.38-.998 1.398-1.287-.005-.095-2.029-.9-2.817-1.677-.422-.416-.622-.616-.8-.767a3.47 3.47 0 00-.301-.227 5.388 5.388 0 01-.032-2.842c-1.195.544-2.124 1.403-2.8 2.163h-.006c-.46-.584-.428-2.51-.402-2.913-.006-.025-.343.176-.389.206-.406.29-.787.616-1.136.974-.397.403-.76.839-1.085 1.303a9.816 9.816 0 00-1.562 3.52c-.003.013-.11.487-.19 1.073-.013.09-.026.181-.037.272a7.8 7.8 0 00-.069.667l-.002.034-.023.387-.001.06C.386 18.795 5.593 24 12.016 24c5.752 0 10.527-4.176 11.463-9.661.02-.149.035-.298.052-.448.232-1.994-.025-4.09-.753-5.844z"
                  />
                </Svg>
                <Text style={[styles.browserName, { color: colors.textMain }]}>{t('onboarding.extension.firefox')}</Text>
              </View>
            </View>
          </ScrollView>
        );

      case 4:
        return (
          <ScrollView style={styles.fullScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideScroll}>
            <YukiGuide
              mode="onboarding"
              pose="butterfly"
              text={t('onboarding.yuki.notifications')}
            />
            <Text style={[styles.slideTitle, { color: colors.textMain }]}>
              {t('onboarding.notifications.title')}
            </Text>
            <Text style={[styles.slideText, { color: colors.textSub, marginBottom: 14 }]}>
              {t('onboarding.notifications.subtitle')}
            </Text>

            <View style={styles.notifReasonsList}>
              <View style={[styles.notifReasonCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.notifReasonIcon, { backgroundColor: colors.goldBg }]}>
                  <AppIcon name="scan" size={18} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifReasonTitle, { color: colors.textMain }]}>
                    {t('onboarding.notifications.reason1Title')}
                  </Text>
                  <Text style={[styles.notifReasonDesc, { color: colors.textSub }]}>
                    {t('onboarding.notifications.reason1Desc')}
                  </Text>
                </View>
              </View>

              <View style={[styles.notifReasonCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.notifReasonIcon, { backgroundColor: colors.goldBg }]}>
                  <AppIcon name="shield" size={18} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifReasonTitle, { color: colors.textMain }]}>
                    {t('onboarding.notifications.reason2Title')}
                  </Text>
                  <Text style={[styles.notifReasonDesc, { color: colors.textSub }]}>
                    {t('onboarding.notifications.reason2Desc')}
                  </Text>
                </View>
              </View>

              <View style={[styles.notifReasonCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.notifReasonIcon, { backgroundColor: colors.goldBg }]}>
                  <AppIcon name="bell" size={18} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifReasonTitle, { color: colors.textMain }]}>
                    {t('onboarding.notifications.reason3Title')}
                  </Text>
                  <Text style={[styles.notifReasonDesc, { color: colors.textSub }]}>
                    {t('onboarding.notifications.reason3Desc')}
                  </Text>
                </View>
              </View>
            </View>

            {/* In-App Decision BEFORE OS-Prompt */}
            <View style={styles.notifActionContainer}>
              <TouchableOpacity
                style={styles.notifPrimaryBtn}
                onPress={handleEnableNotifications}
                disabled={notifLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={colors.goldGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  {notifLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.notifPrimaryBtnText}>
                      {t('onboarding.notifications.enableBtn')}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.notifDeclineBtn}
                onPress={handleDeclineNotifications}
                disabled={notifLoading}
                activeOpacity={0.7}
              >
                <Text style={[styles.notifDeclineBtnText, { color: colors.textMuted }]}>
                  {t('onboarding.notifications.declineBtn')}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.notifAdvisoryNote, { color: colors.textMuted }]}>
                {t('onboarding.notifications.note')}
              </Text>
            </View>
          </ScrollView>
        );

      case 5:
        return (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.accountWrapper}
          >
            <ScrollView style={styles.fullScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.accountSlide}>
              <YukiGuide
                mode="onboardingCompact"
                pose="relax"
                text={t('onboarding.yuki.account')}
              />
              <Text style={[styles.slideTitle, { color: colors.textMain }]}>{t('onboarding.account.title')}</Text>
              <Text style={[styles.slideText, { color: colors.textSub }]}>{t('onboarding.account.subtitle')}</Text>
              <View style={[styles.form, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.email')}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.textMuted}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                    />
                    <TouchableOpacity
                      style={[styles.sendOtpBtn, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}
                      onPress={handleSendOtp}
                      disabled={sendingOtp}
                    >
                      {sendingOtp ? (
                        <ActivityIndicator color={colors.gold} size="small" />
                      ) : (
                        <Text style={[styles.sendOtpText, { color: colors.gold }]}>
                          {otpSent ? t('onboarding.account.resendCode') : t('onboarding.account.sendCode')}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {otpSent && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.otpLabel')}</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { fontSize: 18, letterSpacing: 4, textAlign: 'center', fontWeight: '700', backgroundColor: colors.inputBg, borderColor: colors.gold, color: colors.gold },
                      ]}
                      placeholder="123456"
                      placeholderTextColor={colors.textMuted}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={[styles.otpHintRow, { backgroundColor: colors.goldBg, borderColor: colors.goldBorder }]}>
                      <AppIcon name="info" size={14} color={colors.gold} />
                      <Text style={[styles.otpHintText, { color: colors.textSub }]}>
                        {t('login.otpNoticeHint')}
                      </Text>
                    </View>
                  </View>
                )}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.username')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                    placeholder="flakeuser"
                    placeholderTextColor={colors.textMuted}
                    value={username}
                    onChangeText={(text) => setUsername(text.toLowerCase())}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={[styles.inputHint, { color: colors.textMuted }]}>{t('onboarding.account.usernameRuleHint')}</Text>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.password')}</Text>
                  <View style={[styles.passwordRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.passwordInput, { color: colors.textMain }]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.showBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <AppIcon name={showPassword ? 'eyeOff' : 'eye'} size={18} color={colors.gold} />
                    </TouchableOpacity>
                  </View>
                  <PasswordChecklist password={password} evaluation={pwEval} pwnedState={pwnedState} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{t('onboarding.account.confirmPassword')}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMain }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Terms & Privacy Checkbox */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: colors.isDark ? '#ffffff' : '#94a3b8', backgroundColor: colors.inputBg },
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
                  { borderColor: colors.isDark ? '#ffffff' : '#94a3b8', backgroundColor: colors.inputBg },
                  acceptedAge && { backgroundColor: colors.gold, borderColor: colors.gold }
                ]}>
                  {acceptedAge && <AppIcon name="check" size={12} color="#ffffff" />}
                </View>
                <Text style={[styles.termsLabel, { color: colors.textSub }]}>
                  {t('login.acceptAgeCheckbox')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createAccountBtn, !canCreateAccount && { opacity: 0.5 }]}
                onPress={handleCreateAccount}
                disabled={!canCreateAccount}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={registering ? ['#333', '#444'] : colors.goldGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBtn}
                >
                  {registering ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.createAccountBtnText}>{t('onboarding.account.createButton')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alreadyHaveAccountBtn}
                onPress={() => handleFinish(false)}
                disabled={registering}
              >
                <Text style={[styles.alreadyHaveAccountText, { color: colors.gold }]}>
                  {t('onboarding.account.alreadyHaveAccount')}
                </Text>
              </TouchableOpacity>

              {/* Legal Links */}
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
            </ScrollView>
          </KeyboardAvoidingView>
        );

      case 6:
        return (
          <ScrollView style={styles.fullScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideScroll}>
            <YukiGuide
              mode="onboarding"
              pose="jump"
              text={t('onboarding.yuki.done')}
            />
            <View style={[styles.welcomeIconBox, { backgroundColor: colors.successBg, borderColor: colors.successBorder, marginBottom: 16 }]}>
              <AppIcon name="check" size={50} color={colors.success} />
            </View>
            <Text style={[styles.doneTitle, { color: colors.textMain }]}>{t('onboarding.done.title')}</Text>
            <Text style={[styles.doneSubtitle, { color: colors.textSub }]}>{t('onboarding.done.subtitle')}</Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => handleFinish(false)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={colors.goldGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.doneBtnText}>{t('onboarding.done.startTourButton') || t('onboarding.done.button')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notifDeclineBtn}
              onPress={() => handleFinish(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.notifDeclineBtnText, { color: colors.textMuted }]}>
                {t('onboarding.done.skipTourButton')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header with Language Quick Switcher, Progress Dots, and Skip Button */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={[styles.langSwitcherBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={toggleLanguageQuick}
          activeOpacity={0.7}
        >
          <AppIcon name="globe" size={13} color={colors.gold} />
          <Text style={[styles.langSwitcherText, { color: colors.textMain }]}>
            {(selectedLanguage || locale || 'de').toUpperCase()}
          </Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.progressDot,
                { backgroundColor: colors.border },
                idx === currentStep && { width: 20, backgroundColor: colors.gold },
                idx < currentStep && { backgroundColor: colors.goldBorder }
              ]}
            />
          ))}
        </View>

        {currentStep <= 4 ? (
          <TouchableOpacity onPress={handleSkipToAccount} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={[styles.skipBtnText, { color: colors.gold }]}>
              {t('onboarding.skip') || 'Überspringen'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {renderStep()}
      </Animated.View>

      {currentStep < 4 && (
        <View style={styles.navRow}>
          {currentStep > 0 ? (
            <TouchableOpacity onPress={handleBack} style={styles.navBtn}>
              <Text style={[styles.navBtnText, { color: colors.textSub }]}>{t('common.back')}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={handleNext} style={styles.navBtn}>
            <LinearGradient
              colors={colors.goldGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.navBtnGradient}
            >
              <Text style={styles.navBtnNextText}>{t('onboarding.next')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {(currentStep === 4 || currentStep === 5) && (
        <View style={styles.navRow}>
          <TouchableOpacity onPress={handleBack} style={styles.navBtn}>
            <Text style={[styles.navBtnText, { color: colors.textSub }]}>{t('common.back')}</Text>
          </TouchableOpacity>
          <View />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  langSwitcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 54,
  },
  langSwitcherText: {
    fontSize: 11,
    fontWeight: '800',
  },
  skipBtn: {
    minWidth: 54,
    alignItems: 'flex-end',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  skipPlaceholder: {
    minWidth: 54,
  },

  progressContainer: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 8, paddingVertical: 10
  },
  progressDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  content: { flex: 1, paddingHorizontal: 20 },
  fullScroll: { flex: 1, width: '100%' },
  accountWrapper: { flex: 1, width: '100%' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  slideScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  accountSlide: { paddingTop: 10, paddingBottom: 30 },
  reqList: { width: '100%', gap: 10, marginBottom: 12 },
  reqCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
  },
  reqIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  reqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  reqTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  reqBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  reqBadgeText: { fontSize: 10, fontWeight: '700' },
  reqDesc: { fontSize: 11.5, lineHeight: 16 },
  reqFooterNote: { fontSize: 11, textAlign: 'center', lineHeight: 15.5, paddingHorizontal: 8 },

  welcomeIconBox: {
    width: 76, height: 76, borderRadius: 14,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16
  },
  welcomeTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: 'center', lineHeight: 20, marginBottom: 24
  },
  featureList: { gap: 12, width: '100%' },
  featureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 8, padding: 14
  },
  featureIconContainer: {
    width: 36, height: 36, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center'
  },
  featureText: { fontSize: 13, flex: 1, lineHeight: 18 },

  slideTitle: {
    fontSize: 22, fontWeight: '800',
    textAlign: 'center', marginBottom: 8
  },
  slideText: {
    fontSize: 13,
    textAlign: 'center', lineHeight: 20, marginBottom: 20
  },

  stepsContainer: { width: '100%', gap: 0 },
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepNumber: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center'
  },
  stepNumberText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  stepContent: { flex: 1, paddingBottom: 18 },
  stepTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  stepDesc: { fontSize: 12, lineHeight: 18 },
  stepConnector: {
    position: 'absolute', left: 15, top: 32, width: 2, height: 18,
  },

  browserCards: { flexDirection: 'row', gap: 12, width: '100%' },
  browserCard: {
    flex: 1, alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 8, padding: 16
  },
  browserName: { fontSize: 13, fontWeight: '700' },

  notifReasonsList: {
    width: '100%',
    gap: 10,
    marginBottom: 18,
  },
  notifReasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  notifReasonIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifReasonTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifReasonDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  notifActionContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  notifPrimaryBtn: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
  },
  notifPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  notifDeclineBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  notifDeclineBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notifAdvisoryNote: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 8,
  },

  languageList: { width: '100%', gap: 8 },
  languageItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 8, padding: 12
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  langBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  languageLabel: { fontSize: 15, flex: 1 },

  form: { gap: 14, width: '100%', marginBottom: 16, borderWidth: 1, borderRadius: 10, padding: 18 },
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5
  },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14
  },
  inputHint: {
    fontSize: 11,
    marginTop: 2,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  showBtn: {
    padding: 10,
    alignItems: 'center', justifyContent: 'center'
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
  otpHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  otpHintText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  strengthBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4
  },
  strengthTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: {
    flex: 1, height: 4, borderRadius: 2,
  },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 50 },
  createAccountBtn: { width: '100%', borderRadius: 8, overflow: 'hidden' },
  createAccountBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  gradientBtn: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center'
  },
  alreadyHaveAccountBtn: {
    marginTop: 14, alignItems: 'center', paddingVertical: 10
  },
  alreadyHaveAccountText: {
    fontSize: 13, fontWeight: '700'
  },

  doneTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  doneSubtitle: {
    fontSize: 14,
    textAlign: 'center', lineHeight: 22, marginBottom: 24
  },
  doneButton: { width: '100%', borderRadius: 8, overflow: 'hidden' },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },

  navRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16
  },
  navBtn: { minWidth: 60 },
  navBtnText: { fontSize: 14, fontWeight: '600' },
  navBtnGradient: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8
  },
  navBtnNextText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 14,
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
    marginTop: 16,
    paddingTop: 10,
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
