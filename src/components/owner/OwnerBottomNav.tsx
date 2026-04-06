"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bus, Calendar, BarChart2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Dashboard", href: "/portal",               icon: LayoutDashboard },
  { label: "Add bus",   href: "/portal/buses/new",     icon: Bus             },
  { label: "Schedule",  href: "/portal/schedules/new", icon: Plus            },
  { label: "Schedules", href: "/portal/schedules",     icon: Calendar        },
  { label: "Reports",   href: "/portal/reports",       icon: BarChart2       },
];

export default function OwnerBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t safe-area-inset-bottom">
      <div className="flex">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
