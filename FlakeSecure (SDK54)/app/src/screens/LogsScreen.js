/**
 * ============================================================================
 * FlakeSecure Mobile App - Activity Logs Screen v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. ACTIVITY LOGS FETCHING & PARSING:
 *    - fetchLogs(pageNumber): Correctly parses paginated response object ({ logs, total, totalPages }).
 *    - handleRefresh() / handleLoadMore(): Pull-to-refresh and infinite scroll loading.
 * 
 * 2. FORMATTING & CUSTOMIZATION:
 *    - formatDate(dateStr): Formats timestamps according to user preference (System locale, DD.MM.YYYY HH:mm, or YYYY-MM-DD).
 *    - Action filtering chips: All, Logins, Relays, Shares.
 * 
 * 3. LOG PURGE:
 *    - handleClearLogs(): Prompts confirmation and purges user activity logs via clearLogs API.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import { getLogs, clearLogs } from '../utils/api';

export default function LogsScreen({ navigation }) {
  const { t, locale } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [dateFormat, setDateFormat] = useState('system');
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const savedFormat = await AsyncStorage.getItem('date_format');
      if (savedFormat) setDateFormat(savedFormat);
    })();
    fetchLogs(1);
  }, []);

  const fetchLogs = async (pageNumber) => {
    try {
      if (pageNumber === 1) setLoading(true);
      const res = await getLogs(pageNumber, 20);
      const newLogs = Array.isArray(res) ? res : res?.logs || [];

      if (newLogs.length > 0) {
        if (pageNumber === 1) {
          setLogs(newLogs);
        } else {
          setLogs((prev) => [...prev, ...newLogs]);
        }
        setHasMore(newLogs.length === 20);
      } else {
        setHasMore(false);
        if (pageNumber === 1) setLogs([]);
      }
    } catch (error) {
      console.log('Failed to fetch logs', error);
      Alert.alert(t('error'), 'Could not load logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchLogs(1);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLogs(nextPage);
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      t('logs.clearConfirmTitle'),
      t('logs.clearConfirmMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await clearLogs();
              setLogs([]);
            } catch (error) {
              Alert.alert(t('error'), 'Could not clear logs');
            }
          },
        },
      ]
    );
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'login':
        return '🔑';
      case 'credential_send':
        return '📤';
      case 'qr_share':
        return '📲';
      case 'register':
        return '✨';
      case 'delete':
        return '🗑️';
      default:
        return '📝';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);

    if (dateFormat === 'german') {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${mins}  ${day}.${month}.${year}`;
    }

    if (dateFormat === 'iso') {
      return date.toISOString().replace('T', ' ').substring(0, 16);
    }

    return date.toLocaleDateString(locale || 'en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredLogs = logs.filter((log) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'login') return log.action === 'login';
    if (activeFilter === 'send') return log.action === 'credential_send';
    if (activeFilter === 'share') return log.action === 'qr_share';
    return true;
  });

  const renderItem = ({ item }) => {
    const formattedTimestamp = formatDate(item.created_at);

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={styles.actionIconContainer}>
            <Text style={styles.actionIcon}>{getActionIcon(item.action)}</Text>
          </View>
          <View style={styles.actionTitleContainer}>
            <Text style={styles.actionText}>{item.action_label || item.action}</Text>
            {item.domain ? (
              <Text style={styles.domainText} numberOfLines={1}>
                {item.domain}
              </Text>
            ) : null}
          </View>
          <Text style={styles.dateText}>{formattedTimestamp}</Text>
        </View>

        <View style={styles.logDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('logs.ip')}</Text>
            <Text style={styles.detailValue}>{item.ip_address || 'Local'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('logs.location')}</Text>
            <Text style={styles.detailValue}>
              {item.city ? `${item.city}, ${item.country || ''}` : item.country || '-'}
            </Text>
          </View>

          {item.device_info ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('logs.device')}</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {item.device_info.substring(0, 45)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('logs.title')}</Text>
      </View>

      <View style={styles.filterStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'all', label: t('logs.all') },
            { id: 'login', label: t('logs.filterLogin') },
            { id: 'send', label: t('logs.filterSend') },
            { id: 'share', label: t('logs.filterShare') },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterChip, activeFilter === tab.id && styles.filterChipActive]}
              onPress={() => setActiveFilter(tab.id)}
            >
              <Text style={[styles.filterChipText, activeFilter === tab.id && styles.filterChipTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator color="#6391ff" style={styles.loader} />
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6391ff" />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>{t('logs.noLogs')}</Text>
            </View>
          }
          ListFooterComponent={
            hasMore && logs.length > 0 ? (
              <ActivityIndicator color="#6391ff" style={{ marginVertical: 10 }} />
            ) : null
          }
        />
      )}

      {logs.length > 0 && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearLogs}>
          <Text style={styles.clearBtnText}>{t('logs.clearAll')}</Text>
        </TouchableOpacity>
      )}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
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
    fontSize: 18,
    fontWeight: '700',
  },
  filterStrip: {
    paddingVertical: 10,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: 'rgba(99, 145, 255, 0.2)',
    borderColor: '#6391ff',
  },
  filterChipText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 145, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionTitleContainer: {
    flex: 1,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  domainText: {
    color: '#6391ff',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  logDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  detailValue: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
  },
  clearBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 77, 79, 0.1)',
    borderColor: 'rgba(255, 77, 79, 0.25)',
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
  },
  clearBtnText: {
    color: '#ff4d4f',
    fontWeight: '700',
    fontSize: 14,
  },
});
