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
import { createClient } from "../supabase/client";
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
  const supabase = createClient();

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

      if (event) {
        // Update existing event
        const { error: updateError } = await supabase
          .from("events")
          .update({
            name,
            memo,
            notification_content: notificationContent,
            max_inactivity_time: maxInactivityTime,
            updated_at: new Date().toISOString(),
            contacts: [], // Maintain empty array for the contacts column
          })
          .eq("id", event.id);

        if (updateError) throw updateError;

        // Update event_contacts
        // First, delete existing associations
        const { error: deleteError } = await supabase
          .from("event_contacts")
          .delete()
          .eq("event_id", event.id);

        if (deleteError) throw deleteError;

        // Then, create new associations
        if (selectedContacts.length > 0) {
          const eventContactsToInsert = selectedContacts.map(contactId => ({
            event_id: event.id,
            contact_id: contactId
          }));

          const { error: insertError } = await supabase
            .from("event_contacts")
            .insert(eventContactsToInsert);

          if (insertError) throw insertError;
        }

        // Log the activity
        await supabase.from("activity_logs").insert({
          user_id: userId,
          event_id: event.id,
          action: "update_event",
          details: { event_name: name },
        });
      } else {
        // Create new event
        console.log('Creating new event with user_id:', userId);
        const { data: newEvent, error: createError } = await supabase
          .from("events")
          .insert({
            user_id: userId,
            name,
            memo,
            notification_content: notificationContent,
            max_inactivity_time: maxInactivityTime,
            last_check_in: new Date().toISOString(),
            status: "running",
            contacts: [], // Add default empty array for the contacts column
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating event:', createError);
          throw createError;
        }

        console.log('Event created successfully:', newEvent);

        // Create event_contacts associations
        if (selectedContacts.length > 0 && newEvent) {
          const eventContactsToInsert = selectedContacts.map(contactId => ({
            event_id: newEvent.id,
            contact_id: contactId
          }));

          const { error: contactsError } = await supabase
            .from("event_contacts")
            .insert(eventContactsToInsert);

          if (contactsError) {
            console.error('Error creating event_contacts:', contactsError);
            throw contactsError;
          }
        }

        // Log the activity
        if (newEvent) {
          await supabase.from("activity_logs").insert({
            user_id: userId,
            event_id: newEvent.id,
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
