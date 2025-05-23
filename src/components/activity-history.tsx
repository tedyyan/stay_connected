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
import { supabase } from "../supabase/supabase";
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

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("activity_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        setLogs(data || []);
        setFilteredLogs(data || []);
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
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
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
  }, [userId]);

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
    const eventName = details?.event_name || "Unknown event";
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
        return `Paused check-in "${eventName}"`;
      case "resume_event":
        return `Resumed check-in "${eventName}"`;
      case "scheduled_check":
        return `System performed scheduled inactivity check${result}`;
      default:
        return log.action.replace(/_/g, " ");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        <CardDescription>Recent activity and check-ins</CardDescription>
        <div className="mt-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search activities..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">Loading activity history...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              {searchTerm
                ? "No matching activities found"
                : "No activity history yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 pb-3 border-b last:border-0"
              >
                <div className="mt-0.5">{getActionIcon(log.action)}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {getActionDescription(log)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(log.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
