import { SidebarTrigger } from "@/components/ui/sidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const routeNames: Record<string, string> = {
  "/": "Home",
  "/creators": "Creator Hub",
  "/brief": "Create Brief",
  "/campaigns": "Campaigns",
  "/market": "Command Center",
  "/measurement": "Measurement",
  "/financial": "Financial Governance",
  "/ai": "Nestlé AI",
  "/creator-portal": "Creator Portal",
};

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isCreatorOnly = roles.includes("creator") && !roles.includes("admin");
  const currentRoute = routeNames[location.pathname] || "Starling";
  const now = new Date();
  const currentPeriod = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;

  return (
    <header className="h-[52px] flex items-center px-4 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
      <SidebarTrigger className="mr-4 text-muted-foreground hover:text-foreground" />
      <div className="flex items-center gap-2 font-data text-[11px] tracking-wider">
        <span className="text-muted-foreground uppercase">STARLING</span>
        <span className="text-muted-foreground/40">›</span>
        <span className="text-foreground font-medium">{currentRoute}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {!isCreatorOnly && (
          <>
            <div className="border border-border rounded-md px-3 py-1" title="Current reporting period">
              <span className="font-data text-[10px] text-muted-foreground tracking-wider">{currentPeriod}</span>
            </div>
            <button
              onClick={() => navigate("/brief")}
              className="bg-primary text-primary-foreground px-4 py-1.5 font-data text-[10px] tracking-wider font-semibold hover:bg-primary/90 transition-colors"
            >
              + NEW BRIEF
            </button>
          </>
        )}
        {isCreatorOnly && (
          <div className="flex items-center gap-1.5 border border-accent/40 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-data text-[10px] text-accent tracking-wider font-medium">CREATOR</span>
          </div>
        )}
      </div>
    </header>
  );
}
