import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { 
  Card, 
  Text, 
  Button, 
  FAB, 
  useTheme, 
  Chip, 
  IconButton, 
  ProgressBar,
  Menu,
  Divider
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Events'>;

interface Event {
  id: string;
  name: string;
  memo?: string;
  notification_content?: string;
  check_in_frequency?: string;
  max_inactivity_time?: string;
  missed_checkin_threshold?: number;
  last_check_in?: string;
  status: string;
  user_id: string;
  created_at: string;
  updated_at?: string;
  deleted: boolean;
  contacts?: { id: string }[];
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  user_id: string;
}

export default function EventsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState<Record<string, boolean>>({});
  const [menuVisible, setMenuVisible] = useState<Record<string, boolean>>({});
  const theme = useTheme();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    await Promise.all([fetchEvents(), fetchContacts()]);
  };

  const fetchEvents = async () => {
    if (!user) return;
    
    try {
      // Get events with their associated contacts
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_contacts (
            contact_id,
            contacts (
              id,
              name,
              email,
              phone
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Transform the data to include contacts in the expected format
      const transformedEvents = (eventsData || []).map(event => ({
        ...event,
        contacts: event.event_contacts?.map((ec: any) => ({ id: ec.contacts.id })) || []
      }));

      setEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to fetch events. Please try again.');
    }
  };

  const fetchContacts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const performCheckin = async (eventId: string) => {
    if (!user) return;
    
    setCheckingIn(prev => ({ ...prev, [eventId]: true }));
    try {
      console.log('Attempting check-in for event:', eventId);
      
      // Use the same Edge Function as the web app
      const { data, error } = await supabase.functions.invoke(
        "check-in",
        {
          body: { eventId },
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
      await fetchEvents(); // Refresh events to show updated status
    } catch (error) {
      console.error('Error performing check-in:', error);
      
      // Use a more user-friendly error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      const formattedError = errorMessage.includes("404")
        ? "The check-in service is currently unavailable. Please try again later."
        : `Error checking in: ${errorMessage}`;

      Alert.alert('Error', formattedError);
    } finally {
      setCheckingIn(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const handleTogglePause = async (event: Event) => {
    const newStatus = event.status === 'paused' ? 'running' : 'paused';
    const action = newStatus === 'paused' ? 'Pause' : 'Resume';

    Alert.alert(
      `${action} Event`,
      `Are you sure you want to ${action.toLowerCase()} "${event.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: action, 
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('events')
                .update({
                  status: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', event.id);

              if (error) throw error;

              // Log the activity
              await supabase.from('activity_logs').insert({
                user_id: event.user_id,
                event_id: event.id,
                action: newStatus === 'paused' ? 'pause_event' : 'resume_event',
                details: { event_name: event.name },
              });

              await fetchEvents();
              Alert.alert('Success!', `Event ${action.toLowerCase()}d successfully.`);
            } catch (error) {
              console.error(`Error ${action.toLowerCase()}ing event:`, error);
              Alert.alert('Error', `Failed to ${action.toLowerCase()} event.`);
            }
          }
        }
      ]
    );
  };

  const handleDeleteEvent = (event: Event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('events')
                .update({ deleted: true })
                .eq('id', event.id);

              if (error) throw error;

              // Log the activity
              await supabase.from('activity_logs').insert({
                user_id: event.user_id,
                event_id: event.id,
                action: 'delete_event',
                details: { event_name: event.name },
              });

              await fetchEvents();
              Alert.alert('Success!', 'Event deleted successfully.');
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event.');
            }
          }
        }
      ]
    );
  };

  const handleEditEvent = (event: Event) => {
    // For now, just navigate to CreateEvent screen
    // TODO: Update CreateEvent to handle editing
    Alert.alert(
      'Edit Event', 
      'Event editing will be available soon. For now, you can create a new event.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create New', onPress: () => navigation.navigate('CreateEvent') }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#4caf50'; // Green
      case 'triggered': return '#f44336'; // Red
      case 'paused': return '#ff9800'; // Orange
      default: return '#9e9e9e'; // Gray
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'RUNNING';
      case 'triggered': return 'TRIGGERED';
      case 'paused': return 'PAUSED';
      default: return status.toUpperCase();
    }
  };

  const getContactNames = (eventContacts: { id: string }[] = []) => {
    if (eventContacts.length === 0) return 'No contacts';
    
    const contactNames = eventContacts
      .map(ec => contacts.find(c => c.id === ec.id)?.name)
      .filter(Boolean)
      .join(', ');
    
    return contactNames || 'No contacts';
  };

  const formatLastCheckIn = (lastCheckIn?: string, createdAt?: string) => {
    const date = lastCheckIn || createdAt;
    if (!date) return 'Never';
    
    const now = new Date();
    const checkInDate = new Date(date);
    const diffMs = now.getTime() - checkInDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Less than 1 hour ago';
    }
  };

  const getEventProgress = (event: Event) => {
    if (event.status === 'paused') {
      return { 
        progress: 0, 
        color: '#ff9800',
        backgroundColor: '#fff3e0',
        textColor: '#ff9800',
        label: 'Paused',
        urgencyLevel: 'paused'
      };
    }
    
    if (event.status === 'triggered') {
      return { 
        progress: 1, 
        color: '#f44336',
        backgroundColor: '#ffebee',
        textColor: '#f44336',
        label: 'TRIGGERED',
        urgencyLevel: 'critical'
      };
    }
    
    // Calculate progress based on time since last check-in
    const lastCheckIn = new Date(event.last_check_in || event.created_at);
    const now = new Date();
    const diffMs = now.getTime() - lastCheckIn.getTime();
    
    // Parse check-in frequency with better parsing
    const frequency = event.check_in_frequency || '1 day';
    let frequencyMs = 24 * 60 * 60 * 1000; // Default 1 day
    
    const freqMatch = frequency.match(/(\d+)\s*(minute|hour|day|week|month)s?/i);
    if (freqMatch) {
      const value = parseInt(freqMatch[1]);
      const unit = freqMatch[2].toLowerCase();
      
      switch (unit) {
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
    
    const progress = Math.min(diffMs / frequencyMs, 1);
    const percentage = Math.round(progress * 100);
    
    // Enhanced color coding with more granular levels
    let color, backgroundColor, textColor, label, urgencyLevel;
    
    if (progress >= 1) {
      color = '#f44336'; // Red
      backgroundColor = '#ffebee';
      textColor = '#f44336';
      label = 'OVERDUE';
      urgencyLevel = 'critical';
    } else if (progress >= 0.85) {
      color = '#ff5722'; // Deep Orange
      backgroundColor = '#fff3e0';
      textColor = '#ff5722';
      label = 'URGENT';
      urgencyLevel = 'urgent';
    } else if (progress >= 0.65) {
      color = '#ff9800'; // Orange
      backgroundColor = '#fff8e1';
      textColor = '#ff9800';
      label = 'WARNING';
      urgencyLevel = 'warning';
    } else if (progress >= 0.35) {
      color = '#ffc107'; // Amber
      backgroundColor = '#fffde7';
      textColor = '#ff8f00';
      label = 'CAUTION';
      urgencyLevel = 'caution';
    } else {
      color = '#4caf50'; // Green
      backgroundColor = '#e8f5e8';
      textColor = '#2e7d32';
      label = 'GOOD';
      urgencyLevel = 'good';
    }
    
    return { 
      progress, 
      color, 
      backgroundColor, 
      textColor, 
      label, 
      percentage,
      urgencyLevel
    };
  };

  const toggleMenu = (eventId: string) => {
    setMenuVisible(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {events.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="headlineSmall" style={styles.emptyTitle}>
                No Check-In Events Yet
              </Text>
              <Text variant="bodyMedium" style={styles.emptyDescription}>
                Create your first check-in event to start monitoring your safety.
              </Text>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('CreateEvent')}
                style={styles.emptyButton}
                icon="plus"
              >
                Create Your First Event
              </Button>
            </Card.Content>
          </Card>
        ) : (
          events.map((event) => {
            const eventProgress = getEventProgress(event);
            
            return (
              <Card key={event.id} style={styles.eventCard}>
                {/* Enhanced Progress Section */}
                <View style={[styles.progressSection, { backgroundColor: eventProgress.backgroundColor }]}>
                  <View style={styles.progressHeader}>
                    <View style={styles.progressLabelSection}>
                      <Text style={styles.urgencyIcon}>
                        {eventProgress.urgencyLevel === 'critical' ? '🚨' : 
                         eventProgress.urgencyLevel === 'urgent' ? '⚠️' : 
                         eventProgress.urgencyLevel === 'warning' ? '🟠' : 
                         eventProgress.urgencyLevel === 'caution' ? '🟡' : 
                         eventProgress.urgencyLevel === 'paused' ? '⏸️' : '✅'}
                      </Text>
                      <Text style={[styles.progressLabel, { color: eventProgress.textColor }]}>
                        {eventProgress.label}
                      </Text>
                    </View>
                    <Text style={[styles.progressPercentage, { color: eventProgress.textColor }]}>
                      {eventProgress.percentage}%
                    </Text>
                  </View>
                  <ProgressBar 
                    progress={eventProgress.progress} 
                    color={eventProgress.color}
                    style={styles.progressBar}
                  />
                  <Text style={styles.progressSubtext}>
                    {eventProgress.urgencyLevel === 'paused' ? 'Event is paused' :
                     eventProgress.urgencyLevel === 'critical' ? 'Check-in overdue! Please check in immediately' :
                     eventProgress.urgencyLevel === 'urgent' ? 'Check-in needed very soon' :
                     eventProgress.urgencyLevel === 'warning' ? 'Check-in due soon' :
                     eventProgress.urgencyLevel === 'caution' ? 'Check-in approaching' :
                     'Next check-in not due yet'}
                  </Text>
                </View>
                
                <Card.Content style={styles.cardContent}>
                  {/* Header */}
                  <View style={styles.eventHeader}>
                    <View style={styles.titleSection}>
                      <Text variant="titleLarge" style={styles.eventName}>
                        {event.name}
                      </Text>
                      <Chip 
                        mode="flat" 
                        style={[styles.statusChip, { backgroundColor: getStatusColor(event.status) }]}
                        textStyle={styles.statusChipText}
                      >
                        {getStatusText(event.status)}
                      </Chip>
                    </View>
                    
                    <Menu
                      visible={menuVisible[event.id] || false}
                      onDismiss={() => toggleMenu(event.id)}
                      anchor={
                        <IconButton
                          icon="dots-vertical"
                          size={20}
                          onPress={() => toggleMenu(event.id)}
                        />
                      }
                    >
                      <Menu.Item 
                        onPress={() => {
                          toggleMenu(event.id);
                          handleEditEvent(event);
                        }}
                        title="Edit"
                        leadingIcon="pencil"
                      />
                      <Menu.Item 
                        onPress={() => {
                          toggleMenu(event.id);
                          handleTogglePause(event);
                        }}
                        title={event.status === 'paused' ? 'Resume' : 'Pause'}
                        leadingIcon={event.status === 'paused' ? 'play' : 'pause'}
                      />
                      <Divider />
                      <Menu.Item 
                        onPress={() => {
                          toggleMenu(event.id);
                          handleDeleteEvent(event);
                        }}
                        title="Delete"
                        leadingIcon="delete"
                        titleStyle={{ color: '#f44336' }}
                      />
                    </Menu>
                  </View>

                  {/* Description */}
                  {event.memo && (
                    <Text variant="bodyMedium" style={styles.eventDescription}>
                      {event.memo}
                    </Text>
                  )}

                  {/* Details Grid */}
                  <View style={styles.detailsGrid}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Check-in frequency:</Text>
                      <Text style={styles.detailValue}>
                        {event.check_in_frequency || event.max_inactivity_time || 'Not set'}
                      </Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notifies:</Text>
                      <Text style={styles.detailValue}>
                        {getContactNames(event.contacts)}
                      </Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Last check-in:</Text>
                      <Text style={styles.detailValue}>
                        {formatLastCheckIn(event.last_check_in, event.created_at)}
                      </Text>
                    </View>
                    
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Alert threshold:</Text>
                      <Text style={styles.detailValue}>
                        {event.missed_checkin_threshold || 2} missed check-ins
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <Button
                      mode="contained"
                      onPress={() => performCheckin(event.id)}
                      disabled={checkingIn[event.id] || event.status === 'paused'}
                      loading={checkingIn[event.id]}
                      style={styles.checkinButton}
                      contentStyle={styles.buttonContent}
                    >
                      {checkingIn[event.id] ? 'Checking In...' : "I'm Here"}
                    </Button>
                    
                    <Button
                      mode="outlined"
                      onPress={() => handleEditEvent(event)}
                      style={styles.editButton}
                      contentStyle={styles.buttonContent}
                      icon="pencil"
                    >
                      Edit
                    </Button>
                    
                    <Button
                      mode="outlined"
                      onPress={() => navigation.navigate('NotificationHistory', { eventId: event.id, eventName: event.name })}
                      style={styles.historyButton}
                      contentStyle={styles.buttonContent}
                      icon="bell-outline"
                    >
                      History
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>
      
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('CreateEvent')}
        label="Create Event"
      />
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
    paddingBottom: 80, // Space for FAB
  },
  emptyCard: {
    marginTop: 50,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  emptyDescription: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 8,
  },
  eventCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressSection: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabelSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressSubtext: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  cardContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
    marginRight: 8,
  },
  eventName: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusChipText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  eventDescription: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailsGrid: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: '40%',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  checkinButton: {
    flex: 2,
  },
  editButton: {
    flex: 1,
  },
  historyButton: {
    flex: 1,
  },
  buttonContent: {
    paddingVertical: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
}); 