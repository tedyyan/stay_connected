"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "../supabase/client";
import { Database } from "@/types/database.types";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Search,
  CheckCircle,
  Bell,
  UserPlus,
  Edit,
  Trash2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];

interface ActivityHistoryProps {
  userId: string;
}

export default function ActivityHistory({ userId }: ActivityHistoryProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [events, setEvents] = useState<Database["public"]["Tables"]["events"]["Row"][]>([]);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching logs for user:', userId);
        
        // First get the user's event IDs
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .eq('user_id', userId)
          .eq('deleted', false);

        if (eventsError) {
          console.error('Error fetching events:', eventsError);
          throw eventsError;
        }
        
        console.log('Events query result:', eventsData);
        const eventIds = eventsData?.map(e => e.id) || [];
        console.log('Found event IDs:', eventIds);
        
        // Then get activity logs
        let query = supabase
          .from("activity_logs")
          .select(`
            *,
            events:events(name)
          `)
          .order("created_at", { ascending: false })
          .limit(100);

        if (eventIds.length > 0) {
          const filter = `user_id.eq.${userId},event_id.in.(${eventIds.join(',')})`;
          console.log('Using filter:', filter);
          query = query.or(filter);
        } else {
          console.log('No events found, only querying user activities');
          query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching logs:', error);
          throw error;
        }
        console.log('Activity logs query result:', { data, error });
        setLogs(data || []);
        setFilteredLogs(data || []);
        setEvents(eventsData || []);
      } catch (error) {
        console.error("Error fetching activity logs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel("activity-logs-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `user_id.eq.${userId}`,
        },
        (payload) => {
          console.log('Received new activity log (user):', payload.new);
          setLogs((prev) => [payload.new as ActivityLog, ...prev]);
          setFilteredLogs((prev) => {
            const newLogs = [payload.new as ActivityLog, ...prev];
            if (searchTerm) {
              return filterLogs(newLogs, searchTerm);
            }
            return newLogs;
          });
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, searchTerm]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredLogs(filterLogs(logs, searchTerm));
    } else {
      setFilteredLogs(logs);
    }
  }, [searchTerm, logs]);

  const filterLogs = (logs: ActivityLog[], term: string) => {
    const lowerTerm = term.toLowerCase();
    return logs.filter((log) => {
      const details = log.details as Record<string, any> | null;
      const eventName = details?.event_name?.toLowerCase() || "";
      const contactName = details?.contact_name?.toLowerCase() || "";
      const action = log.action.toLowerCase();

      return (
        eventName.includes(lowerTerm) ||
        contactName.includes(lowerTerm) ||
        action.includes(lowerTerm)
      );
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "check_in":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "create_event":
        return <Bell className="h-4 w-4 text-blue-500" />;
      case "update_event":
        return <Edit className="h-4 w-4 text-amber-500" />;
      case "delete_event":
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case "create_contact":
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case "update_contact":
        return <Edit className="h-4 w-4 text-amber-500" />;
      case "delete_contact":
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case "pause_event":
        return <PauseCircle className="h-4 w-4 text-amber-500" />;
      case "resume_event":
        return <PlayCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionDescription = (log: ActivityLog) => {
    const details = log.details as Record<string, any> | null;
    const eventData = (log as any).events;
    const eventName = eventData?.name || details?.event_name || "Unknown event";
    const contactName = details?.contact_name || "Unknown contact";
    const result = details?.result
      ? ` (${details.result.processed?.length || 0} events processed)`
      : "";

    switch (log.action) {
      case "check_in":
        return `Checked in to "${eventName}"`;
      case "create_event":
        return `Created new check-in "${eventName}"`;
      case "update_event":
        return `Updated check-in "${eventName}"`;
      case "delete_event":
        return `Deleted check-in "${eventName}"`;
      case "create_contact":
        return `Added new contact "${contactName}"`;
      case "update_contact":
        return `Updated contact "${contactName}"`;
      case "delete_contact":
        return `Deleted contact "${contactName}"`;
      case "pause_event":
        return `Paused event "${eventName}"`;
      case "resume_event":
        return `Resumed event "${eventName}"`;
      default:
        return `Unknown action`;
    }
  };

  if (!mounted) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>Track your recent activities and check-ins</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        <CardDescription>Track your recent activities and check-ins</CardDescription>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start space-x-3 border-b border-gray-100 pb-4 last:border-0"
              >
                <div className="mt-1">{getActionIcon(log.action)}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{getActionDescription(log)}</p>
                  <p className="text-xs text-gray-500" suppressHydrationWarning>
                    {formatDistanceToNow(parseISO(log.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No activity logs found
          </div>
        )}
      </CardContent>
    </Card>
  );
}