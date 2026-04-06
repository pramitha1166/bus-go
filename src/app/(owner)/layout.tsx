"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Bus,
  Calendar,
  BookOpen,
  BarChart2,
  Bell,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/toaster";
import OwnerSidebar from "@/components/owner/OwnerSidebar";
import OwnerBottomNav from "@/components/owner/OwnerBottomNav";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/portal": "Dashboard",
  "/portal/buses/new": "Add Bus",
  "/portal/schedules": "Schedules",
  "/portal/reports": "Reports",
};

const drawerNav = [
  { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
  { label: "My Buses", href: "/portal/buses/new", icon: Bus },
  { label: "Schedules", href: "/portal/schedules", icon: Calendar },
  { label: "Bookings", href: "/portal/schedules", icon: BookOpen },
  { label: "Reports", href: "/portal/reports", icon: BarChart2 },
];

export default function OwnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ??
    "Portal";

  const ownerName = session.user?.name ?? "Bus Owner";
  const ownerPhone = session.user?.phone ?? "";
  const initials = ownerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <OwnerSidebar ownerName={ownerName} ownerPhone={ownerPhone} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b flex items-center gap-3 px-4 h-14">
          {/* Mobile: hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <h2 className="font-semibold text-base flex-1">{pageTitle}</h2>

          {/* Notification bell placeholder */}
          <Button variant="ghost" size="icon">
            <Bell className="w-5 h-5" />
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 pb-24 lg:pb-6 lg:px-6 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <OwnerBottomNav />

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-5 py-4 border-b">
            <SheetTitle className="text-left">BusGo — Owner Portal</SheetTitle>
          </SheetHeader>

          {/* Profile */}
          <div className="px-4 py-4 border-b flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{ownerName}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {ownerPhone}
              </p>
            </div>
          </div>

          {/* Nav */}
          <nav className="px-3 py-4 space-y-1">
            {drawerNav.map(({ label, href, icon: Icon }) => {
              const active =
                href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
              return (
                <Link
                  key={href + label}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="w-4.5 h-4.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                setDrawerOpen(false);
                setShowLogout(true);
              }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={showLogout}
        onOpenChange={setShowLogout}
        title="Sign out?"
        description="You will be redirected to the login page."
        confirmLabel="Sign out"
        onConfirm={() => signOut({ callbackUrl: "/login" })}
        destructive
      />

      <Toaster />
    </div>
  );
}
