"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  Users,
  History,
  Mail,
  Phone,
  Edit,
  Trash2,
  Globe,
} from "lucide-react";
import { createClient } from "../supabase/client";
import EventsList from "@/components/events-list";
import ContactsList from "@/components/contacts-list";
import EventForm from "@/components/event-form";
import ContactForm from "@/components/contact-form";
import ActivityHistory from "@/components/activity-history";
import { Database } from "@/types/database.types";
import { useSearchParams } from "next/navigation";
import NotificationHistory from "./notification-history";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];

interface CheckInDashboardProps {
  initialEvents: Event[];
  initialContacts: Contact[];
  user: User;
}

export default function CheckInDashboard({
  initialEvents,
  initialContacts,
  user,
}: CheckInDashboardProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const supabase = createClient();

  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [activeTab, setActiveTab] = useState(tabParam || "events");
  const [showEventForm, setShowEventForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filter out deleted events for display
  const filteredEvents = events.filter((event) => !event.deleted);

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Subscribe to realtime changes
  useEffect(() => {
    console.log('Setting up realtime subscriptions with initial contacts:', initialContacts);

    try {
      const eventsSubscription = supabase
        .channel("events-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "events" },
          (payload) => {
            if (
              payload.eventType === "INSERT" &&
              payload.new.user_id === user.id
            ) {
              setEvents((prev) => [payload.new as Event, ...prev]);
            } else if (
              payload.eventType === "UPDATE" &&
              payload.new.user_id === user.id
            ) {
              setEvents((prev) =>
                prev.map((event) =>
                  event.id === payload.new.id ? (payload.new as Event) : event,
                ),
              );
            } else if (payload.eventType === "DELETE") {
              setEvents((prev) =>
                prev.filter((event) => event.id !== payload.old.id),
              );
            }
          },
        )
        .subscribe();

      const contactsSubscription = supabase
        .channel("contacts-changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contacts" },
          (payload) => {
            console.log('Contacts realtime update received:', payload);
            
            if (payload.eventType === "INSERT" && payload.new.user_id === user.id) {
              console.log('New contact received:', payload.new);
              if (!payload.new.deleted) {
                setContacts((prev) => {
                  console.log('Current contacts:', prev);
                  const newContacts = [payload.new as Contact, ...prev];
                  console.log('Updated contacts:', newContacts);
                  return newContacts;
                });
              }
            } else if (payload.eventType === "UPDATE" && payload.new.user_id === user.id) {
              setContacts((prev) => {
                if (payload.new.deleted) {
                  return prev.filter((contact) => contact.id !== payload.new.id);
                } else {
                  return prev.map((contact) =>
                    contact.id === payload.new.id ? (payload.new as Contact) : contact
                  );
                }
              });
            }
          },
        )
        .subscribe();

      return () => {
        console.log('Cleaning up subscriptions');
        eventsSubscription.unsubscribe();
        contactsSubscription.unsubscribe();
      };
    } catch (error) {
      console.error("Error setting up realtime subscriptions:", error);
      return () => {};
    }
  }, [user.id]);

  // Debug effect for contacts changes
  useEffect(() => {
    console.log('Contacts state updated:', contacts);
  }, [contacts]);

  const handleCheckIn = async (eventId: string) => {
    setIsLoading(true);
    try {
      console.log('Attempting check-in for event:', eventId);
      
      const { data, error } = await supabase.functions.invoke(
        "check-in",
        {
          body: { eventId },
        },
      );

      console.log('Check-in response:', { data, error });

      if (error) {
        console.error('Check-in function error:', error);
        throw error;
      }

      // Update the local state
      setEvents((prev) =>
        prev.map((event) => {
          if (event.id === eventId) {
            return {
              ...event,
              last_check_in: data.timestamp,
              status: "running",
            };
          }
          return event;
        }),
      );
    } catch (error) {
      console.error("Error checking in:", error);
      console.error("Error details:", {
        name: (error as any)?.name,
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        context: (error as any)?.context || 'No context available'
      });
      
      // Use a more user-friendly error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const formattedError = errorMessage.includes("404")
        ? "The check-in service is currently unavailable. Please try again later."
        : `Error checking in: ${errorMessage}`;

      alert(formattedError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setShowEventForm(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setShowContactForm(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const handleCloseEventForm = async () => {
    setShowEventForm(false);
    setEditingEvent(null);
    
    // Refresh events to get updated contact associations
    try {
      const { data: eventsData } = await supabase
        .from("events")
        .select(`
          *,
          event_contacts (
            contact_id,
            contacts (
              id,
              name,
              email,
              phone
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("deleted", false)
        .order("created_at", { ascending: false });

      // Transform the events data to include contacts in the expected format
      const refreshedEvents = eventsData?.map(event => ({
        ...event,
        contacts: event.event_contacts?.map((ec: any) => ({ id: ec.contacts.id })) || []
      })) || [];
      
      setEvents(refreshedEvents);
    } catch (error) {
      console.error("Error refreshing events:", error);
    }
  };

  const handleCloseContactForm = () => {
    setShowContactForm(false);
    setEditingContact(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Check-In Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your check-ins and manage your safety alerts
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "events" && (
            <Button onClick={handleAddEvent}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Check-In
            </Button>
          )}
          {activeTab === "contacts" && (
            <Button onClick={handleAddContact}>
              <PlusCircle className="mr-2 h-4 w-4" /> New Contact
            </Button>
          )}
        </div>
      </div>

      <Tabs
        defaultValue="events"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-3 md:grid-cols-4 w-full md:w-[600px]">
          <TabsTrigger value="events">
            <Bell className="mr-2 h-4 w-4" /> Check-Ins
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="mr-2 h-4 w-4" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" /> History
          </TabsTrigger>
          <TabsTrigger value="notifications" className="hidden md:flex">
            <Bell className="mr-2 h-4 w-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          {filteredEvents.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Check-Ins Yet</CardTitle>
                <CardDescription>
                  Create your first check-in to start monitoring your activity.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={handleAddEvent}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Create Check-In
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <EventsList
              events={filteredEvents}
              contacts={contacts}
              onCheckIn={handleCheckIn}
              onEdit={handleEditEvent}
              isLoading={isLoading}
            />
          )}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          {contacts.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Contacts Yet</CardTitle>
                <CardDescription>
                  Add contacts who should be notified if you miss a check-in.
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={handleAddContact}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Contact
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <ContactsList contacts={contacts} onEdit={handleEditContact} />
          )}
        </TabsContent>

        <TabsContent value="history">
          <ActivityHistory userId={user.id} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationHistory userId={user.id} />
        </TabsContent>
      </Tabs>

      {showEventForm && (
        <EventForm
          onClose={handleCloseEventForm}
          event={editingEvent}
          contacts={contacts}
          userId={user.id}
        />
      )}

      {showContactForm && (
        <ContactForm
          onClose={handleCloseContactForm}
          contact={editingContact}
          userId={user.id}
        />
      )}
    </div>
  );
}
