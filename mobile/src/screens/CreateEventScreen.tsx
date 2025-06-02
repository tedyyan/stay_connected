import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateEvent'>;

export default function CreateEventScreen({ navigation }: Props) {
  const [name, setName] = React.useState('');
  const [notificationInterval, setNotificationInterval] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleCreate = async () => {
    if (!name || !notificationInterval) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: createError } = await supabase
        .from('events')
        .insert([
          {
            name,
            notification_interval: parseInt(notificationInterval),
            last_contact_time: new Date().toISOString(),
          },
        ]);

      if (createError) throw createError;

      navigation.navigate('Events');
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <TextInput
          label="Event Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          label="Notification Interval (days)"
          value={notificationInterval}
          onChangeText={setNotificationInterval}
          keyboardType="numeric"
          style={styles.input}
        />
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Create Event
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 16,
  },
  errorText: {
    color: '#B00020',
    marginBottom: 16,
  },
}); 