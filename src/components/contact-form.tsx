"use client";

import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createClient } from "../supabase/client";
import { Database } from "@/types/database.types";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface ContactFormProps {
  onClose: () => void;
  contact: Contact | null;
  userId: string;
}

export default function ContactForm({
  onClose,
  contact,
  userId,
}: ContactFormProps) {
  const [name, setName] = useState(contact?.name || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [notificationPreference, setNotificationPreference] = useState(
    contact?.notification_preference || "email",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const supabase = createClient();

  const handleSubmit = async () => {
    setFormError("");

    if (!name) {
      setFormError("Name is required");
      return;
    }

    if (!email && !phone) {
      setFormError("Either email or phone is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (contact) {
        // Update existing contact
        const { error } = await supabase
          .from("contacts")
          .update({
            name,
            email,
            phone,
            notification_preference: notificationPreference,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contact.id);

        if (error) throw error;

        // Log the activity
        await supabase.from("activity_logs").insert({
          user_id: userId,
          action: "update_contact",
          details: { contact_name: name },
        });
      } else {
        // Create new contact
        console.log('Creating new contact:', {
          user_id: userId,
          name,
          email,
          phone,
          deleted: false,
          notification_preference: notificationPreference,
        });
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            user_id: userId,
            name,
            email,
            phone,
            deleted: false,
            notification_preference: notificationPreference,
          })
          .select();

        if (error) {
          console.error('Error creating contact:', error);
          throw error;
        }
        console.log('Contact created successfully:', data);

        // Log the activity
        await supabase.from("activity_logs").insert({
          user_id: userId,
          action: "create_contact",
          details: { contact_name: name },
        });
      }

      onClose();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      setFormError(
        error.message || "An error occurred while saving the contact",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit" : "Add"} Contact</DialogTitle>
          <DialogDescription>
            {contact
              ? "Update contact information below."
              : "Add a new contact who will be notified when you miss a check-in."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
            />
          </div>

          <div className="grid gap-2">
            <Label>Preferred Notification Method</Label>
            <RadioGroup
              value={notificationPreference}
              onValueChange={setNotificationPreference}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="notification-email" />
                <Label htmlFor="notification-email" className="font-normal">
                  Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sms" id="notification-sms" />
                <Label htmlFor="notification-sms" className="font-normal">
                  SMS
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="notification-both" />
                <Label htmlFor="notification-both" className="font-normal">
                  Both Email and SMS
                </Label>
              </div>
            </RadioGroup>
          </div>

          {formError && (
            <p className="text-sm font-medium text-red-500">{formError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : contact ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
