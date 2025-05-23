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
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .eq("deleted", false)
    .order("created_at", { ascending: false });

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", user.id)
    .eq("deleted", false)
    .order("name", { ascending: true });

  return (
    <>
      <DashboardNavbar isAdmin={isAdmin} />
      <main className="w-full bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8">
          {isAdmin ? (
            <AdminDashboard user={user} />
          ) : (
            <CheckInDashboard
              initialEvents={events || []}
              initialContacts={contacts || []}
              user={user}
            />
          )}
        </div>
      </main>
    </>
  );
}
