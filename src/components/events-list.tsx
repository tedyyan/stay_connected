"use client";

import { useState } from "react";
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
              <Button
                className="w-full"
                onClick={() => onCheckIn(event.id)}
                disabled={isLoading || event.status === "paused"}
              >
                {isLoading ? "Checking in..." : "I'm Here"}
              </Button>
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
