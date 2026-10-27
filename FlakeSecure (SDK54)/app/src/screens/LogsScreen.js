/**
 * ============================================================================
 * FlakeSecure Mobile App - Activity Logs Screen v2.0
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/Toast';
import { AppIcon } from '../components/CategoryIcons';
import { getLogs, clearLogs } from '../utils/api';
import { LogRowSkeleton } from '../components/Skeleton';
import { TapFeedback } from '../components/TapFeedback';

export default function LogsScreen({ navigation }) {
  const { t, locale } = useLanguage();
  const { colors } = useTheme();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
      if (pageNumber === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
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
      toast.error(t('error'), t('logs.loadError'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchLogs(1);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLogs(nextPage);
    }
  };

  const handleClearLogs = () => {
    toast.confirm({
      title: t('logs.clearConfirmTitle'),
      message: t('logs.clearConfirmMsg'),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      destructive: true,
      icon: 'trash',
      onConfirm: async () => {
        try {
          await clearLogs();
          setLogs([]);
        } catch (error) {
          toast.error(t('error'), t('logs.clearError'));
        }
      },
    });
  };

  const renderActionIcon = (actionType) => {
    switch (actionType) {
      case 'login':
        return <AppIcon name="lock" size={16} color={colors.gold} />;
      case 'credential_send':
        return <AppIcon name="share" size={16} color={colors.gold} />;
      case 'qr_share':
        return <AppIcon name="scan" size={16} color={colors.gold} />;
      case 'register':
        return <AppIcon name="plus" size={16} color={colors.success} />;
      case 'delete':
        return <AppIcon name="trash" size={16} color={colors.danger} />;
      default:
        return <AppIcon name="logs" size={16} color={colors.gold} />;
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
      <View style={[styles.logCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={styles.logHeader}>
          <View style={[styles.actionIconContainer, { backgroundColor: colors.goldBg }]}>
            {renderActionIcon(item.action)}
          </View>
          <View style={styles.actionTitleContainer}>
            <Text style={[styles.actionText, { color: colors.textMain }]}>{item.action_label || item.action}</Text>
            {item.domain ? (
              <Text style={[styles.domainText, { color: colors.gold }]} numberOfLines={1}>
                {item.domain}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>{formattedTimestamp}</Text>
        </View>

        <View style={[styles.logDetails, { backgroundColor: colors.inputBg }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('logs.ip')}</Text>
            <Text style={[styles.detailValue, { color: colors.textMain }]}>{item.ip_address || 'Local'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('logs.location')}</Text>
            <Text style={[styles.detailValue, { color: colors.textMain }]}>
              {item.city ? `${item.city}, ${item.country || ''}` : item.country || '-'}
            </Text>
          </View>

          {item.device_info ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('logs.device')}</Text>
              <Text style={[styles.detailValue, { color: colors.textMain }]} numberOfLines={1}>
                {item.device_info.substring(0, 45)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TapFeedback onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.textMain }]}>←</Text>
        </TapFeedback>
        <Text style={[styles.title, { color: colors.textMain }]}>{t('logs.title')}</Text>
      </View>

      <View style={styles.filterStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'all', label: t('logs.all') },
            { id: 'login', label: t('logs.filterLogin') },
            { id: 'send', label: t('logs.filterSend') },
            { id: 'share', label: t('logs.filterShare') },
          ].map((tab) => (
            <TapFeedback
              key={tab.id}
              style={[
                styles.filterChip,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
                activeFilter === tab.id && { backgroundColor: colors.goldBg, borderColor: colors.gold }
              ]}
              onPress={() => setActiveFilter(tab.id)}
            >
              <Text style={[
                styles.filterChipText,
                { color: colors.textSub },
                activeFilter === tab.id && { color: colors.gold, fontWeight: '700' }
              ]}>
                {tab.label}
              </Text>
            </TapFeedback>
          ))}
        </ScrollView>
      </View>

      {loading && logs.length === 0 ? (
        <View style={styles.listContainer}>
          <LogRowSkeleton />
          <LogRowSkeleton />
          <LogRowSkeleton />
          <LogRowSkeleton />
          <LogRowSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <AppIcon name="logs" size={40} color={colors.gold} style={{ marginBottom: 10 }} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('logs.noLogs')}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore && filteredLogs.length > 0 ? (
              <LogRowSkeleton />
            ) : null
          }
        />
      )}

      {logs.length > 0 && (
        <TapFeedback
          style={[styles.clearBtn, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}
          onPress={handleClearLogs}
        >
          <Text style={[styles.clearBtnText, { color: colors.danger }]}>{t('logs.clearAll')}</Text>
        </TapFeedback>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
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
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logCard: {
    borderWidth: 1,
    borderRadius: 8,
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
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  actionTitleContainer: {
    flex: 1,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  domainText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  logDetails: {
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 14,
  },
  clearBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
  },
  clearBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
