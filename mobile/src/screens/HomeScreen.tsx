import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { Button, Text, Card, IconButton, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface CheckinStatus {
  event_id: string;
  event_name: string;
  event_status: string;
  last_checkin: string;
  next_checkin_due: string;
  hours_until_due: number;
  is_overdue: boolean;
  hours_overdue: number;
  hours_until_alert: number;
  is_alert_time: boolean;
  alert_time_left_ms: number;
  alert_time_left_display: string;
  alert_time_left_value: number;
  alert_time_left_unit: string;
}

export default function HomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [checkinStatuses, setCheckinStatuses] = useState<CheckinStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingInAll, setCheckingInAll] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const fetchCheckinStatus = async () => {
    if (!user) return;
    
    try {
      // Get all events with their check-in frequency and threshold information
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, name, status, last_check_in, created_at, check_in_frequency, missed_checkin_threshold, last_trigger_time')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return;
      }

      // Transform the data with proper timing calculations
      const transformedData = (eventsData || []).map(event => {
        const lastCheckIn = new Date(event.last_check_in || event.created_at);
        const now = new Date();
        const timeSinceLastCheckIn = now.getTime() - lastCheckIn.getTime();
        
        // Parse check_in_frequency interval (format: HH:MM:SS or PostgreSQL interval)
        let frequencyMs = 60 * 60 * 1000; // Default 1 hour
        
        if (event.check_in_frequency) {
          // Handle PostgreSQL interval format like "01:00:00" or "1 day" or "2 hours"
          const frequency = event.check_in_frequency.toString();
          
          // Try to parse time format (HH:MM:SS)
          const timeMatch = frequency.match(/(\d{1,2}):(\d{2}):(\d{2})/);
          if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = parseInt(timeMatch[3]);
            frequencyMs = (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
          } else {
            // Try to parse interval format like "1 day", "2 hours", etc.
            const intervalMatch = frequency.match(/(\d+)\s*(second|minute|hour|day|week|month)s?/i);
            if (intervalMatch) {
              const value = parseInt(intervalMatch[1]);
              const unit = intervalMatch[2].toLowerCase();
              
              switch (unit) {
                case 'second':
                  frequencyMs = value * 1000;
                  break;
                case 'minute':
                  frequencyMs = value * 60 * 1000;
                  break;
                case 'hour':
                  frequencyMs = value * 60 * 60 * 1000;
                  break;
                case 'day':
                  frequencyMs = value * 24 * 60 * 60 * 1000;
                  break;
                case 'week':
                  frequencyMs = value * 7 * 24 * 60 * 60 * 1000;
                  break;
                case 'month':
                  frequencyMs = value * 30 * 24 * 60 * 60 * 1000;
                  break;
              }
            }
          }
        }
        
        // Calculate alert time left using the correct formula:
        // (missed_checkin_threshold * check_in_frequency) - (now - last_check_in)
        const missedThreshold = event.missed_checkin_threshold || 2;
        const alertTimeLeftMs = (missedThreshold * frequencyMs) - timeSinceLastCheckIn;
        const isAlertExpired = alertTimeLeftMs < 0;
        
        // Smart time formatting
        let timeLeftValue = 0;
        let timeLeftUnit = '';
        let timeLeftDisplay = '';
        
        if (isAlertExpired) {
          const overdueDays = Math.floor(Math.abs(alertTimeLeftMs) / (1000 * 60 * 60 * 24));
          const overdueHours = Math.floor(Math.abs(alertTimeLeftMs) / (1000 * 60 * 60));
          const overdueMinutes = Math.floor(Math.abs(alertTimeLeftMs) / (1000 * 60));
          
          if (overdueDays > 0) {
            timeLeftValue = overdueDays;
            timeLeftUnit = 'day';
            timeLeftDisplay = `${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`;
          } else if (overdueHours > 0) {
            timeLeftValue = overdueHours;
            timeLeftUnit = 'hour';
            timeLeftDisplay = `${overdueHours}h overdue`;
          } else if (overdueMinutes > 0) {
            timeLeftValue = overdueMinutes;
            timeLeftUnit = 'minute';
            timeLeftDisplay = `${overdueMinutes}m overdue`;
          } else {
            timeLeftDisplay = 'Just overdue';
          }
        } else {
          const daysLeft = Math.floor(alertTimeLeftMs / (1000 * 60 * 60 * 24));
          const hoursLeft = Math.floor(alertTimeLeftMs / (1000 * 60 * 60));
          const minutesLeft = Math.floor(alertTimeLeftMs / (1000 * 60));
          
          if (daysLeft >= 1) {
            timeLeftValue = daysLeft;
            timeLeftUnit = 'day';
            timeLeftDisplay = `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`;
          } else if (hoursLeft >= 1) {
            timeLeftValue = hoursLeft;
            timeLeftUnit = 'hour';
            timeLeftDisplay = `${hoursLeft}h left`;
          } else if (minutesLeft > 0) {
            timeLeftValue = minutesLeft;
            timeLeftUnit = 'minute';
            timeLeftDisplay = `${minutesLeft}m left`;
          } else {
            timeLeftDisplay = 'Alert now';
          }
        }
        
        const nextDueTime = new Date(lastCheckIn.getTime() + frequencyMs);

        return {
          event_id: event.id,
          event_name: event.name,
          event_status: event.status,
          last_checkin: event.last_check_in || event.created_at,
          next_checkin_due: nextDueTime.toISOString(),
          hours_until_due: 0, // Not used anymore
          is_overdue: isAlertExpired,
          hours_overdue: 0, // Not used anymore
          hours_until_alert: 0, // Not used anymore
          is_alert_time: alertTimeLeftMs <= 0,
          alert_time_left_ms: alertTimeLeftMs,
          alert_time_left_display: timeLeftDisplay,
          alert_time_left_value: timeLeftValue,
          alert_time_left_unit: timeLeftUnit
        };
      });

      console.log('📊 Debug: All events received:', transformedData);
      setCheckinStatuses(transformedData);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const performCheckin = async (eventId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('Attempting check-in for event:', eventId);
      
      // Use the same Edge Function as the web app - let server handle timestamp
      const { data, error } = await supabase.functions.invoke(
        "check-in",
        {
          body: { eventId }, // Only send eventId, server will use server time
        },
      );

      console.log('Check-in response:', { data, error });

      if (error) {
        console.error('Check-in function error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Check-in failed');
      }

      Alert.alert('Success!', 'Checked in successfully! 🎉');
      // Refresh the status
      await fetchCheckinStatus();
    } catch (error) {
      console.error('Error performing check-in:', error);
      
      // Use a more user-friendly error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      const formattedError = errorMessage.includes("404")
        ? "The check-in service is currently unavailable. Please try again later."
        : `Error checking in: ${errorMessage}`;

      Alert.alert('Error', formattedError);
    } finally {
      setLoading(false);
    }
  };

  const performCheckInAll = async () => {
    if (!user || checkinStatuses.length === 0) return;

    // Filter out only events that are explicitly deleted or can't be checked into
    // Allow all other statuses (running, active, paused, triggered, etc.)
    const checkableEvents = checkinStatuses.filter(status => 
      // Include all events except those that are explicitly non-checkable
      status.event_status !== 'deleted'
    );

    if (checkableEvents.length === 0) {
      Alert.alert(
        'No Events Available',
        'There are no events available to check in to.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Check In All Events',
      `This will check you in to ${checkableEvents.length} event${checkableEvents.length > 1 ? 's' : ''}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Check In All', onPress: performAllCheckIns }
      ]
    );
  };

  const performAllCheckIns = async () => {
    if (!user) return;
    
    setCheckingInAll(true);
    const checkableEvents = checkinStatuses.filter(status => 
      status.event_status !== 'deleted'
    );

    let successCount = 0;
    let errorCount = 0;

    try {
      // Perform check-ins in parallel for better performance
      const checkInPromises = checkableEvents.map(async (status) => {
        try {
          console.log(`Attempting check-in for event: ${status.event_name}`);
          
          // Use the same Edge Function as the web app - let server handle timestamp
          const { data, error } = await supabase.functions.invoke(
            "check-in",
            {
              body: { eventId: status.event_id }, // Only send eventId, server will use server time
            },
          );

          if (error) {
            console.error(`Check-in function error for ${status.event_name}:`, error);
            errorCount++;
            return { success: false, eventName: status.event_name, error: error.message };
          }

          if (!data.success) {
            console.error(`Check-in failed for ${status.event_name}:`, data.error);
            errorCount++;
            return { success: false, eventName: status.event_name, error: data.error };
          }

          console.log(`Check-in successful for ${status.event_name}`);
          successCount++;
          return { success: true, eventName: status.event_name };
        } catch (error) {
          console.error(`Error checking in to ${status.event_name}:`, error);
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return { success: false, eventName: status.event_name, error: errorMessage };
        }
      });

      await Promise.all(checkInPromises);

      // Show results to user
      if (successCount > 0 && errorCount === 0) {
        Alert.alert(
          'Success!',
          `Successfully checked in to all ${successCount} event${successCount > 1 ? 's' : ''}! 🎉`,
          [{ text: 'OK' }]
        );
      } else if (successCount > 0 && errorCount > 0) {
        Alert.alert(
          'Partial Success',
          `Successfully checked in to ${successCount} event${successCount > 1 ? 's' : ''}, but ${errorCount} failed. Please check individual events.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Check-In Failed',
          'Unable to check in to any events. Please try again or check individual events.',
          [{ text: 'OK' }]
        );
      }

      // Refresh the status regardless of outcome
      await fetchCheckinStatus();

    } catch (error) {
      console.error('Error performing bulk check-ins:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while checking in. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setCheckingInAll(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCheckinStatus();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCheckinStatus();
  }, [user]);

  const getStatusColor = (status: CheckinStatus) => {
    if (status.event_status === 'triggered') return '#f44336'; // Red
    if (status.is_overdue) return '#f44336'; // Red for overdue
    
    // Color based on alert time left
    if (status.alert_time_left_value === 0) return '#ff5722'; // Deep orange for "Alert now"
    
    if (status.alert_time_left_unit === 'minute') {
      if (status.alert_time_left_value <= 30) return '#ff9800'; // Orange for 30 minutes or less
      return '#ffc107'; // Amber for more than 30 minutes
    }
    
    if (status.alert_time_left_unit === 'hour') {
      if (status.alert_time_left_value <= 2) return '#ffc107'; // Amber for 2 hours or less
      if (status.alert_time_left_value <= 12) return '#2196f3'; // Blue for 12 hours or less
      return '#4caf50'; // Green for more than 12 hours
    }
    
    if (status.alert_time_left_unit === 'day') {
      if (status.alert_time_left_value <= 1) return '#2196f3'; // Blue for 1 day or less
      return '#4caf50'; // Green for more than 1 day
    }
    
    return '#4caf50'; // Green default
  };

  const getStatusText = (status: CheckinStatus) => {
    if (status.event_status === 'triggered') return 'TRIGGERED';
    return status.alert_time_left_display;
  };

  const checkableEventsCount = checkinStatuses.filter(status => 
    status.event_status !== 'deleted'
  ).length;

  const formatLastCheckIn = (lastCheckIn: string) => {
    const date = new Date(lastCheckIn);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb']}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Text variant="headlineMedium" style={styles.welcome}>
              Welcome back!
            </Text>
            <Text variant="bodyLarge" style={styles.userEmail}>
              {user?.email}
            </Text>
          </View>
          <IconButton
            icon="logout"
            iconColor="white"
            size={24}
            onPress={handleLogout}
            style={styles.logoutButton}
          />
        </View>

        <View style={styles.content}>
          <Text variant="headlineLarge" style={styles.title}>
            Stay Connected
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Your safety check-in dashboard
          </Text>

          {/* Check In All Events Button */}
          {checkinStatuses.length > 0 && (
            <Card style={styles.checkInAllCard} elevation={5}>
              <Card.Content style={styles.checkInAllContent}>
                <View style={styles.checkInAllHeader}>
                  <View style={styles.checkInAllInfo}>
                    <Text variant="titleLarge" style={styles.checkInAllTitle}>
                      Quick Check-In
                    </Text>
                    <Text variant="bodyMedium" style={styles.checkInAllSubtitle}>
                      Check in to all {checkableEventsCount} event{checkableEventsCount > 1 ? 's' : ''} at once
                    </Text>
                  </View>
                  <Text style={styles.checkInAllIcon}>✅</Text>
                </View>
                <Button
                  mode="contained"
                  onPress={performCheckInAll}
                  disabled={checkingInAll || loading}
                  style={styles.checkInAllButton}
                  contentStyle={styles.checkInAllButtonContent}
                  buttonColor="#4caf50"
                >
                  {checkingInAll ? 'Checking In All...' : 'Check In All Events'}
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* Check-in Status Cards */}
          {checkinStatuses.length > 0 && (
            <View style={styles.checkinSection}>
              <Text variant="titleLarge" style={styles.sectionTitle}>
                Your Check-in Events
              </Text>
              {checkinStatuses.map((status) => (
                <Card key={status.event_id} style={styles.checkinCard} elevation={4}>
                  <Card.Content style={styles.checkinCardContent}>
                    <View style={styles.checkinHeader}>
                      <View style={styles.checkinInfo}>
                        <Text variant="titleMedium" style={styles.eventName}>
                          {status.event_name}
                        </Text>
                        <Chip 
                          mode="flat" 
                          style={[styles.statusChip, { backgroundColor: getStatusColor(status) }]}
                          textStyle={styles.statusChipText}
                        >
                          {getStatusText(status)}
                        </Chip>
                      </View>
                      <Button
                        mode="contained"
                        onPress={() => performCheckin(status.event_id)}
                        disabled={loading || checkingInAll}
                        style={styles.checkinButton}
                        contentStyle={styles.checkinButtonContent}
                      >
                        {loading ? 'Checking In...' : 'Check In'}
                      </Button>
                    </View>
                    <Text variant="bodySmall" style={styles.lastCheckin}>
                      Last check-in: {formatLastCheckIn(status.last_checkin)}
                    </Text>
                    <Text variant="bodySmall" style={styles.alertInfo}>
                      Alert time: {status.alert_time_left_display}
                    </Text>
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}

          <View style={styles.cardContainer}>
            <Card style={styles.card} elevation={4}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>📅</Text>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    View Events
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.cardDescription}>
                  See all your check-in events and their status
                </Text>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('Events')}
                  style={styles.cardButton}
                  contentStyle={styles.cardButtonContent}
                >
                  View All Events
                </Button>
              </Card.Content>
            </Card>

            <Card style={styles.card} elevation={4}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>➕</Text>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    Create Event
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.cardDescription}>
                  Set up a new check-in event with notifications
                </Text>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('CreateEvent')}
                  style={styles.cardButton}
                  contentStyle={styles.cardButtonContent}
                >
                  Create New Event
                </Button>
              </Card.Content>
            </Card>

            <Card style={styles.card} elevation={4}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>👥</Text>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    Emergency Contacts
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.cardDescription}>
                  Manage contacts who get notified if you miss check-ins
                </Text>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('Contacts')}
                  style={styles.cardButton}
                  contentStyle={styles.cardButtonContent}
                >
                  Manage Contacts
                </Button>
              </Card.Content>
            </Card>

            <Card style={styles.card} elevation={4}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>👤</Text>
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    My Profile
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.cardDescription}>
                  Manage your account and notification preferences
                </Text>
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('Profile')}
                  style={styles.cardButton}
                  contentStyle={styles.cardButtonContent}
                >
                  View Profile
                </Button>
              </Card.Content>
            </Card>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  userInfo: {
    flex: 1,
  },
  welcome: {
    color: 'white',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  userEmail: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  checkinSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  checkinCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 12,
  },
  checkinCardContent: {
    padding: 16,
  },
  checkinHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkinInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventName: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkinButton: {
    borderRadius: 20,
  },
  checkinButtonContent: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  lastCheckin: {
    color: '#666',
    fontStyle: 'italic',
  },
  alertInfo: {
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  card: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  cardTitle: {
    fontWeight: 'bold',
    flex: 1,
  },
  cardDescription: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  cardButton: {
    borderRadius: 20,
  },
  cardButtonContent: {
    paddingVertical: 6,
  },
  checkInAllCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 20,
  },
  checkInAllContent: {
    padding: 16,
  },
  checkInAllHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkInAllInfo: {
    flex: 1,
  },
  checkInAllTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  checkInAllSubtitle: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  checkInAllIcon: {
    fontSize: 24,
    marginLeft: 12,
  },
  checkInAllButton: {
    borderRadius: 20,
  },
  checkInAllButtonContent: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
}); 