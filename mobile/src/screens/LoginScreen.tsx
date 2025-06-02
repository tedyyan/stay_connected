import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  Card,
  Snackbar,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  
  const { signIn, signUp } = useAuth();

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && (!fullName || !phone))) {
      showSnackbar('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName, phone);
        if (error) {
          showSnackbar(error.message);
        } else {
          showSnackbar('Check your email for verification link!');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          showSnackbar(error.message);
        }
      }
    } catch (error: any) {
      showSnackbar(error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2', '#f093fb']}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo/Title Area */}
            <View style={styles.header}>
              <Text variant="headlineLarge" style={styles.title}>
                Stay Connected
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                Never miss an important check-in
              </Text>
            </View>

            {/* Auth Card */}
            <Card style={styles.card} elevation={5}>
              <Card.Content style={styles.cardContent}>
                <Text variant="headlineSmall" style={styles.formTitle}>
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </Text>
                
                {isSignUp && (
                  <>
                    <TextInput
                      label="Full Name"
                      value={fullName}
                      onChangeText={setFullName}
                      style={styles.input}
                      mode="outlined"
                      left={<TextInput.Icon icon="account" />}
                    />
                    <TextInput
                      label="Phone Number"
                      value={phone}
                      onChangeText={setPhone}
                      style={styles.input}
                      mode="outlined"
                      keyboardType="phone-pad"
                      placeholder="+1234567890"
                      left={<TextInput.Icon icon="phone" />}
                    />
                  </>
                )}
                
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="email" />}
                />
                
                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  left={<TextInput.Icon icon="lock" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                />
                
                <Button
                  mode="contained"
                  onPress={handleAuth}
                  style={styles.authButton}
                  contentStyle={styles.authButtonContent}
                  disabled={loading}
                  loading={loading}
                >
                  {loading ? '' : isSignUp ? 'Sign Up' : 'Sign In'}
                </Button>
                
                <Button
                  mode="text"
                  onPress={toggleMode}
                  style={styles.toggleButton}
                  disabled={loading}
                >
                  {isSignUp
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Sign Up"}
                </Button>
              </Card.Content>
            </Card>

            {/* Features */}
            <View style={styles.features}>
              <View style={styles.feature}>
                <Text style={styles.featureIcon}>🔔</Text>
                <Text style={styles.featureText}>Smart Notifications</Text>
              </View>
              <View style={styles.feature}>
                <Text style={styles.featureIcon}>👥</Text>
                <Text style={styles.featureText}>Contact Management</Text>
              </View>
              <View style={styles.feature}>
                <Text style={styles.featureIcon}>⏰</Text>
                <Text style={styles.featureText}>Custom Check-ins</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
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
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  card: {
    borderRadius: 20,
    marginBottom: 30,
  },
  cardContent: {
    padding: 24,
  },
  formTitle: {
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
  },
  authButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 25,
  },
  authButtonContent: {
    paddingVertical: 8,
  },
  toggleButton: {
    marginTop: 8,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  featureText: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  snackbar: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
}); 