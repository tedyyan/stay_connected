import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Card, Chip, Checkbox, HelperText, Portal, Modal, List, RadioButton } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateEvent'>;

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  user_id: string;
}

export default function CreateEventScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [name, setName] = React.useState('');
  const [memo, setMemo] = React.useState('');
  const [notificationContent, setNotificationContent] = React.useState('');
  const [inactivityValue, setInactivityValue] = React.useState('1');
  const [inactivityUnit, setInactivityUnit] = React.useState('day');
  const [missedCheckinThreshold, setMissedCheckinThreshold] = React.useState(2);
  const [selectedContacts, setSelectedContacts] = React.useState<string[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showUnitPicker, setShowUnitPicker] = React.useState(false);
  const [showThresholdPicker, setShowThresholdPicker] = React.useState(false);

  const units = [
    { label: 'Minute(s)', value: 'minute' },
    { label: 'Hour(s)', value: 'hour' },
    { label: 'Day(s)', value: 'day' },
    { label: 'Week(s)', value: 'week' },
    { label: 'Month(s)', value: 'month' },
  ];

  const thresholds = [
    { label: 'After 1 missed check-in', value: 1 },
    { label: 'After 2 missed check-ins in a row', value: 2 },
    { label: 'After 3 missed check-ins in a row', value: 3 },
    { label: 'After 4 missed check-ins in a row', value: 4 },
    { label: 'After 5 missed check-ins in a row', value: 5 },
  ];

  React.useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('name');

      if (error) {
        console.error('Error fetching contacts:', error);
        // Don't throw the error, just log it and continue with empty contacts
        return;
      }
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      // Continue with empty contacts array
      setContacts([]);
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const navigateToContacts = () => {
    Alert.alert(
      'No Contacts',
      'You need to add emergency contacts first. Would you like to add a contact now?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add Contact', onPress: () => navigation.navigate('Contacts') }
      ]
    );
  };

  const handleCreate = async () => {
    if (!name) {
      setError('Name is required');
      return;
    }

    if (selectedContacts.length === 0) {
      setError('At least one contact is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const maxInactivityTime = `${inactivityValue} ${inactivityUnit}${parseInt(inactivityValue) > 1 ? 's' : ''}`;
      
      // Create the event
      const { data: newEvent, error: createError } = await supabase
        .from('events')
        .insert({
          user_id: user?.id,
          name,
          memo,
          notification_content: notificationContent,
          check_in_frequency: maxInactivityTime,
          last_check_in: new Date().toISOString(),
          status: 'running',
          missed_checkin_threshold: missedCheckinThreshold,
          contacts: [], // Empty array for the contacts column
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create event_contacts associations
      if (selectedContacts.length > 0 && newEvent) {
        const eventContactsToInsert = selectedContacts.map(contactId => ({
          event_id: newEvent.id,
          contact_id: contactId
        }));

        const { error: contactsError } = await supabase
          .from('event_contacts')
          .insert(eventContactsToInsert);

        if (contactsError) throw contactsError;
      }

      // Log the activity
      if (newEvent) {
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          event_id: newEvent.id,
          action: 'create_event',
          details: { event_name: name },
        });
      }

      navigation.navigate('Events');
    } catch (err: any) {
      console.error('Error creating event:', err);
      setError(err.message || 'Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getUnitLabel = () => {
    const unit = units.find(u => u.value === inactivityUnit);
    return unit ? unit.label : 'Day(s)';
  };

  const getThresholdLabel = () => {
    const threshold = thresholds.find(t => t.value === missedCheckinThreshold);
    return threshold ? threshold.label : 'After 2 missed check-ins in a row';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.infoTitle}>How it works:</Text>
            <Text variant="bodySmall" style={styles.infoText}>
              • You'll need to check in at your specified frequency{'\n'}
              • If you miss check-ins, contacts will be automatically notified{'\n'}
              • Use your mobile app or web dashboard to check in quickly
            </Text>
          </Card.Content>
        </Card>

        <TextInput
          label="Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Daily Check-In"
        />

        <TextInput
          label="Description (Optional)"
          value={memo}
          onChangeText={setMemo}
          style={styles.input}
          placeholder="Brief description of this check-in"
          multiline
          numberOfLines={2}
        />

        <Text variant="titleSmall" style={styles.sectionTitle}>Check-In Frequency</Text>
        <View style={styles.frequencyContainer}>
          <TextInput
            label="Value"
            value={inactivityValue}
            onChangeText={setInactivityValue}
            style={styles.frequencyInput}
            keyboardType="numeric"
          />
          <Button
            mode="outlined"
            onPress={() => setShowUnitPicker(true)}
            style={styles.frequencyButton}
            contentStyle={styles.frequencyButtonContent}
          >
            {getUnitLabel()}
          </Button>
        </View>
        <HelperText type="info">
          How often you need to check in to confirm you're safe
        </HelperText>
        <Text variant="bodySmall" style={styles.currentFrequency}>
          Current: {inactivityValue} {inactivityUnit}{parseInt(inactivityValue) > 1 ? 's' : ''}
        </Text>

        <Text variant="titleSmall" style={styles.sectionTitle}>Alert Trigger</Text>
        <Button
          mode="outlined"
          onPress={() => setShowThresholdPicker(true)}
          style={styles.input}
          contentStyle={styles.pickerButtonContent}
        >
          {getThresholdLabel()}
        </Button>
        <HelperText type="info">
          Contacts will be notified after this many consecutive missed check-ins
        </HelperText>

        <TextInput
          label="Notification Message (Optional)"
          value={notificationContent}
          onChangeText={setNotificationContent}
          style={styles.input}
          placeholder="Custom message to send when check-in is missed"
          multiline
          numberOfLines={3}
        />

        <Text variant="titleSmall" style={styles.sectionTitle}>Contacts to Notify</Text>
        {contacts.length === 0 ? (
          <Card style={styles.noContactsCard}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.noContactsText}>
                No contacts available. Please add contacts first.
              </Text>
              <Button 
                mode="contained" 
                onPress={navigateToContacts}
                style={styles.addContactButton}
              >
                Add Contact
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.contactsCard}>
            <Card.Content>
              {contacts.map((contact) => (
                <View key={contact.id} style={styles.contactRow}>
                  <Checkbox
                    status={selectedContacts.includes(contact.id) ? 'checked' : 'unchecked'}
                    onPress={() => handleContactToggle(contact.id)}
                  />
                  <View style={styles.contactInfo}>
                    <Text variant="bodyMedium">{contact.name}</Text>
                    {contact.email && (
                      <Text variant="bodySmall" style={styles.contactDetail}>
                        {contact.email}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={loading || contacts.length === 0}
          style={styles.createButton}
        >
          {loading ? 'Creating...' : 'Create Check-In'}
        </Button>
      </View>

      {/* Unit Picker Modal */}
      <Portal>
        <Modal
          visible={showUnitPicker}
          onDismiss={() => setShowUnitPicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Card>
            <Card.Title title="Select Time Unit" />
            <Card.Content>
              <RadioButton.Group
                value={inactivityUnit}
                onValueChange={setInactivityUnit}
              >
                {units.map((unit) => (
                  <View key={unit.value} style={styles.radioRow}>
                    <RadioButton value={unit.value} />
                    <Text variant="bodyMedium" style={styles.radioLabel}>
                      {unit.label}
                    </Text>
                  </View>
                ))}
              </RadioButton.Group>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => setShowUnitPicker(false)}>Done</Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>

      {/* Threshold Picker Modal */}
      <Portal>
        <Modal
          visible={showThresholdPicker}
          onDismiss={() => setShowThresholdPicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Card>
            <Card.Title title="Select Alert Trigger" />
            <Card.Content>
              <RadioButton.Group
                value={missedCheckinThreshold.toString()}
                onValueChange={(value) => setMissedCheckinThreshold(parseInt(value))}
              >
                {thresholds.map((threshold) => (
                  <View key={threshold.value} style={styles.radioRow}>
                    <RadioButton value={threshold.value.toString()} />
                    <Text variant="bodyMedium" style={styles.radioLabel}>
                      {threshold.label}
                    </Text>
                  </View>
                ))}
              </RadioButton.Group>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => setShowThresholdPicker(false)}>Done</Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>
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
  infoCard: {
    marginBottom: 16,
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  frequencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequencyInput: {
    flex: 1,
    marginRight: 8,
  },
  frequencyButton: {
    marginRight: 8,
  },
  frequencyButtonContent: {
    padding: 8,
  },
  pickerButtonContent: {
    justifyContent: 'flex-start',
  },
  currentFrequency: {
    marginBottom: 16,
  },
  noContactsCard: {
    marginBottom: 16,
  },
  noContactsText: {
    marginBottom: 8,
  },
  addContactButton: {
    marginTop: 8,
  },
  contactsCard: {
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactDetail: {
    marginTop: 4,
  },
  createButton: {
    marginTop: 16,
  },
  modalContainer: {
    padding: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioLabel: {
    marginLeft: 8,
  },
}); 