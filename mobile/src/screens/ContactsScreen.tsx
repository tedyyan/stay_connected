import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Card, 
  Text, 
  Button, 
  FAB, 
  IconButton, 
  Portal, 
  Modal, 
  TextInput,
  HelperText 
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Contacts'>;

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  user_id: string;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

export default function ContactsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showContactForm, setShowContactForm] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(null);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
  });
  const [formError, setFormError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    if (!user) return;
    
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const openContactForm = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
      });
    } else {
      setEditingContact(null);
      setFormData({ name: '', email: '', phone: '' });
    }
    setFormError('');
    setShowContactForm(true);
  };

  const closeContactForm = () => {
    setShowContactForm(false);
    setEditingContact(null);
    setFormData({ name: '', email: '', phone: '' });
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');

    if (!formData.name) {
      setFormError('Name is required');
      return;
    }

    if (!formData.email && !formData.phone) {
      setFormError('Either email or phone is required');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingContact) {
        // Update existing contact
        const { error } = await supabase
          .from('contacts')
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingContact.id);

        if (error) throw error;

        // Log the activity
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          action: 'update_contact',
          details: { contact_name: formData.name },
        });
      } else {
        // Create new contact
        const { error } = await supabase
          .from('contacts')
          .insert({
            user_id: user?.id,
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            deleted: false,
          });

        if (error) throw error;

        // Log the activity
        await supabase.from('activity_logs').insert({
          user_id: user?.id,
          action: 'create_contact',
          details: { contact_name: formData.name },
        });
      }

      closeContactForm();
      fetchContacts(); // Refresh the list
    } catch (error: any) {
      console.error('Error saving contact:', error);
      setFormError(error.message || 'An error occurred while saving the contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteContact(contact)
        }
      ]
    );
  };

  const deleteContact = async (contact: Contact) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ deleted: true })
        .eq('id', contact.id);

      if (error) throw error;

      // Log the activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'delete_contact',
        details: { contact_name: contact.name },
      });

      fetchContacts(); // Refresh the list
    } catch (error) {
      console.error('Error deleting contact:', error);
      Alert.alert('Error', 'Failed to delete contact. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {contacts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Text variant="headlineSmall" style={styles.emptyTitle}>
                No Emergency Contacts
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Add emergency contacts who will be notified if you miss check-ins. 
                Both email and SMS notifications will be sent if available.
              </Text>
              <Button 
                mode="contained" 
                onPress={() => openContactForm()}
                style={styles.emptyButton}
              >
                Add First Contact
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <View style={styles.contactsList}>
            {contacts.map((contact) => (
              <Card key={contact.id} style={styles.contactCard}>
                <Card.Content>
                  <View style={styles.contactHeader}>
                    <Text variant="titleMedium" style={styles.contactName}>
                      {contact.name}
                    </Text>
                    <View style={styles.contactActions}>
                      <IconButton
                        icon="pencil"
                        size={20}
                        onPress={() => openContactForm(contact)}
                      />
                      <IconButton
                        icon="delete"
                        iconColor="#f44336"
                        size={20}
                        onPress={() => handleDelete(contact)}
                      />
                    </View>
                  </View>
                  
                  <View style={styles.contactDetails}>
                    {contact.email && (
                      <View style={styles.contactDetail}>
                        <Text variant="bodySmall" style={styles.contactLabel}>
                          Email:
                        </Text>
                        <Text variant="bodySmall" style={styles.contactValue}>
                          {contact.email}
                        </Text>
                      </View>
                    )}
                    
                    {contact.phone && (
                      <View style={styles.contactDetail}>
                        <Text variant="bodySmall" style={styles.contactLabel}>
                          Phone:
                        </Text>
                        <Text variant="bodySmall" style={styles.contactValue}>
                          {contact.phone}
                        </Text>
                      </View>
                    )}
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => openContactForm()}
      />

      {/* Contact Form Modal */}
      <Portal>
        <Modal
          visible={showContactForm}
          onDismiss={closeContactForm}
          contentContainerStyle={styles.modalContainer}
        >
          <Card>
            <Card.Title 
              title={editingContact ? 'Edit Contact' : 'Add Contact'} 
              subtitle={editingContact 
                ? 'Update contact information below.' 
                : 'Add a new contact who will be notified when you miss a check-in.'
              }
            />
            <Card.Content>
              <TextInput
                label="Name"
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                style={styles.formInput}
                placeholder="John Doe"
              />

              <TextInput
                label="Email"
                value={formData.email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
                style={styles.formInput}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <HelperText type="info">
                Email notifications will be sent if provided
              </HelperText>

              <TextInput
                label="Phone Number"
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                style={styles.formInput}
                placeholder="+1234567890"
                keyboardType="phone-pad"
              />
              <HelperText type="info">
                SMS notifications will be sent if provided
              </HelperText>

              {formError ? (
                <Text style={styles.errorText}>{formError}</Text>
              ) : null}
            </Card.Content>
            <Card.Actions>
              <Button 
                onPress={closeContactForm}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                mode="contained"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : editingContact ? 'Update' : 'Add'}
              </Button>
            </Card.Actions>
          </Card>
        </Modal>
      </Portal>
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
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80, // Account for FAB
  },
  emptyCard: {
    marginTop: 40,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 8,
  },
  contactsList: {
    gap: 12,
  },
  contactCard: {
    marginBottom: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactName: {
    flex: 1,
    fontWeight: 'bold',
  },
  contactActions: {
    flexDirection: 'row',
  },
  contactDetails: {
    gap: 4,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactLabel: {
    fontWeight: 'bold',
    minWidth: 50,
    marginRight: 8,
  },
  contactValue: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    margin: 16,
  },
  formInput: {
    marginBottom: 8,
  },
  errorText: {
    color: '#f44336',
    marginTop: 8,
    fontSize: 14,
  },
}); 