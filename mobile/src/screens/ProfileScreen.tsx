import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, Avatar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    }
  };

  const handleUpdate = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;
      navigation.goBack();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <Avatar.Text 
            size={80} 
            label={profile.name ? profile.name.substring(0, 2).toUpperCase() : '??'} 
          />
        </View>

        <TextInput
          label="Name"
          value={profile.name}
          onChangeText={(text) => setProfile(prev => ({ ...prev, name: text }))}
          style={styles.input}
        />
        <TextInput
          label="Email"
          value={profile.email}
          onChangeText={(text) => setProfile(prev => ({ ...prev, email: text }))}
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          label="Phone"
          value={profile.phone}
          onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
          keyboardType="phone-pad"
          style={styles.input}
        />

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <Button
          mode="contained"
          onPress={handleUpdate}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Update Profile
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
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
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