"use client";

import { useState, useEffect } from "react";
import { createClient } from "../supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface NotificationLog {
  id: string;
  event_id: string;
  notification_type: 'email' | 'sms' | 'push';
  recipient: string;
  content: string;
  status: 'pending' | 'sent' | 'failed';
  notification_category: 'user_reminder' | 'contact_alert';
  sent_at: string;
  error_message?: string;
  events?: {
    name: string;
  };
}

interface NotificationHistoryProps {
  userId: string;
}

export default function NotificationHistory({ userId }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch notifications for events owned by this user
      const { data, error } = await supabase
        .from('notification_logs')
        .select(`
          *,
          events!inner (
            name,
            user_id
          )
        `)
        .eq('events.user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'push':
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'user_reminder':
        return 'bg-blue-100 text-blue-800';
      case 'contact_alert':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>Loading your notification history...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>Error loading notification history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-center py-4">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
          <CardDescription>
            View all notifications sent for your check-ins and alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications sent yet. Notifications will appear here once your check-ins start sending reminders or alerts.
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getNotificationIcon(notification.notification_type)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={getCategoryColor(notification.notification_category)}>
                            {notification.notification_category === 'user_reminder' ? 'User Reminder' : 'Contact Alert'}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(notification.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(notification.status)}
                              {notification.status.charAt(0).toUpperCase() + notification.status.slice(1)}
                            </span>
                          </Badge>
                          <Badge variant="outline">
                            {notification.notification_type.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div>
                          <p className="font-medium text-sm">
                            Event: {notification.events?.name || 'Unknown Event'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            To: {notification.recipient}
                          </p>
                        </div>
                        
                        <div className="bg-gray-50 rounded p-3">
                          <p className="text-sm">{notification.content}</p>
                        </div>
                        
                        {notification.error_message && (
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <p className="text-sm text-red-700">
                              <strong>Error:</strong> {notification.error_message}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Sent: {format(new Date(notification.sent_at), 'MMM d, yyyy h:mm a')}
                          </span>
                          <span>
                            ({formatDistanceToNow(new Date(notification.sent_at), { addSuffix: true })})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 