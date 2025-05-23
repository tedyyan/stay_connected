"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Users,
  History,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
} from "lucide-react";
import { supabase } from "../supabase/supabase";
import { Database } from "@/types/database.types";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, parseISO } from "date-fns";

type Event = Database["public"]["Tables"]["events"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];
type UserData = Database["public"]["Tables"]["users"]["Row"];

interface AdminDashboardProps {
  user: User;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState<UserData[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [triggeredEvents, setTriggeredEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all users
        const { data: usersData } = await supabase
          .from("users")
          .select("*")
          .order("created_at", { ascending: false });

        if (usersData) setUsers(usersData);

        // Fetch all events
        const { data: eventsData } = await supabase
          .from("events")
          .select("*")
          .eq("deleted", false)
          .order("created_at", { ascending: false });

        if (eventsData) {
          setEvents(eventsData);
          // Filter triggered events
          setTriggeredEvents(
            eventsData.filter((event) => event.status === "triggered"),
          );
        }

        // Fetch all contacts
        const { data: contactsData } = await supabase
          .from("contacts")
          .select("*")
          .eq("deleted", false)
          .order("created_at", { ascending: false });

        if (contactsData) setContacts(contactsData);

        // Fetch all activity logs
        const { data: logsData } = await supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (logsData) setActivityLogs(logsData);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Set up realtime subscriptions
    const usersSubscription = supabase
      .channel("admin-users-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setUsers((prev) => [payload.new as UserData, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === payload.new.id ? (payload.new as UserData) : u,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setUsers((prev) => prev.filter((u) => u.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    const eventsSubscription = supabase
      .channel("admin-events-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setEvents((prev) => [payload.new as Event, ...prev]);
            if ((payload.new as Event).status === "triggered") {
              setTriggeredEvents((prev) => [payload.new as Event, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            setEvents((prev) =>
              prev.map((e) =>
                e.id === payload.new.id ? (payload.new as Event) : e,
              ),
            );
            // Update triggered events list
            if ((payload.new as Event).status === "triggered") {
              setTriggeredEvents((prev) => {
                if (!prev.some((e) => e.id === payload.new.id)) {
                  return [payload.new as Event, ...prev];
                }
                return prev.map((e) =>
                  e.id === payload.new.id ? (payload.new as Event) : e,
                );
              });
            } else {
              setTriggeredEvents((prev) =>
                prev.filter((e) => e.id !== payload.new.id),
              );
            }
          } else if (payload.eventType === "DELETE") {
            setEvents((prev) => prev.filter((e) => e.id !== payload.old.id));
            setTriggeredEvents((prev) =>
              prev.filter((e) => e.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    const logsSubscription = supabase
      .channel("admin-logs-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          setActivityLogs((prev) => [
            payload.new as ActivityLog,
            ...prev.slice(0, 99),
          ]);
        },
      )
      .subscribe();

    return () => {
      usersSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
      logsSubscription.unsubscribe();
    };
  }, []);

  const filterData = (data: any[], term: string) => {
    if (!term) return data;
    const lowerTerm = term.toLowerCase();
    return data.filter((item) => {
      return Object.values(item).some(
        (val) =>
          val !== null &&
          val !== undefined &&
          val.toString().toLowerCase().includes(lowerTerm),
      );
    });
  };

  const filteredUsers = filterData(users, searchTerm);
  const filteredEvents = filterData(events, searchTerm);
  const filteredContacts = filterData(contacts, searchTerm);
  const filteredLogs = filterData(activityLogs, searchTerm);

  const getUserById = (userId: string) => {
    const user = users.find((u) => u.id === userId || u.user_id === userId);
    return user
      ? user.name || user.full_name || user.email || "Unknown User"
      : "Unknown User";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage users, events, and system activity
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full md:w-[800px]">
          <TabsTrigger value="users">
            <Users className="mr-2 h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="events">
            <Bell className="mr-2 h-4 w-4" /> Events
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="mr-2 h-4 w-4" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" /> Activity
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="mr-2 h-4 w-4" /> Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    {searchTerm ? "No matching users found" : "No users found"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.name || user.full_name || "N/A"}
                          </TableCell>
                          <TableCell>{user.email || "N/A"}</TableCell>
                          <TableCell>
                            {user.is_admin ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                User
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.created_at
                              ? formatDistanceToNow(parseISO(user.created_at), {
                                  addSuffix: true,
                                })
                              : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Events</CardTitle>
              <CardDescription>
                View and manage all check-in events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Loading events...</p>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    {searchTerm
                      ? "No matching events found"
                      : "No events found"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Check-in</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {event.name}
                          </TableCell>
                          <TableCell>{getUserById(event.user_id)}</TableCell>
                          <TableCell>
                            {event.status === "triggered" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Triggered
                              </span>
                            ) : event.status === "paused" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                Paused
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(
                              parseISO(event.last_check_in),
                              {
                                addSuffix: true,
                              },
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Contacts</CardTitle>
              <CardDescription>
                View and manage all notification contacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Loading contacts...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    {searchTerm
                      ? "No matching contacts found"
                      : "No contacts found"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            {contact.name}
                          </TableCell>
                          <TableCell>{getUserById(contact.user_id)}</TableCell>
                          <TableCell>{contact.email || "N/A"}</TableCell>
                          <TableCell>{contact.phone || "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>View system-wide activity logs</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    Loading activity logs...
                  </p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    {searchTerm
                      ? "No matching logs found"
                      : "No activity logs found"}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{getUserById(log.user_id)}</TableCell>
                          <TableCell className="font-medium">
                            {log.action.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell>
                            {log.details
                              ? Object.entries(
                                  log.details as Record<string, any>,
                                )
                                  .map(([key, value]) => {
                                    if (typeof value === "object") return null;
                                    return `${key}: ${value}`;
                                  })
                                  .filter(Boolean)
                                  .join(", ")
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(parseISO(log.created_at), {
                              addSuffix: true,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Triggered Alerts</CardTitle>
              <CardDescription>
                View events that have triggered alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Loading alerts...</p>
                </div>
              ) : triggeredEvents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    No triggered alerts found
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Name</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Triggered At</TableHead>
                        <TableHead>Last Check-in</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {triggeredEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {event.name}
                          </TableCell>
                          <TableCell>{getUserById(event.user_id)}</TableCell>
                          <TableCell>
                            {event.last_trigger_time
                              ? formatDistanceToNow(
                                  parseISO(event.last_trigger_time),
                                  {
                                    addSuffix: true,
                                  },
                                )
                              : "Unknown"}
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(
                              parseISO(event.last_check_in),
                              {
                                addSuffix: true,
                              },
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
