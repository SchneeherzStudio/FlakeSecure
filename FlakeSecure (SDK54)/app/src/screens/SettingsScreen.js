/**
 * ============================================================================
 * FlakeSecure Mobile App - Settings Screen (SettingsScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. ACCOUNT & LANGUAGE SETTINGS:
 *    - Displays active user account information (username, email) and logout action.
 *    - handleLanguageChange(lang): Updates application locale (i18n) and syncs language with server profile.
 * 
 * 2. DEFAULT AUTOFILL (Profile Presets):
 *    - loadProfile() / handleSaveProfile(): Manages default registration preset values (email, username, name, phone).
 * 
 * 3. SHARING & SECURITY PREFERENCES:
 *    - handleShareModeChange(mode): Configures sharing permissions (Only Me, Whitelist, Anyone).
 *    - fetchRestrictions() / handleAddRestriction() / handleRemoveRestriction(): Manages allowed recipients whitelist for credential sharing.
 * 
 * 4. DATA, LOGS & ACCOUNT DELETION:
 *    - Navigation to Import/Export/Share flows and Activity Logs (LogsScreen).
 *    - handleDeleteAccount(): Permanently deletes account via API and purges local storage.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { updateAccount, getRestrictions, addRestriction, removeRestriction, searchUsers, deleteAccount as apiDeleteAccount } from '../utils/api';
import { getDefaultProfile, saveDefaultProfile } from '../utils/storage';
import { i18n } from '../i18n';

export default function SettingsScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const { locale, changeLanguage } = useLanguage();
  
  const [currentLanguage, setCurrentLanguage] = useState(locale || 'en');
  const [currentShareMode, setCurrentShareMode] = useState(user?.share_mode || 'whitelist');
  
  const [restrictions, setRestrictions] = useState([]);
  const [loadingRestrictions, setLoadingRestrictions] = useState(true);

  const [profileEmail, setProfileEmail] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchRestrictions();
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const p = await getDefaultProfile();
      setProfileEmail(p?.email || user?.email || '');
      setProfileUsername(p?.username || user?.username || '');
      setProfileFirstName(p?.firstName || '');
      setProfileLastName(p?.lastName || '');
      setProfilePhone(p?.phone || '');
    } catch (e) {}
  };

  const handleSaveProfile = async () => {
    try {
      await saveDefaultProfile({
        email: profileEmail.trim(),
        username: profileUsername.trim().toLowerCase(),
        firstName: profileFirstName.trim(),
        lastName: profileLastName.trim(),
        phone: profilePhone.trim()
      });
      Alert.alert('Gespeichert ✓', 'Standard-Angaben wurden erfolgreich gespeichert.');
    } catch (e) {
      Alert.alert('Fehler', 'Konnte Profil nicht speichern.');
    }
  };

  const fetchRestrictions = async () => {
    try {
      setLoadingRestrictions(true);
      const res = await getRestrictions();
      setRestrictions(res.recipients || []);
    } catch (e) {
      console.log('Failed to fetch restrictions', e);
    } finally {
      setLoadingRestrictions(false);
    }
  };

  const handleLanguageChange = async (lang) => {
    try {
      setCurrentLanguage(lang);
      await changeLanguage(lang);
      await updateAccount({ language: lang });
    } catch (e) {
      console.log('Failed to update language', e);
    }
  };

  const handleShareModeChange = async (mode) => {
    try {
      setCurrentShareMode(mode);
      const res = await updateAccount({ share_mode: mode });
      if (res.user) updateUser(res.user);
    } catch (e) {
      console.log('Failed to update share mode', e);
    }
  };

  const handleRemoveRestriction = async (username) => {
    try {
      await removeRestriction(username);
      fetchRestrictions();
    } catch (e) {
      Alert.alert('Error', 'Could not remove recipient');
    }
  };

  const handleSearchUsers = async () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    try {
      setSearching(true);
      const results = await searchUsers(query);
      setSearchResults(results.users || []);
    } catch (e) {
      console.log('Search failed', e);
    } finally {
      setSearching(false);
    }
  };

  const handleAddRestriction = async (username) => {
    try {
      await addRestriction(username.trim().toLowerCase());
      setSearchModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchRestrictions();
    } catch (e) {
      Alert.alert('Error', 'Could not add recipient');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure? This action cannot be undone and you will lose all data.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirm Deletion',
              'Please confirm again. All your encrypted data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm & Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await apiDeleteAccount();
                      await AsyncStorage.clear();
                      await SecureStore.deleteItemAsync('user_token');
                      await SecureStore.deleteItemAsync('master_key');
                      logout();
                    } catch (e) {
                      Alert.alert('Error', 'Failed to delete account');
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const languages = [
    { code: 'en', label: 'English 🇬🇧' },
    { code: 'de', label: 'Deutsch 🇩🇪' },
    { code: 'fr', label: 'Français 🇫🇷' },
    { code: 'es', label: 'Español 🇪🇸' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>{user?.username || 'Unknown'}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || 'Unknown'}</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>LANGUAGE</Text>
        <View style={styles.card}>
          {languages.map((lang, index) => (
            <TouchableOpacity 
              key={lang.code}
              style={[styles.langItem, index !== languages.length - 1 && styles.borderBottom]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={[styles.langText, currentLanguage === lang.code && styles.langSelected]}>
                {lang.label}
              </Text>
              {currentLanguage === lang.code && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionHeader}>STANDARDAUSFÜLLUNG (PROFILE)</Text>
        <View style={styles.card}>
          <Text style={styles.profileHint}>
            Diese Angaben werden verwendet, wenn du auf Websites automatisch neue Accounts erstellst.
          </Text>

          <Text style={styles.inputLabel}>Standard E-Mail</Text>
          <TextInput
            style={styles.profileInput}
            value={profileEmail}
            onChangeText={setProfileEmail}
            placeholder="deine@email.de"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Standard Benutzername</Text>
          <TextInput
            style={styles.profileInput}
            value={profileUsername}
            onChangeText={setProfileUsername}
            placeholder="benutzername"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="none"
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Vorname</Text>
              <TextInput
                style={styles.profileInput}
                value={profileFirstName}
                onChangeText={setProfileFirstName}
                placeholder="Max"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Nachname</Text>
              <TextInput
                style={styles.profileInput}
                value={profileLastName}
                onChangeText={setProfileLastName}
                placeholder="Mustermann"
                placeholderTextColor="rgba(255,255,255,0.25)"
                autoCapitalize="words"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Telefonnummer</Text>
          <TextInput
            style={styles.profileInput}
            value={profilePhone}
            onChangeText={setProfilePhone}
            placeholder="+49 170 1234567"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="phone-pad"
          />

          <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSaveProfile}>
            <Text style={styles.saveProfileText}>💾 Angaben speichern</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>SHARING SETTINGS</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Who can send you logins?</Text>
          <View style={styles.segmentContainer}>
            {[
              { id: 'only_me', label: 'Only Me' },
              { id: 'whitelist', label: 'Whitelist' },
              { id: 'all', label: 'Anyone' }
            ].map((mode) => (
              <TouchableOpacity
                key={mode.id}
                style={[styles.segmentBtn, currentShareMode === mode.id && styles.segmentBtnActive]}
                onPress={() => handleShareModeChange(mode.id)}
              >
                <Text style={[styles.segmentText, currentShareMode === mode.id && styles.segmentTextActive]}>
                  {mode.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {currentShareMode === 'whitelist' && (
          <>
            <Text style={styles.sectionHeader}>ALLOWED RECIPIENTS</Text>
            <View style={styles.card}>
              {loadingRestrictions ? (
                <ActivityIndicator color="#6391ff" />
              ) : (
                restrictions.map((recipient, index) => (
                  <View key={index} style={[styles.recipientItem, index !== restrictions.length - 1 && styles.borderBottom]}>
                    <Text style={styles.recipientText}>{recipient.username}</Text>
                    <TouchableOpacity onPress={() => handleRemoveRestriction(recipient.username)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
              {restrictions.length === 0 && !loadingRestrictions && (
                <Text style={styles.emptyText}>No allowed recipients</Text>
              )}
              <TouchableOpacity 
                style={styles.addRecipientBtn} 
                onPress={() => setSearchModalVisible(true)}
              >
                <Text style={styles.addRecipientText}>+ Add recipient</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.sectionHeader}>DATA & SHARING</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('ShareImport', { mode: 'import' })}>
            <Text style={styles.dataItemText}>Import from another device</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('ShareImport', { mode: 'export' })}>
            <Text style={styles.dataItemText}>Export to another device</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('ShareImport', { mode: 'share' })}>
            <Text style={styles.dataItemText}>Send logins to user</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>ACTIVITY</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dataItem} onPress={() => navigation.navigate('Logs')}>
            <Text style={styles.dataItemText}>View Login Logs</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeader, styles.dangerHeader]}>DANGER ZONE</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount}>
            <Text style={styles.dangerBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal visible={searchModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Find User</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search username..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchUsers}
            />
            <TouchableOpacity style={styles.searchActionBtn} onPress={handleSearchUsers}>
              <Text style={styles.searchActionText}>Search</Text>
            </TouchableOpacity>

            {searching ? (
              <ActivityIndicator color="#6391ff" style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.searchResultItem} onPress={() => handleAddRestriction(item.username)}>
                    <Text style={styles.searchResultText}>{item.username}</Text>
                    <Text style={styles.addText}>Add</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No results</Text>}
              />
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setSearchModalVisible(false)}>
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090b14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 25,
    marginBottom: 8,
    marginLeft: 10,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 10,
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 5,
  },
  logoutText: {
    color: '#6391ff',
    fontWeight: '600',
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  langItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  langText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  langSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  checkMark: {
    color: '#6391ff',
    fontSize: 16,
  },
  recipientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  recipientText: {
    color: '#fff',
    fontSize: 16,
  },
  removeText: {
    color: '#ff4d4f',
    fontSize: 14,
  },
  addRecipientBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  addRecipientText: {
    color: '#6391ff',
    fontWeight: '600',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginVertical: 10,
  },
  dataItem: {
    paddingVertical: 12,
  },
  dataItemText: {
    color: '#fff',
    fontSize: 16,
  },
  dangerHeader: {
    color: '#ff4d4f',
  },
  dangerCard: {
    borderColor: 'rgba(255,77,79,0.2)',
  },
  dangerBtn: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  dangerBtnText: {
    color: '#ff4d4f',
    fontWeight: '600',
    fontSize: 16,
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9,11,20,0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#090b14',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
  },
  searchActionBtn: {
    backgroundColor: '#6391ff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  searchActionText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  searchResultText: {
    color: '#fff',
    fontSize: 16,
  },
  addText: {
    color: '#6391ff',
    fontWeight: '600',
  },
  closeModalBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  closeModalText: {
    color: 'rgba(255,255,255,0.5)',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 4,
    marginTop: 10,
    marginBottom: 5,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: '#6391ff',
  },
  segmentText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  profileHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 18,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
  },
  profileInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
  },
  saveProfileBtn: {
    marginTop: 6,
    backgroundColor: 'rgba(99,145,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,145,255,0.3)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveProfileText: {
    color: '#6391ff',
    fontWeight: '700',
    fontSize: 14,
  },
});
