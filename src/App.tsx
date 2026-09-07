import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/layouts/AppLayout";
import Index from "./pages/Index";
import CreatorHub from "./pages/CreatorHub";
import NicheDetail from "./pages/NicheDetail";
import CreateBrief from "./pages/CreateBrief";
import CampaignWorkflow from "./pages/CampaignWorkflow";
import Campaigns from "./pages/Campaigns";
import CommandCenter from "./pages/CommandCenter";
import Measurement from "./pages/Measurement";
import Financial from "./pages/Financial";
import ContentCalendar from "./pages/ContentCalendar";
import CreatorPortal from "./pages/CreatorPortal";
import BulkUpload from "./pages/BulkUpload";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/creators" element={<CreatorHub />} />
                      <Route path="/creators/niche/:id" element={<NicheDetail />} />
                      <Route path="/brief" element={<CreateBrief />} />
                      <Route path="/campaign" element={<CampaignWorkflow />} />
                      <Route path="/campaigns" element={<Campaigns />} />
                      <Route path="/market" element={<CommandCenter />} />
                      <Route path="/measurement" element={<Measurement />} />
                      <Route path="/financial" element={<Financial />} />
                      <Route path="/calendar" element={<ContentCalendar />} />
                      <Route path="/creator-portal" element={<CreatorPortal />} />
                      <Route path="/campaign/bulk" element={<BulkUpload />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
