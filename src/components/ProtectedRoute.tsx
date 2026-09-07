import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, roles } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-data text-sm text-muted-foreground animate-pulse">
          LOADING...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Redirect creator-only users to their portal
  const isCreatorOnly = roles.includes("creator") && !roles.includes("admin");
  if (isCreatorOnly && location.pathname !== "/creator-portal") {
    return <Navigate to="/creator-portal" replace />;
  }

  return <>{children}</>;
}
