import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
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
}

export default function HomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [checkinStatuses, setCheckinStatuses] = useState<CheckinStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      const { data, error } = await supabase.rpc('get_user_checkin_status', {
        user_id_param: user.id
      });

      if (error) {
        console.error('Error fetching check-in status:', error);
        return;
      }

      setCheckinStatuses(data || []);
    } catch (error) {
      console.error('Error fetching check-in status:', error);
    }
  };

  const performCheckin = async (eventId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('perform_checkin', {
        event_id_param: eventId,
        user_id_param: user.id,
        notes_param: 'Check-in from mobile app',
        location_param: null
      });

      if (error) {
        console.error('Error performing check-in:', error);
        return;
      }

      console.log('Check-in successful:', data);
      // Refresh the status
      await fetchCheckinStatus();
    } catch (error) {
      console.error('Error performing check-in:', error);
    } finally {
      setLoading(false);
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
    if (status.is_overdue) return '#ff9800'; // Orange
    return '#4caf50'; // Green
  };

  const getStatusText = (status: CheckinStatus) => {
    if (status.event_status === 'triggered') return 'TRIGGERED';
    if (status.is_overdue) return `OVERDUE by ${status.hours_overdue}h`;
    return `Due in ${status.hours_until_due}h`;
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
                        disabled={loading}
                        style={styles.checkinButton}
                        contentStyle={styles.checkinButtonContent}
                      >
                        {loading ? 'Checking In...' : 'Check In'}
                      </Button>
                    </View>
                    <Text variant="bodySmall" style={styles.lastCheckin}>
                      Last check-in: {status.last_checkin ? 
                        new Date(status.last_checkin).toLocaleDateString() : 
                        'Never'
                      }
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
                  onPress={() => {
                    // TODO: Add Contacts screen to navigation
                    console.log('Contacts screen coming soon');
                  }}
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
}); 