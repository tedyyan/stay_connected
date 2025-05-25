"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Bell,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { supabase } from "../supabase/supabase";
import { Database } from "@/types/database.types";
import { formatDistanceToNow, parseISO, addMilliseconds } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { User } from '@supabase/supabase-js';

type Event = Database["public"]["Tables"]["events"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface EventsListProps {
  events: Event[];
  contacts: Contact[];
  onCheckIn: (eventId: string) => void;
  onEdit: (event: Event) => void;
  isLoading: boolean;
}

export default function EventsList({
  events,
  contacts,
  onCheckIn,
  onEdit,
  isLoading,
}: EventsListProps) {
  const [mounted, setMounted] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNotifying, setIsNotifying] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleDeleteClick = (event: Event) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ deleted: true, status: "deleted" })
        .eq("id", eventToDelete.id);

      if (error) throw error;

      // Log the activity
      await supabase.from("activity_logs").insert({
        user_id: eventToDelete.user_id,
        event_id: eventToDelete.id,
        action: "delete_event",
        details: { event_name: eventToDelete.name },
      });
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  const handleTogglePause = async (event: Event) => {
    const newStatus = event.status === "paused" ? "running" : "paused";

    try {
      const { error } = await supabase
        .from("events")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      if (error) throw error;

      // Log the activity
      await supabase.from("activity_logs").insert({
        user_id: event.user_id,
        event_id: event.id,
        action: newStatus === "paused" ? "pause_event" : "resume_event",
        details: { event_name: event.name },
      });
    } catch (error) {
      console.error(
        `Error ${newStatus === "paused" ? "pausing" : "resuming"} event:`,
        error,
      );
    }
  };

  const handleNotifyContacts = async (event: Event) => {
    setIsNotifying(prev => ({ ...prev, [event.id]: true }));
    try {
      console.log('Client: Starting notification process');
      
      // Check if user is signed in
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Client: Auth check result:', { 
        hasUser: !!user, 
        error: userError?.message,
        userId: user?.id 
      });
      
      if (!user) {
        console.log('Client: No user found, redirecting to sign in');
        toast({
          title: "Authentication Required",
          description: "Please sign in to notify contacts.",
          variant: "destructive",
        });
        router.push('/sign-in');
        return;
      }

      console.log('Client: Making API request for event:', event.id);
      const response = await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventIds: [event.id], force: true }),
        credentials: 'include',
      });

      console.log('Client: API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Client: API error:', errorData);
        if (response.status === 401) {
          setUser(null);
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please sign in again.",
            variant: "destructive",
          });
          router.push('/sign-in');
          return;
        }
        throw new Error(errorData.error || 'Failed to process notification request');
      }

      const data = await response.json();
      console.log('Client: API response data:', data);
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to process notification request');
      }

      console.log('Client: Notification successful:', {
        processedCount: data.processed?.length
      });

      toast({
        title: "✅ Notifications Sent Successfully",
        description: `Contacts have been notified for event "${event.name}". ${data.processed?.length || 0} notification${data.processed?.length === 1 ? '' : 's'} processed.`,
        variant: "default",
        duration: 5000, // Show for 5 seconds
      });

      // Update the UI to show the notification was sent
      const { error: logError } = await supabase
        .from("activity_logs")
        .insert({
          user_id: user.id,
          event_id: event.id,
          action: "manual_notification_sent",
          details: {
            event_name: event.name,
            notifications_sent: data.processed?.length
          },
        });

      if (logError) {
        console.error('Error logging notification activity:', logError);
      }
    } catch (error) {
      console.error("Client: Error in notification process:", error);
      toast({
        title: "Failed to notify contacts",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsNotifying(prev => ({ ...prev, [event.id]: false }));
    }
  };

  // Helper function to parse PostgreSQL interval to milliseconds
  const parseInterval = (interval: string): number => {
    // Simple parsing for common formats like '1 week', '2 days', etc.
    const match = interval.match(/^(\d+)\s+(\w+)$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const msPerUnit: Record<string, number> = {
      microsecond: 0.001,
      microseconds: 0.001,
      millisecond: 1,
      milliseconds: 1,
      second: 1000,
      seconds: 1000,
      minute: 60 * 1000,
      minutes: 60 * 1000,
      hour: 60 * 60 * 1000,
      hours: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      months: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
      years: 365 * 24 * 60 * 60 * 1000,
    };

    return value * (msPerUnit[unit] || 0);
  };

  const getEventStatus = (event: Event) => {
    if (event.status === "paused") {
      return { status: "paused", label: "Paused", color: "bg-gray-500" };
    }

    if (event.status === "triggered") {
      return { status: "triggered", label: "Triggered", color: "bg-red-500" };
    }

    if (event.status === "deleted" || event.deleted) {
      return { status: "deleted", label: "Deleted", color: "bg-gray-500" };
    }

    const lastCheckIn = parseISO(event.last_check_in);
    const maxInactivityMs = parseInterval(event.max_inactivity_time);
    const triggerTime = addMilliseconds(lastCheckIn, maxInactivityMs);
    const now = new Date();

    // Calculate percentage of time elapsed
    const totalDuration = maxInactivityMs;
    const elapsed = now.getTime() - lastCheckIn.getTime();
    const percentElapsed = Math.min(
      100,
      Math.floor((elapsed / totalDuration) * 100),
    );

    if (percentElapsed >= 90) {
      return {
        status: "critical",
        label: "Critical",
        color: "bg-red-500",
        percent: percentElapsed,
      };
    } else if (percentElapsed >= 75) {
      return {
        status: "warning",
        label: "Warning",
        color: "bg-yellow-500",
        percent: percentElapsed,
      };
    } else {
      return {
        status: "normal",
        label: "Normal",
        color: "bg-green-500",
        percent: percentElapsed,
      };
    }
  };

  const getContactNames = (contactIds: { id: string }[]) => {
    return contactIds
      .map((c) => {
        const contact = contacts.find((contact) => contact.id === c.id);
        return contact ? contact.name : "Unknown";
      })
      .join(", ");
  };

  if (!mounted) {
    return (
      <div className="space-y-4">
        {events.map((event) => (
          <Card key={event.id} className="overflow-hidden">
            <div className="h-1 bg-gray-200" />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {event.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {event.memo || "No description provided"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const eventStatus = getEventStatus(event);
        const contactsList = getContactNames(
          event.contacts as { id: string }[],
        );
        const lastCheckIn = parseISO(event.last_check_in);
        const maxInactivityMs = parseInterval(event.max_inactivity_time);
        const triggerTime = addMilliseconds(lastCheckIn, maxInactivityMs);

        return (
          <Card key={event.id} className="overflow-hidden">
            <div
              className={`h-1 ${eventStatus.color}`}
              style={{
                width: eventStatus.percent ? `${eventStatus.percent}%` : "100%",
              }}
            />
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {event.name}
                    <Badge
                      variant={
                        event.status === "paused"
                          ? "outline"
                          : event.status === "triggered"
                            ? "destructive"
                            : eventStatus.status === "critical"
                              ? "destructive"
                              : eventStatus.status === "warning"
                                ? "default"
                                : "secondary"
                      }
                    >
                      {eventStatus.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {event.memo || "No description provided"}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTogglePause(event)}
                  >
                    {event.status === "paused" ? (
                      <PlayCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <PauseCircle className="h-4 w-4 text-amber-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(event)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(event)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Check-in frequency:
                    </span>
                    <span className="ml-1 font-medium">
                      {event.max_inactivity_time}
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Bell className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Notifies:</span>
                    <span className="ml-1 font-medium">
                      {contactsList || "No contacts"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <CheckCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Last check-in:
                    </span>
                    <span className="ml-1 font-medium">
                      {formatDistanceToNow(lastCheckIn, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <AlertTriangle className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Next alert:</span>
                    <span className="ml-1 font-medium">
                      {event.status === "paused"
                        ? "Paused"
                        : formatDistanceToNow(triggerTime, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="w-full flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => onCheckIn(event.id)}
                  disabled={isLoading || event.status === "paused"}
                >
                  {isLoading ? "Checking in..." : "I'm Here"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleNotifyContacts(event)}
                  disabled={isNotifying[event.id]}
                >
                  {isNotifying[event.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                      Notifying...
                    </>
                  ) : (
                    <>
                      <Bell className="mr-2 h-4 w-4" />
                      Notify Contacts
                    </>
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        );
      })}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Check-In</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this check-in? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
