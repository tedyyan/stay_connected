import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationService {
  registerForPushNotificationsAsync: () => Promise<string | null>;
  storePushToken: (token: string, userId: string) => Promise<void>;
  scheduleNotification: (title: string, body: string, data?: any) => Promise<void>;
}

class PushNotificationServiceImpl implements PushNotificationService {
  async registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }
      
      try {
        // Get project ID from Expo config
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_PROJECT_ID;
        
        let tokenData;
        if (projectId) {
          console.log('Using project ID:', projectId);
          tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId,
          });
        } else {
          // For development, try without project ID
          console.log('No project ID found, attempting to get token without it...');
          tokenData = await Notifications.getExpoPushTokenAsync();
        }
        
        token = tokenData.data;
        console.log('Expo Push Token:', token);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error getting push token';
        console.error('Error getting push token:', errorMessage);
        
        // Try without project ID if the first attempt failed
        try {
          console.log('Retrying without project ID...');
          const tokenData = await Notifications.getExpoPushTokenAsync();
          token = tokenData.data;
          console.log('Expo Push Token (retry):', token);
        } catch (retryError) {
          const retryErrorMessage = retryError instanceof Error ? retryError.message : 'Unknown retry error';
          console.error('Failed to get push token on retry:', retryErrorMessage);
          return null;
        }
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  async storePushToken(token: string, userId: string): Promise<void> {
    try {
      console.log('Storing push token for user:', userId);
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform'
        });

      if (error) {
        const errorMessage = `Database error storing push token: ${error.message || 'Unknown database error'}`;
        console.error('Error storing push token:', errorMessage);
        console.error('Full error object:', error);
        throw new Error(errorMessage);
      }
      
      console.log('Push token stored successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error storing push token';
      console.error('Failed to store push token:', errorMessage);
      if (error instanceof Error && error.stack) {
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  async scheduleNotification(title: string, body: string, data?: any): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // For immediate notification
    });
  }

  // Add notification listeners
  addNotificationListeners() {
    // Handle notifications when app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });

    // Handle notification response (when user taps the notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle navigation or actions based on notification data
      const data = response.notification.request.content.data;
      if (data?.eventId) {
        // Navigate to specific event or screen
        console.log('Navigate to event:', data.eventId);
      }
    });

    return {
      foregroundSubscription,
      responseSubscription,
    };
  }

  removeNotificationListeners(subscriptions: any) {
    if (subscriptions.foregroundSubscription) {
      Notifications.removeNotificationSubscription(subscriptions.foregroundSubscription);
    }
    if (subscriptions.responseSubscription) {
      Notifications.removeNotificationSubscription(subscriptions.responseSubscription);
    }
  }
}

export const pushNotificationService = new PushNotificationServiceImpl(); 