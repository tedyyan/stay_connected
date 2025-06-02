"use client";

import Link from "next/link";
import { createClient } from "../supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import {
  UserCircle,
  Bell,
  Users,
  History,
  Shield,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";

interface DashboardNavbarProps {
  isAdmin?: boolean;
}

export default function DashboardNavbar({
  isAdmin = false,
}: DashboardNavbarProps) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentTab, setCurrentTab] = useState<string | null>(null);

  // Handle tab state on client side to avoid hydration mismatch
  useEffect(() => {
    setCurrentTab(searchParams.get("tab"));
  }, [searchParams]);

  const getNavLinkClassName = (tabName: string | null) => {
    const isActive = pathname === "/dashboard" && currentTab === tabName;
    return `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
      isActive 
        ? "bg-blue-50 text-blue-700" 
        : "text-gray-600 hover:text-blue-600"
    }`;
  };

  const getCheckInsClassName = () => {
    const isActive = pathname === "/dashboard" && !currentTab;
    return `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
      isActive 
        ? "bg-blue-50 text-blue-700" 
        : "text-gray-600 hover:text-blue-600"
    }`;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess("Password updated successfully");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => setShowPasswordDialog(false), 2000);
    } catch (error: any) {
      setError(error.message || "Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });

      if (authError) throw authError;

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      // Update public profile
      const { error: profileError } = await supabase
        .from("users")
        .update({
          avatar_url: avatarUrl,
          name: displayName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      setSuccess("Profile updated successfully");
      setTimeout(() => setShowProfileDialog(false), 2000);
    } catch (error: any) {
      setError(error.message || "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("avatar_url, name")
        .eq("id", user.id)
        .single();

      if (data) {
        setAvatarUrl(data.avatar_url || "");
        setDisplayName(data.name || "");
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  return (
    <nav className="w-full border-b border-gray-200 bg-white py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/" prefetch className="text-xl font-bold">
            Logo
          </Link>
          <div className="hidden md:flex items-center space-x-4 ml-6">
            {isAdmin ? (
              <div className="flex items-center space-x-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-md">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Admin Mode</span>
              </div>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className={getCheckInsClassName()}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Check-Ins
                </Link>
                <Link
                  href="/dashboard?tab=contacts"
                  className={getNavLinkClassName("contacts")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Contacts
                </Link>
                <Link
                  href="/dashboard?tab=history"
                  className={getNavLinkClassName("history")}
                >
                  <History className="mr-2 h-4 w-4" />
                  History
                </Link>
                <Link
                  href="/dashboard?tab=notifications"
                  className={getNavLinkClassName("notifications")}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <UserCircle className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  loadUserProfile();
                  setShowProfileDialog(true);
                }}
              >
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPasswordDialog(true)}>
                Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.push("/");
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <p className="text-sm font-medium text-red-500">{error}</p>
              )}
              {success && (
                <p className="text-sm font-medium text-green-500">{success}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Profile Edit Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProfileUpdate}>
            <div className="grid gap-4 py-4">
              <div className="flex justify-center mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage
                    src={
                      avatarUrl ||
                      "https://api.dicebear.com/7.x/avataaars/svg?seed=default"
                    }
                  />
                  <AvatarFallback>User</AvatarFallback>
                </Avatar>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a URL for your avatar image or use a{" "}
                  <a
                    href="https://api.dicebear.com/7.x/avataaars/svg?seed=default"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    DiceBear avatar
                  </a>
                </p>
              </div>
              {error && (
                <p className="text-sm font-medium text-red-500">{error}</p>
              )}
              {success && (
                <p className="text-sm font-medium text-green-500">{success}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowProfileDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Profile"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
