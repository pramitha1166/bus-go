"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Bus,
  Calendar,
  BookOpen,
  BarChart2,
  LogOut,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/portal", icon: <LayoutDashboard className="w-4.5 h-4.5" /> },
  { label: "Schedules", href: "/portal/schedules", icon: <Calendar className="w-4.5 h-4.5" /> },
  { label: "Bookings", href: "/portal/schedules", icon: <BookOpen className="w-4.5 h-4.5" /> },
  { label: "Reports", href: "/portal/reports", icon: <BarChart2 className="w-4.5 h-4.5" /> },
];

interface OwnerSidebarProps {
  ownerName?: string;
  ownerPhone?: string;
}

export default function OwnerSidebar({ ownerName, ownerPhone }: OwnerSidebarProps) {
  const pathname = usePathname();
  const [showLogout, setShowLogout] = useState(false);

  const initials = ownerName
    ? ownerName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "BO";

  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 border-r bg-card">
        {/* Header */}
        <div className="px-5 py-5 border-b">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
            Owner Portal
          </p>
          <p className="font-bold text-lg text-foreground leading-tight">BusGo</p>
        </div>

        {/* Profile row */}
        <div className="px-4 py-4 border-b flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{ownerName ?? "Bus Owner"}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {ownerPhone ?? ""}
            </p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}

          {/* Quick actions */}
          <div className="pt-3 mt-2 border-t space-y-1">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Quick actions
            </p>
            <Link
              href="/portal/buses/new"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive("/portal/buses/new")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Bus className="w-4.5 h-4.5" />
              Add bus
            </Link>
            <Link
              href="/portal/schedules/new"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive("/portal/schedules/new")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Plus className="w-4.5 h-4.5" />
              Add schedule
            </Link>
          </div>
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowLogout(true)}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      <ConfirmDialog
        open={showLogout}
        onOpenChange={setShowLogout}
        title="Sign out?"
        description="You will be redirected to the login page."
        confirmLabel="Sign out"
        onConfirm={() => signOut({ callbackUrl: "/login" })}
        destructive
      />
    </>
  );
}
