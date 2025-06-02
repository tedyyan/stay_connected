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
        .update({ deleted: true })
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

  const handleNotifyMyself = async (event: Event) => {
    setIsNotifying(prev => ({ ...prev, [event.id]: true }));
    try {
      console.log('Client: Starting self notification process');
      
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
          description: "Please sign in to send notifications to yourself.",
          variant: "destructive",
        });
        router.push('/sign-in');
        return;
      }

      console.log('Client: Making API request for self notification, event:', event.id);
      const response = await fetch('/api/notify-myself', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId: event.id }),
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
        throw new Error(errorData.error || 'Failed to send notification');
      }

      const data = await response.json();
      console.log('Client: API response data:', data);
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send notification');
      }

      console.log('Client: Self notification successful');

      toast({
        title: "✅ Check-in Reminder Sent",
        description: `Reminder sent to your email and phone for "${event.name}".`,
        variant: "default",
        duration: 5000,
      });

      // Update the UI to show the notification was sent
      const { error: logError } = await supabase
        .from("activity_logs")
        .insert({
          user_id: user.id,
          event_id: event.id,
          action: "self_notification_sent",
          details: {
            event_name: event.name,
            notification_type: "self_reminder"
          },
        });

      if (logError) {
        console.error('Error logging notification activity:', logError);
      }
    } catch (error) {
      console.error("Client: Error in self notification process:", error);
      toast({
        title: "Failed to send reminder",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsNotifying(prev => ({ ...prev, [event.id]: false }));
    }
  };

  // Helper function to parse PostgreSQL interval to milliseconds
  const parseInterval = (interval: string | null | undefined): number => {
    // Handle null/undefined intervals
    if (!interval) return 60 * 60 * 1000; // Default to 1 hour
    
    // Handle PostgreSQL interval format like "00:05:00" (HH:MM:SS)
    const timeMatch = interval.match(/^(\d{2}):(\d{2}):(\d{2})$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseInt(timeMatch[3], 10);
      return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
    }

    // Handle text format like '1 week', '2 days', etc.
    const match = interval.match(/^(\d+)\s+(\w+)$/);
    if (!match) return 60 * 60 * 1000; // Default to 1 hour

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
      return { status: "triggered", label: "TRIGGERED", color: "bg-red-500" };
    }

    if (event.status === "deleted" || event.deleted) {
      return { status: "deleted", label: "Deleted", color: "bg-gray-500" };
    }

    const lastCheckIn = parseISO(event.last_check_in);
    const now = new Date();
    
    // Calculate time since last check-in
    const timeSinceLastCheckIn = now.getTime() - lastCheckIn.getTime();
    
    // Use check_in_frequency instead of max_inactivity_time
    const checkInFrequencyMs = parseInterval((event as any).check_in_frequency || event.max_inactivity_time);
    
    // Calculate next check-in due time for display
    const nextCheckInDue = new Date(lastCheckIn.getTime() + checkInFrequencyMs);
    const timeUntilNextCheckIn = nextCheckInDue.getTime() - now.getTime();
    
    // For progress bar, use check_in_frequency
    const totalDuration = checkInFrequencyMs;
    const elapsed = timeSinceLastCheckIn;
    const percentElapsed = Math.min(100, Math.floor((elapsed / totalDuration) * 100));

    // Check if overdue
    if (timeUntilNextCheckIn <= 0) {
      const overdueDuration = Math.abs(timeUntilNextCheckIn);
      
      // Format overdue time appropriately
      const overdueHours = Math.floor(overdueDuration / (1000 * 60 * 60));
      const overdueMinutes = Math.floor((overdueDuration % (1000 * 60 * 60)) / (1000 * 60));
      
      let overdueLabel = "";
      if (overdueHours > 0) {
        overdueLabel = `OVERDUE by ${overdueHours}h`;
        if (overdueMinutes > 0) {
          overdueLabel += ` ${overdueMinutes}m`;
        }
      } else {
        overdueLabel = `OVERDUE by ${overdueMinutes}m`;
      }
      
      return {
        status: "overdue",
        label: overdueLabel,
        color: "bg-red-500",
        percent: percentElapsed,
      };
    }
    
    // Calculate time until due
    const hoursUntilDue = Math.floor(timeUntilNextCheckIn / (1000 * 60 * 60));
    const minutesUntilDue = Math.floor((timeUntilNextCheckIn % (1000 * 60 * 60)) / (1000 * 60));
    
    // Show different colors based on urgency
    let color = "bg-green-500";
    let label = "";
    
    if (hoursUntilDue <= 0 && minutesUntilDue > 0) {
      // Less than an hour
      label = `Due in ${minutesUntilDue}m`;
      color = "bg-yellow-500";
    } else if (hoursUntilDue < 1 && minutesUntilDue <= 0) {
      // Less than a minute
      const secondsUntilDue = Math.floor((timeUntilNextCheckIn % (1000 * 60)) / 1000);
      label = `Due in ${secondsUntilDue}s`;
      color = "bg-red-400";
    } else if (hoursUntilDue <= 24) {
      // Less than 24 hours
      if (hoursUntilDue === 0) {
        label = `Due in ${minutesUntilDue}m`;
      } else if (minutesUntilDue > 0) {
        label = `Due in ${hoursUntilDue}h ${minutesUntilDue}m`;
      } else {
        label = `Due in ${hoursUntilDue}h`;
      }
      color = hoursUntilDue <= 6 ? "bg-yellow-500" : "bg-green-500";
    } else {
      // More than 24 hours
      const daysUntilDue = Math.floor(hoursUntilDue / 24);
      const remainingHours = hoursUntilDue % 24;
      
      if (daysUntilDue >= 1) {
        label = remainingHours > 0 
          ? `Due in ${daysUntilDue}d ${remainingHours}h`
          : `Due in ${daysUntilDue}d`;
      } else {
        label = `Due in ${hoursUntilDue}h`;
      }
      color = "bg-green-500";
    }

    return {
      status: "active",
      label: label,
      color: color,
      percent: percentElapsed,
    };
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
        const checkInFrequencyMs = parseInterval((event as any).check_in_frequency || event.max_inactivity_time);
        const triggerTime = addMilliseconds(lastCheckIn, checkInFrequencyMs);

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
                            : eventStatus.status === "overdue"
                              ? "destructive"
                              : eventStatus.color === "bg-yellow-500"
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
                      {(event as any).check_in_frequency || event.max_inactivity_time || 'Not set'}
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
                  onClick={() => handleNotifyMyself(event)}
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
                      Notify Myself
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
