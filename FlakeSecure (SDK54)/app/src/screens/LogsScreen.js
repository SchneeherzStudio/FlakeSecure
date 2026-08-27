/**
 * ============================================================================
 * FlakeSecure Mobile App - Login & Activity Logs Screen (LogsScreen)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW:
 * 
 * 1. ACTIVITY LOGS FETCHING & PAGINATION:
 *    - fetchLogs(pageNumber): Fetches paginated login and credential transfer logs from the server via getLogs API.
 *    - handleRefresh() / handleLoadMore(): Pull-to-refresh and infinite scroll loading.
 * 
 * 2. LOG RENDERING & LOG PURGE:
 *    - renderItem({ item }): Renders activity entries with action icons (Login 🔑, Credential Send 📤, QR Share 📲), IP address, geolocation, and formatted timestamps.
 *    - handleClearLogs(): Prompts confirmation and purges user activity logs via clearLogs API.
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLogs, clearLogs } from '../utils/api';
import { i18n } from '../i18n';

export default function LogsScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const fetchLogs = async (pageNumber) => {
    try {
      if (pageNumber === 1) setLoading(true);
      const newLogs = await getLogs(pageNumber, 20);
      
      if (newLogs && newLogs.length > 0) {
        if (pageNumber === 1) {
          setLogs(newLogs);
        } else {
          setLogs(prev => [...prev, ...newLogs]);
        }
        setHasMore(newLogs.length === 20);
      } else {
        setHasMore(false);
        if (pageNumber === 1) setLogs([]);
      }
    } catch (error) {
      console.log('Failed to fetch logs', error);
      Alert.alert('Error', 'Could not load logs');
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
      'Clear Logs',
      'Are you sure you want to delete all activity logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearLogs();
              setLogs([]);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear logs');
            }
          }
        }
      ]
    );
  };

  const getActionIcon = (actionType) => {
    switch(actionType) {
      case 'login': return '🔑';
      case 'credential_send': return '📤';
      case 'qr_share': return '📲';
      default: return '📝';
    }
  };

  const renderItem = ({ item }) => {
    const formattedDate = new Date(item.created_at).toLocaleDateString(i18n.locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <Text style={styles.actionIcon}>{getActionIcon(item.action)}</Text>
          <Text style={styles.actionText}>{item.action_label || item.action}</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
        <View style={styles.logDetails}>
          {item.domain && (
            <Text style={styles.detailText}>
              <Text style={styles.label}>Domain: </Text>{item.domain}
            </Text>
          )}
          <Text style={styles.detailText}>
            <Text style={styles.label}>IP: </Text>{item.ip_address || 'Unknown'}
          </Text>
          <Text style={styles.detailText}>
            <Text style={styles.label}>Location: </Text>
            {item.city ? `${item.city}, ${item.country}` : 'Unknown Location'}
          </Text>
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
        <Text style={styles.title}>Login Logs</Text>
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator color="#6391ff" style={styles.loader} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6391ff" />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.emptyText}>No logs found.</Text>}
          ListFooterComponent={hasMore && logs.length > 0 ? <ActivityIndicator color="#6391ff" style={{ marginVertical: 10 }} /> : null}
        />
      )}

      {logs.length > 0 && (
        <TouchableOpacity style={styles.clearBtn} onPress={handleClearLogs}>
          <Text style={styles.clearBtnText}>Clear all logs</Text>
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
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textTransform: 'capitalize',
  },
  dateText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  logDetails: {
    marginTop: 5,
  },
  detailText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 50,
  },
  clearBtn: {
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: 'rgba(255,77,79,0.1)',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
  },
  clearBtnText: {
    color: '#ff4d4f',
    fontWeight: '600',
    fontSize: 16,
  },
});
