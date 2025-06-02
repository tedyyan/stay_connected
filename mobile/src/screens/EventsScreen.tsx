import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, Button, FAB, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Events'>;

type Event = {
  id: string;
  name: string;
  last_contact_time: string;
  notification_interval: number;
  user_id: string;
};

export default function EventsScreen({ navigation }: Props) {
  const [events, setEvents] = React.useState<Event[]>([]);
  const theme = useTheme();

  React.useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleConnect = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ last_contact_time: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw error;
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {events.map((event) => (
          <Card key={event.id} style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge">{event.name}</Text>
              <Text variant="bodyMedium">
                Last Contact: {new Date(event.last_contact_time).toLocaleDateString()}
              </Text>
              <Text variant="bodyMedium">
                Notification Interval: {event.notification_interval} days
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => handleConnect(event.id)}>Connect</Button>
            </Card.Actions>
          </Card>
        ))}
      </ScrollView>
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('CreateEvent')}
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
  },
  card: {
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
}); 