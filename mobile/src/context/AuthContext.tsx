import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { pushNotificationService } from '../lib/pushNotifications';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Register push notifications if user is logged in
      if (session?.user) {
        registerPushNotifications(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Register push notifications on sign in
      if (session?.user) {
        registerPushNotifications(session.user.id);
      }
    });

    // Set up notification listeners
    const notificationSubscriptions = pushNotificationService.addNotificationListeners();

    return () => {
      subscription.unsubscribe();
      pushNotificationService.removeNotificationListeners(notificationSubscriptions);
    };
  }, []);

  const registerPushNotifications = async (userId: string) => {
    try {
      console.log('Registering push notifications for user:', userId);
      const token = await pushNotificationService.registerForPushNotificationsAsync();
      if (token) {
        console.log('Push token received, storing...');
        try {
          await pushNotificationService.storePushToken(token, userId);
          console.log('Push notifications registered successfully');
        } catch (storageError) {
          // If storage fails (e.g., table doesn't exist), just log it but don't crash
          console.log('Push token storage failed - this is optional functionality');
          console.log('You can create the user_push_tokens table to enable push notifications');
        }
      } else {
        console.log('No push token received - likely running on simulator or permissions denied');
      }
    } catch (error) {
      // Provide better error logging but don't crash
      console.log('Push notifications registration skipped due to error - this is optional functionality');
      
      // Push notifications are not critical for app functionality
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 