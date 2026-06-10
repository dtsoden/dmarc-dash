import { LayoutDashboard, Globe2, ShieldCheck, Gavel, FileText, ScrollText, Network, Settings, Users, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/auth/session";

export interface NavItem { href: string; label: string; icon: LucideIcon }
export interface NavGroup { label: string; items: NavItem[] }

// Single source of truth for the primary navigation, shared by the desktop sidebar
// and the mobile drawer so they can never drift apart.
export const monitoringGroups: NavGroup[] = [
  { label: "Monitoring", items: [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/sources", label: "Sources", icon: Globe2 },
    { href: "/authentication", label: "Authentication", icon: ShieldCheck },
    { href: "/policy", label: "Policy", icon: Gavel },
  ]},
  { label: "Reports", items: [
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/dns", label: "DNS Report", icon: Network },
    { href: "/ingest-log", label: "Ingest Log", icon: ScrollText },
  ]},
];

export const adminGroup: NavGroup = { label: "Administration", items: [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/users", label: "Users", icon: Users },
]};

export function navGroupsForRole(role: Role): NavGroup[] {
  return role === "admin" ? [...monitoringGroups, adminGroup] : monitoringGroups;
}

export const isNavActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path.startsWith(href);
