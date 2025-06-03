import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, Avatar, Card } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = React.useState({
    name: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      if (!user) throw new Error('No user found');

      // First try to get data from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, email, full_name, phone')
        .eq('user_id', user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        // If it's not a "not found" error, throw it
        throw userError;
      }

      // Always get phone from auth metadata as it's the most reliable source
      let name = '';
      let email = user.email || '';
      let phone = user.user_metadata?.phone || '';

      console.log('📱 Debug Profile Data:');
      console.log('- User metadata phone:', user.user_metadata?.phone);
      console.log('- Users table data:', userData);
      console.log('- Final phone value:', phone);

      if (userData) {
        name = userData.name || userData.full_name || '';
        email = userData.email || user.email || '';
        // Also try to get phone from users table if available
        phone = userData.phone || user.user_metadata?.phone || '';
      } else {
        // Use auth metadata as fallback
        name = user.user_metadata?.full_name || user.user_metadata?.name || '';
        phone = user.user_metadata?.phone || '';
      }

      console.log('📱 Final profile state:', { name, email, phone });

      setProfile({
        name,
        email,
        phone,
      });
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      // Don't show error for missing profile, just use auth data
      if (user) {
        setProfile({
          name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          email: user.email || '',
          phone: user.user_metadata?.phone || '',
        });
      }
    }
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user) throw new Error('No user found');

      // Update auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.name,
          phone: profile.phone,
        },
      });

      if (authError) throw authError;

      // Try to update or insert into users table
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          user_id: user.id,
          name: profile.name,
          full_name: profile.name,
          email: profile.email,
          phone: profile.phone,
          token_identifier: user.id, // Required field
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      // Don't throw error if users table doesn't exist or has issues
      if (upsertError) {
        console.warn('Could not update users table:', upsertError);
      }

      setError('');
      navigation.goBack();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (profile.name) {
      return profile.name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
    }
    if (profile.email) {
      return profile.email.substring(0, 2).toUpperCase();
    }
    return '??';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <Avatar.Text 
            size={80} 
            label={getInitials()}
          />
        </View>

        <Card style={styles.section}>
          <Card.Title title="Profile Information" />
          <Card.Content>
            <TextInput
              label="Full Name"
              value={profile.name}
              onChangeText={(text) => setProfile(prev => ({ ...prev, name: text }))}
              style={styles.input}
              placeholder="Enter your full name"
            />
            <TextInput
              label="Email"
              value={profile.email}
              onChangeText={(text) => setProfile(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              style={styles.input}
              placeholder="Enter your email"
              editable={false} // Email usually can't be changed
              disabled
            />
            <Text variant="bodySmall" style={styles.helperText}>
              Email cannot be changed. Contact support if needed.
            </Text>
            <TextInput
              label="Phone Number"
              value={profile.phone}
              onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
              style={styles.input}
              placeholder="Enter your phone number"
            />

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <Button
              mode="contained"
              onPress={handleUpdate}
              loading={loading}
              disabled={loading}
              style={styles.updateButton}
            >
              Update Profile
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.section}>
          <Card.Title title="Emergency Contacts" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.sectionDescription}>
              Manage contacts who will be notified if you miss check-ins. 
              Add at least one contact to create safety events.
            </Text>
            <Button
              mode="outlined"
              icon="account-multiple"
              onPress={() => navigation.navigate('Contacts')}
              style={styles.contactsButton}
            >
              Manage Emergency Contacts
            </Button>
          </Card.Content>
        </Card>
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
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 16,
  },
  sectionDescription: {
    marginBottom: 16,
  },
  updateButton: {
    marginTop: 16,
  },
  contactsButton: {
    marginTop: 16,
  },
  errorText: {
    color: '#B00020',
    marginBottom: 16,
  },
  helperText: {
    color: '#666',
    marginBottom: 16,
  },
}); 