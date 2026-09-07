import {
  Home,
  Users,
  Megaphone,
  TrendingUp,
  BarChart3,
  DollarSign,
  MessageSquare,
  FileText,
  Zap,
  CalendarDays,
  LogOut,
} from "lucide-react";
import nestleLogo from "@/assets/nestle-logo.png";
import wppLogo from "@/assets/wpp-logo.svg";
import { BrandLogo } from "@/components/BrandLogo";
import { GLOSSARY, HINTS } from "@/lib/glossary";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const adminNavItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Creator Hub", url: "/creators", icon: Users },
  { title: "Create Brief", url: "/brief", icon: FileText },
  { title: "Campaign Flow", url: "/campaign", icon: Zap },
  { title: "Campaigns", url: "/campaigns", icon: Megaphone },
  { title: "Content Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Command Center", url: "/market", icon: TrendingUp },
  { title: "Measurement", url: "/measurement", icon: BarChart3 },
  { title: "Financial", url: "/financial", icon: DollarSign },
  { title: "Nestlé AI", url: "/ai", icon: MessageSquare },
];

const creatorNavItems = [
  { title: "My Portal", url: "/creator-portal", icon: Home },
  { title: "My Campaigns", url: "/creator-portal", icon: Megaphone },
];

const clusters = [
  { label: "CUL", color: "bg-primary" },
  { label: "DAI", color: "bg-accent" },
  { label: "BEV", color: "bg-primary" },
  { label: "CNF", color: "bg-accent" },
];

const brandChips = ["Maggi", "NIDO"];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, user, roles, signOut } = useAuth();
  const isCreator = roles.includes("creator") && !roles.includes("admin");
  const navItems = isCreator ? creatorNavItems : adminNavItems;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="h-[52px] flex items-center px-4 border-b border-border gap-3 shrink-0">
        <img src={nestleLogo} alt="Nestlé" className="h-9 w-auto object-contain shrink-0" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-ui text-xs tracking-[0.2em] text-foreground font-semibold">
              STARLING
            </span>
            <span className="font-data text-[9px] text-muted-foreground tracking-wider">
              BY NESTLÉ
            </span>
          </div>
        )}
      </div>

      <SidebarContent className="px-2 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = item.url === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-ui rounded-lg transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                        activeClassName=""
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && !isCreator && (
          <SidebarGroup>
            <div className="px-3 py-2">
              <span title={HINTS.brands} className="font-data text-[10px] text-muted-foreground tracking-wider uppercase">
                Brands
              </span>
              <div className="flex items-center gap-3 mt-2">
                {brandChips.map((b) => (
                  <BrandLogo key={b} brand={b} className="h-9" />
                ))}
              </div>
            </div>
            <div className="px-3 py-2">
              <span title={HINTS.clusters} className="font-data text-[10px] text-muted-foreground tracking-wider uppercase">
                Clusters
              </span>
              <div className="flex gap-2 mt-2">
                {clusters.map((c) => (
                  <button
                    key={c.label}
                    title={GLOSSARY[c.label]}
                    className={`w-8 h-6 ${c.color} text-[10px] font-data font-semibold text-primary-foreground flex items-center justify-center hover:opacity-80 transition-opacity`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        <div className={`flex items-center gap-2 pb-2 mb-2 border-b border-border ${collapsed ? "justify-center" : "px-1"}`}>
          {!collapsed && (
            <span className="font-data text-[8px] text-muted-foreground tracking-[0.2em]">
              POWERED BY
            </span>
          )}
          <img src={wppLogo} alt="WPP" className="h-4 w-auto object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
            <span className="font-ui text-xs text-muted-foreground">
              {profile?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-ui text-xs text-foreground truncate">
                {profile?.display_name || user?.email || "User"}
              </span>
              <span className="font-data text-[10px] text-muted-foreground capitalize">
                {roles.length > 0 ? roles.join(", ") : "User"}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
