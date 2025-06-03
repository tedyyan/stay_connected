import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { 
  Card, 
  Text, 
  useTheme, 
  Chip, 
  IconButton,
  Divider
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationHistory'>;

interface NotificationLog {
  id: string;
  event_id: string;
  notification_type: string;
  recipient: string;
  content: string;
  sent_at: string;
  status: string;
  error_message?: string;
  notification_category: string;
}

export default function NotificationHistoryScreen({ route, navigation }: Props) {
  const { eventId, eventName } = route.params;
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    fetchNotificationHistory();
  }, [eventId]);

  const fetchNotificationHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_logs')
        .select('*')
        .eq('event_id', eventId)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error fetching notification history:', error);
        return;
      }

      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notification history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotificationHistory();
    setRefreshing(false);
  };

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return 'email-outline';
      case 'sms': return 'cellphone-message';
      case 'push': return 'bell-outline';
      default: return 'notification-clear-all';
    }
  };

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'email': return '#1976d2'; // Blue
      case 'sms': return '#388e3c'; // Green
      case 'push': return '#f57c00'; // Orange
      default: return '#757575'; // Gray
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return '#4caf50'; // Green
      case 'pending': return '#ff9800'; // Orange
      case 'failed': return '#f44336'; // Red
      case 'cancelled': return '#9e9e9e'; // Gray
      default: return '#757575'; // Gray
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return '✅';
      case 'pending': return '⏳';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'user_reminder': return 'User Reminder';
      case 'contact_alert': return 'Contact Alert';
      case 'event_trigger': return 'Event Trigger';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'user_reminder': return '#2196f3'; // Blue
      case 'contact_alert': return '#ff5722'; // Deep Orange
      case 'event_trigger': return '#9c27b0'; // Purple
      default: return '#757575'; // Gray
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const maskRecipient = (recipient: string, type: string) => {
    if (type === 'email') {
      const [local, domain] = recipient.split('@');
      return `${local.slice(0, 2)}***@${domain}`;
    } else if (type === 'sms') {
      return `***-***-${recipient.slice(-4)}`;
    }
    return recipient;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.eventName}>
              {eventName}
            </Text>
            <Text variant="bodyMedium" style={styles.headerSubtitle}>
              Notification history for this event
            </Text>
            <View style={styles.statsRow}>
              <Text variant="bodySmall" style={styles.statsText}>
                Total notifications: {notifications.length}
              </Text>
              {notifications.length > 0 && (
                <Text variant="bodySmall" style={styles.statsText}>
                  • Last sent: {formatDate(notifications[0]?.sent_at)}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No Notifications Yet
              </Text>
              <Text variant="bodyMedium" style={styles.emptyDescription}>
                Notifications for this event will appear here when they are sent.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          notifications.map((notification, index) => (
            <Card key={notification.id} style={styles.notificationCard}>
              <Card.Content style={styles.cardContent}>
                {/* Header Row */}
                <View style={styles.notificationHeader}>
                  <View style={styles.typeSection}>
                    <IconButton
                      icon={getNotificationTypeIcon(notification.notification_type)}
                      size={20}
                      iconColor={getNotificationTypeColor(notification.notification_type)}
                      style={styles.typeIcon}
                    />
                    <View>
                      <Text variant="titleSmall" style={styles.notificationType}>
                        {notification.notification_type.toUpperCase()}
                      </Text>
                      <Text variant="bodySmall" style={styles.recipient}>
                        To: {maskRecipient(notification.recipient, notification.notification_type)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.statusSection}>
                    <Text style={styles.statusIcon}>
                      {getStatusIcon(notification.status)}
                    </Text>
                    <Text 
                      variant="bodySmall" 
                      style={[styles.status, { color: getStatusColor(notification.status) }]}
                    >
                      {notification.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Category and Time */}
                <View style={styles.metaRow}>
                  <Chip 
                    mode="flat" 
                    style={[styles.categoryChip, { backgroundColor: getCategoryColor(notification.notification_category) + '20' }]}
                    textStyle={[styles.categoryText, { color: getCategoryColor(notification.notification_category) }]}
                  >
                    {getCategoryLabel(notification.notification_category)}
                  </Chip>
                  <Text variant="bodySmall" style={styles.timeText}>
                    {formatDate(notification.sent_at)}
                  </Text>
                </View>

                {/* Content */}
                <Text variant="bodyMedium" style={styles.content}>
                  {notification.content}
                </Text>

                {/* Error Message */}
                {notification.error_message && (
                  <View style={styles.errorSection}>
                    <Text variant="bodySmall" style={styles.errorLabel}>
                      Error:
                    </Text>
                    <Text variant="bodySmall" style={styles.errorMessage}>
                      {notification.error_message}
                    </Text>
                  </View>
                )}

                {/* Full Date */}
                <Text variant="bodySmall" style={styles.fullDate}>
                  {formatFullDate(notification.sent_at)}
                </Text>
              </Card.Content>
              
              {index < notifications.length - 1 && <Divider style={styles.divider} />}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
  },
  eventName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#666',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsText: {
    color: '#888',
    marginRight: 8,
  },
  emptyCard: {
    marginTop: 50,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  emptyDescription: {
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
  notificationCard: {
    marginBottom: 8,
  },
  cardContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  typeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    margin: 0,
    marginRight: 8,
  },
  notificationType: {
    fontWeight: 'bold',
  },
  recipient: {
    color: '#666',
    fontSize: 12,
  },
  statusSection: {
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  status: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    color: '#888',
    fontStyle: 'italic',
  },
  content: {
    lineHeight: 20,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#e0e0e0',
  },
  errorSection: {
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f44336',
  },
  errorLabel: {
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 2,
  },
  errorMessage: {
    color: '#d32f2f',
  },
  fullDate: {
    color: '#999',
    fontSize: 11,
    textAlign: 'right',
  },
  divider: {
    marginVertical: 8,
  },
}); 