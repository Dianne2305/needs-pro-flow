/**
 * AppSidebar.tsx
 * Barre latérale de navigation (thème noir/teal). Liens vers Dashboard, Pending, Listing, Profils, Finance, Marketing, Qualité, Paramètres. Badge rouge pour demandes en attente.
 */
import {
  LayoutDashboard, Clock, Users, Building2, Wallet, Settings, History, Star, Megaphone, BarChart3, ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const items = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Demandes en attente", url: "/demandes", icon: Clock, showBadge: true },
  { title: "Listing profils", url: "/profils", icon: Users },
  { title: "Listing clients", url: "/clients", icon: Building2 },
  { title: "Historique", url: "/historique", icon: History },
  { title: "Qualité & Feedback", url: "/qualite", icon: Star },
  { title: "Marketing", url: "/marketing", icon: Megaphone },
  { title: "Paramètres", url: "/parametres", icon: Settings },
];

const financeSubItems = [
  { title: "Vue globale", url: "/gestion-financiere", icon: BarChart3 },
  { title: "La Caisse", url: "/gestion-financiere/caisse", icon: Wallet },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isFinanceActive = location.pathname.startsWith("/gestion-financiere");

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

  const renderMenuItem = (item: typeof items[0]) => (
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
  );

  // Split items: before and after finance
  const beforeFinance = items.slice(0, 5); // up to Historique
  const afterFinance = items.slice(5); // Qualité, Marketing, Paramètres

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs uppercase tracking-wider">
            {!collapsed && "Agence Ménage"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {beforeFinance.map(renderMenuItem)}

              {/* Finance dropdown */}
              <Collapsible defaultOpen={isFinanceActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className={`hover:bg-sidebar-accent/50 ${isFinanceActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-bold" : ""}`}>
                      <Wallet className="mr-2 h-5 w-5" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-[15px] font-semibold">Gestion Financière</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {financeSubItems.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton asChild>
                            <NavLink
                              to={sub.url}
                              end={sub.url === "/gestion-financiere"}
                              className="hover:bg-sidebar-accent/50"
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-bold"
                            >
                              <sub.icon className="mr-2 h-4 w-4" />
                              <span className="text-[14px]">{sub.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {afterFinance.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
