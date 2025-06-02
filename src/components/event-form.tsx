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
  const [missedCheckinThreshold, setMissedCheckinThreshold] = useState(2);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (event) {
      console.log('Loading event data:', {
        eventId: event.id,
        eventName: event.name,
        checkInFrequency: (event as any).check_in_frequency,
        maxInactivityTime: event.max_inactivity_time,
        eventContacts: event.contacts,
        eventContactsType: typeof event.contacts,
        eventContactsLength: Array.isArray(event.contacts) ? event.contacts.length : 'not array'
      });
      
      // Parse the check_in_frequency - handle both text and PostgreSQL interval formats
      let parsedValue = "1";
      let parsedUnit = "day";
      
      const intervalToCheck = (event as any).check_in_frequency || event.max_inactivity_time;
      
      if (intervalToCheck) {
        // Handle PostgreSQL interval format like "00:05:00" (HH:MM:SS)
        const timeMatch = intervalToCheck.match(/^(\d{2}):(\d{2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          
          if (hours > 0) {
            parsedValue = hours.toString();
            parsedUnit = "hour";
          } else if (minutes > 0) {
            parsedValue = minutes.toString();
            parsedUnit = "minute";
          } else if (seconds > 0) {
            parsedValue = seconds.toString();
            parsedUnit = "second";
          }
        } else {
          // Handle text format like "1 day", "2 weeks", etc.
          const match = intervalToCheck.match(/^(\d+)\s+(\w+)$/);
          if (match) {
            parsedValue = match[1];
            parsedUnit = match[2].endsWith("s") ? match[2].slice(0, -1) : match[2];
          }
        }
      }
      
      setInactivityValue(parsedValue);
      setInactivityUnit(parsedUnit);

      // Set missed check-in threshold (default to 2 if not available)
      setMissedCheckinThreshold((event as any).missed_checkin_threshold || 2);

      // Set selected contacts
      const contactIds = (event.contacts as { id: string }[]).map((c) => c.id);
      console.log('Setting selected contacts:', contactIds);
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
      
      console.log('Form submission data:', {
        inactivityValue,
        inactivityUnit,
        maxInactivityTime,
        eventId: event?.id,
        isEditing: !!event
      });

      if (event) {
        // Update existing event
        const updateData: any = {
          name,
          memo,
          notification_content: notificationContent,
          check_in_frequency: maxInactivityTime,
          updated_at: new Date().toISOString(),
          contacts: [], // Maintain empty array for the contacts column
        };
        
        // Only include missed_checkin_threshold if the column exists
        try {
          updateData.missed_checkin_threshold = missedCheckinThreshold;
        } catch (e) {
          console.log('missed_checkin_threshold column not available yet');
        }

        const { error: updateError } = await supabase
          .from("events")
          .update(updateData)
          .eq("id", event.id);

        if (updateError) throw updateError;

        // Update event_contacts safely - remove contacts not selected
        if (selectedContacts.length > 0) {
          const { error: deleteError } = await supabase
            .from("event_contacts")
            .delete()
            .eq("event_id", event.id)
            .not("contact_id", "in", `(${selectedContacts.join(",")})`);

          if (deleteError) throw deleteError;
        } else {
          // If no contacts selected, delete all
          const { error: deleteAllError } = await supabase
            .from("event_contacts")
            .delete()
            .eq("event_id", event.id);

          if (deleteAllError) throw deleteAllError;
        }

        // Add new contacts (ignore duplicates with ON CONFLICT DO NOTHING)
        if (selectedContacts.length > 0) {
          const eventContactsToInsert = selectedContacts.map(contactId => ({
            event_id: event.id,
            contact_id: contactId
          }));

          // Use upsert to handle duplicates gracefully
          const { error: insertError } = await supabase
            .from("event_contacts")
            .upsert(eventContactsToInsert, { 
              onConflict: 'event_id,contact_id',
              ignoreDuplicates: true 
            });

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
        const insertData: any = {
          user_id: userId,
          name,
          memo,
          notification_content: notificationContent,
          check_in_frequency: maxInactivityTime,
          last_check_in: new Date().toISOString(),
          status: "running",
          contacts: [], // Add default empty array for the contacts column
        };
        
        // Only include missed_checkin_threshold if the column exists
        try {
          insertData.missed_checkin_threshold = missedCheckinThreshold;
        } catch (e) {
          console.log('missed_checkin_threshold column not available yet');
        }

        const { data: newEvent, error: createError } = await supabase
          .from("events")
          .insert(insertData)
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
          <DialogDescription asChild>
            <div className="space-y-2">
              <div>
                {event
                  ? "Update your check-in details below."
                  : "Set up a new check-in to monitor your activity."}
              </div>
              <div className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="font-medium text-blue-900 mb-1">How it works:</div>
                <ul className="space-y-1 text-blue-800">
                  <li>• You'll need to check in at your specified frequency</li>
                  <li>• If you miss check-ins, contacts will be automatically notified</li>
                  <li>• Use your mobile app or web dashboard to check in quickly</li>
                </ul>
              </div>
            </div>
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
            <p className="text-xs text-muted-foreground">
              How often you need to check in to confirm you're safe
            </p>
            <p className="text-xs text-blue-600">
              Current: {inactivityValue} {inactivityUnit}{parseInt(inactivityValue) > 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="threshold">Alert Trigger</Label>
            <Select 
              value={missedCheckinThreshold.toString()} 
              onValueChange={(value) => setMissedCheckinThreshold(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select threshold" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">After 1 missed check-in</SelectItem>
                <SelectItem value="2">After 2 missed check-ins in a row</SelectItem>
                <SelectItem value="3">After 3 missed check-ins in a row</SelectItem>
                <SelectItem value="4">After 4 missed check-ins in a row</SelectItem>
                <SelectItem value="5">After 5 missed check-ins in a row</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Contacts will be notified after this many consecutive missed check-ins
            </p>
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
