"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "../supabase/supabase";
import { Database } from "@/types/database.types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface EventFormProps {
  onClose: () => void;
  event: Event | null;
  contacts: Contact[];
  userId: string;
}

export default function EventForm({
  onClose,
  event,
  contacts,
  userId,
}: EventFormProps) {
  const [name, setName] = useState(event?.name || "");
  const [memo, setMemo] = useState(event?.memo || "");
  const [notificationContent, setNotificationContent] = useState(
    event?.notification_content || "",
  );
  const [inactivityValue, setInactivityValue] = useState("1");
  const [inactivityUnit, setInactivityUnit] = useState("day");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (event) {
      // Parse the max_inactivity_time (e.g., "1 day", "2 weeks")
      const match = event.max_inactivity_time.match(/^(\d+)\s+(\w+)$/);
      if (match) {
        setInactivityValue(match[1]);
        setInactivityUnit(
          match[2].endsWith("s") ? match[2].slice(0, -1) : match[2],
        );
      }

      // Set selected contacts
      const contactIds = (event.contacts as { id: string }[]).map((c) => c.id);
      setSelectedContacts(contactIds);
    }
  }, [event]);

  const handleSubmit = async () => {
    setFormError("");

    if (!name) {
      setFormError("Name is required");
      return;
    }

    if (selectedContacts.length === 0) {
      setFormError("At least one contact is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const maxInactivityTime = `${inactivityValue} ${inactivityUnit}${parseInt(inactivityValue) > 1 ? "s" : ""}`;
      const contactsArray = selectedContacts.map((id) => ({ id }));

      if (event) {
        // Update existing event
        const { error } = await supabase
          .from("events")
          .update({
            name,
            memo,
            notification_content: notificationContent,
            max_inactivity_time: maxInactivityTime,
            contacts: contactsArray,
            updated_at: new Date().toISOString(),
          })
          .eq("id", event.id);

        if (error) throw error;

        // Log the activity
        await supabase.from("activity_logs").insert({
          user_id: userId,
          event_id: event.id,
          action: "update_event",
          details: { event_name: name },
        });
      } else {
        // Create new event
        const { data, error } = await supabase
          .from("events")
          .insert({
            user_id: userId,
            name,
            memo,
            notification_content: notificationContent,
            max_inactivity_time: maxInactivityTime,
            contacts: contactsArray,
            last_check_in: new Date().toISOString(),
            status: "running",
          })
          .select();

        if (error) throw error;

        // Log the activity
        if (data && data[0]) {
          await supabase.from("activity_logs").insert({
            user_id: userId,
            event_id: data[0].id,
            action: "create_event",
            details: { event_name: name },
          });
        }
      }

      onClose();
    } catch (error: any) {
      console.error("Error saving event:", error);
      setFormError(error.message || "An error occurred while saving the event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{event ? "Edit" : "Create"} Check-In</DialogTitle>
          <DialogDescription>
            {event
              ? "Update your check-in details below."
              : "Set up a new check-in to monitor your activity."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily Check-In"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="memo">Description (Optional)</Label>
            <Textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Brief description of this check-in"
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label>Check-In Frequency</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                value={inactivityValue}
                onChange={(e) => setInactivityValue(e.target.value)}
                className="w-20"
              />
              <Select value={inactivityUnit} onValueChange={setInactivityUnit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minute">Minute(s)</SelectItem>
                  <SelectItem value="hour">Hour(s)</SelectItem>
                  <SelectItem value="day">Day(s)</SelectItem>
                  <SelectItem value="week">Week(s)</SelectItem>
                  <SelectItem value="month">Month(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notification">
              Notification Message (Optional)
            </Label>
            <Textarea
              id="notification"
              value={notificationContent}
              onChange={(e) => setNotificationContent(e.target.value)}
              placeholder="Custom message to send when check-in is missed"
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>Contacts to Notify</Label>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts available. Please add contacts first.
              </p>
            ) : (
              <div className="grid gap-2 max-h-[200px] overflow-y-auto p-2 border rounded-md">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`contact-${contact.id}`}
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => handleContactToggle(contact.id)}
                    />
                    <Label
                      htmlFor={`contact-${contact.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {contact.name} {contact.email ? `(${contact.email})` : ""}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {formError && (
            <p className="text-sm font-medium text-red-500">{formError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || contacts.length === 0}
          >
            {isSubmitting ? "Saving..." : event ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
