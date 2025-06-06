// import './src/polyfills';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoadingScreen from './src/screens/LoadingScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import EventsScreen from './src/screens/EventsScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import NotificationHistoryScreen from './src/screens/NotificationHistoryScreen';

export type RootStackParamList = {
  Home: undefined;
  Events: undefined;
  CreateEvent: { eventToEdit?: any } | undefined;
  Profile: undefined;
  Contacts: undefined;
  NotificationHistory: { eventId: string; eventName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>
            The app encountered an error. Please restart the app.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetails}>
              {this.state.error.toString()}
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

function AuthenticatedApp() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false, // Hide headers for cleaner UI with gradients
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
        />
        <Stack.Screen 
          name="Events" 
          component={EventsScreen}
          options={{ 
            headerShown: true,
            title: 'My Events',
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen 
          name="CreateEvent" 
          component={CreateEventScreen}
          options={{ 
            headerShown: true,
            title: 'Create Event',
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={{ 
            headerShown: true,
            title: 'My Profile',
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen 
          name="Contacts" 
          component={ContactsScreen}
          options={{ 
            headerShown: true,
            title: 'Contacts',
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen 
          name="NotificationHistory" 
          component={NotificationHistoryScreen}
          options={{ 
            headerShown: true,
            title: 'Notification History',
            headerStyle: {
              backgroundColor: theme.colors.primary,
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <PaperProvider theme={theme}>
        <StatusBar style="light" />
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PaperProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 16,
  },
  errorDetails: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    marginTop: 16,
  },
});
