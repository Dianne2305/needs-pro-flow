import {
  LayoutDashboard, Clock, Users, Building2, Wallet, Settings, History,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Demandes en attente", url: "/demandes", icon: Clock, showBadge: true },
  { title: "Listing profils", url: "/profils", icon: Users },
  { title: "Listing clients", url: "/clients", icon: Building2 },
  { title: "Historique", url: "/historique", icon: History },
  { title: "Gestion Financière", url: "/gestion-financiere", icon: Wallet },
  { title: "Paramètres", url: "/parametres", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["demandes", "pending_count_sidebar"],
    queryFn: async () => {
      const { count } = await supabase
        .from("demandes")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");
      return count || 0;
    },
    refetchInterval: 30000,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs uppercase tracking-wider">
            {!collapsed && "Agence Ménage"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                    >
                      <item.icon className="mr-2 h-5 w-5" />
                      {!collapsed && (
                        <span className="flex items-center gap-2 flex-1 text-[15px] font-semibold">
                          {item.title}
                          {item.showBadge && pendingCount > 0 && (
                            <Badge className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                              {pendingCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
