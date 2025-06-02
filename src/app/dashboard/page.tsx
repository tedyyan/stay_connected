import DashboardNavbar from "@/components/dashboard-navbar";
import { createClient } from "../../supabase/server";
import { redirect } from "next/navigation";
import CheckInDashboard from "@/components/check-in-dashboard";
import AdminDashboard from "@/components/admin-dashboard";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Check if user is admin
  const { data: userData } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = userData?.is_admin || false;

  // For regular users, fetch their events and contacts
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
  const events = eventsData?.map(event => ({
    ...event,
    contacts: event.event_contacts?.map((ec: any) => ({ id: ec.contacts.id })) || []
  })) || [];

  // Fetch actual check-in status using the same function as mobile app
  const { data: checkinStatuses, error: checkinError } = await supabase.rpc(
    'get_user_checkin_status',
    { user_id_param: user.id }
  );

  // Merge the check-in status with events data
  const eventsWithCheckins = events?.map(event => {
    const checkinStatus = checkinStatuses?.find((status: any) => status.event_id === event.id);
    return {
      ...event,
      // Override last_check_in with actual last check-in if available
      last_check_in: checkinStatus?.last_checkin || event.last_check_in,
      // Add additional check-in info
      checkinStatus: checkinStatus
    };
  }) || [];

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", user.id)
    .eq("deleted", false)
    .order("created_at", { ascending: false });

  return (
    <>
      <DashboardNavbar isAdmin={isAdmin} />
      <main className="w-full bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {isAdmin ? (
            <AdminDashboard user={user} />
          ) : (
            <CheckInDashboard
              initialEvents={eventsWithCheckins}
              initialContacts={contacts || []}
              user={user}
            />
          )}
        </div>
      </main>
    </>
  );
}
