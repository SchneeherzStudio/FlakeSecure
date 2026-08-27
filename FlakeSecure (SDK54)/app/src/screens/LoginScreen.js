/**
 * ============================================================================
 * FlakeSecure Mobile App - Login & Registration Screen (LoginScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. AUTHENTICATION & REGISTRATION:
 *    - handleLogin(): Validates credentials and logs user in via AuthContext.login.
 *    - handleRegister(): Enforces registration rules (lowercase username, no spaces, min 8 chars, matching passwords) and calls AuthContext.register.
 * 
 * 2. MODE SWITCHING & FORM CONTROL:
 *    - Toggles between login and registration views with responsive dynamic form inputs.
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { i18n } from '../i18n';

export default function LoginScreen({ navigation }) {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      Alert.alert(i18n.t('error'), i18n.t('viewCredential.allFieldsRequired'));
      return;
    }

    setLoading(true);
    try {
      await login(cleanIdentifier, cleanPassword);
    } catch (err) {
      Alert.alert(i18n.t('login.failed'), err.message || i18n.t('login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanUsername || !cleanPassword) {
      Alert.alert(i18n.t('error'), i18n.t('viewCredential.allFieldsRequired'));
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
      Alert.alert(i18n.t('error'), i18n.t('onboarding.account.usernameRules'));
      return;
    }
    if (/\s/.test(password)) {
      Alert.alert(i18n.t('error'), i18n.t('onboarding.account.passwordNoSpaces'));
      return;
    }
    if (cleanPassword.length < 8) {
      Alert.alert(i18n.t('error'), i18n.t('onboarding.account.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(i18n.t('error'), i18n.t('onboarding.account.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      await register(cleanEmail, cleanUsername, cleanPassword);
    } catch (err) {
      Alert.alert(i18n.t('error'), err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logoEmoji}>❄️</Text>
            <Text style={styles.logoText}>
              Flake<Text style={styles.logoAccent}>Secure</Text>
            </Text>
            <Text style={styles.subtitle}>
              {isRegisterMode ? i18n.t('login.registerSubtitle') : i18n.t('login.subtitle')}
            </Text>
          </View>

          {isRegisterMode ? (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{i18n.t('onboarding.account.email')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{i18n.t('onboarding.account.username')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="flakeuser"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={username}
                  onChangeText={(text) => setUsername(text.toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.inputHint}>{i18n.t('onboarding.account.usernameRuleHint')}</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{i18n.t('onboarding.account.password')}</Text>
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
                <Text style={styles.inputHint}>{i18n.t('onboarding.account.passwordRuleHint')}</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{i18n.t('onboarding.account.confirmPassword')}</Text>
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
          ) : (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{i18n.t('login.emailOrUsername')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{i18n.t('login.password')}</Text>
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
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.loginButton}
            onPress={isRegisterMode ? handleRegister : handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={loading ? ['#333', '#444'] : ['#6391ff', '#7c6aff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>
                  {isRegisterMode ? i18n.t('login.createAccount') : i18n.t('login.loginButton')}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toggleModeBtn}
            onPress={() => setIsRegisterMode(!isRegisterMode)}
            disabled={loading}
          >
            <Text style={styles.toggleModeText}>
              {isRegisterMode ? (
                i18n.t('login.alreadyHaveAccount')
              ) : (
                <>
                  <Text style={styles.toggleModeSub}>{i18n.t('login.noAccount')} </Text>
                  <Text style={styles.toggleModeAccent}>{i18n.t('login.createAccount')}</Text>
                </>
              )}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090b14' },
  scroll: { padding: 24, paddingTop: 40, paddingBottom: 40, flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoEmoji: { fontSize: 52, marginBottom: 10 },
  logoText: { fontSize: 30, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 6 },
  logoAccent: { color: '#6391ff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  form: { gap: 18, marginBottom: 24 },
  fieldGroup: { gap: 6 },
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
  loginButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  loginGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  loginBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  toggleModeBtn: { alignItems: 'center', paddingVertical: 12 },
  toggleModeText: { color: '#6391ff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  toggleModeSub: { color: 'rgba(255,255,255,0.4)', fontWeight: '400' },
  toggleModeAccent: { color: '#6391ff', fontWeight: '700' },
});
