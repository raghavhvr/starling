import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { FilterBar } from "@/components/FilterBar";
import { FilterProvider } from "@/contexts/FilterContext";
import FilmGrain from "@/components/FilmGrain";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { roles } = useAuth();
  const isCreatorOnly = roles.includes("creator") && !roles.includes("admin");

  return (
    <FilterProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
            <TopBar />
            {!isCreatorOnly && <FilterBar />}
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
        <FilmGrain />
        <ChatDrawer />
      </SidebarProvider>
    </FilterProvider>
  );
}
