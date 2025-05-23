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
import { Mail, Phone, Edit, Trash2, Globe } from "lucide-react";
import { supabase } from "../supabase/supabase";
import { Database } from "@/types/database.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface ContactsListProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
}

export default function ContactsList({ contacts, onEdit }: ContactsListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (contact: Contact) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ deleted: true })
        .eq("id", contactToDelete.id);

      if (error) throw error;

      // Log the activity
      await supabase.from("activity_logs").insert({
        user_id: contactToDelete.user_id,
        action: "delete_contact",
        details: { contact_name: contactToDelete.name },
      });
    } catch (error) {
      console.error("Error deleting contact:", error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  const handleSendTestNotification = async (contact: Contact, type: string) => {
    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "src-supabase-functions-test-notifications",
        {
          body: { contactId: contact.id, notificationType: type },
        },
      );

      if (error) throw error;

      // Show success/error messages
      if (type === "email" || type === "both") {
        if (data.results.email.sent) {
          toast({
            title: "Email Sent",
            description: `Test email sent to ${contact.name}`,
          });
        } else {
          toast({
            title: "Email Failed",
            description: data.results.email.error || "Unknown error",
            variant: "destructive",
          });
        }
      }

      if (type === "sms" || type === "both") {
        if (data.results.sms.sent) {
          toast({
            title: "SMS Sent",
            description: `Test SMS sent to ${contact.name}`,
          });
        } else {
          toast({
            title: "SMS Failed",
            description: data.results.sms.error || "Unknown error",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast({
        title: "Error",
        description: `Failed to send test notification: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {contacts.map((contact) => (
        <Card key={contact.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle>{contact.name}</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(contact)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteClick(contact)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {contact.email && (
              <div className="flex items-center text-sm">
                <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center text-sm">
                <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.social_media &&
              Object.keys(contact.social_media).length > 0 && (
                <div className="flex items-center text-sm">
                  <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Social media accounts available</span>
                </div>
              )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this contact? This action cannot
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
