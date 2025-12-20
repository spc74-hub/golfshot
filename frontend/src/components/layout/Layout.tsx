import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Home,
  Plus,
  History,
  Settings,
  LogOut,
  Flag,
  MapPin,
  Users,
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <Flag className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">Golf Shot</span>
          </Link>

          <nav className="ml-auto flex items-center space-x-4">
            {user && (
              <>
                <span className="text-sm text-muted-foreground hidden md:inline">
                  {user.displayName || user.email}
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Salir
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-6">{children}</main>

      {/* Bottom navigation (mobile) */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
          <div className="flex justify-around items-center h-16">
            <Link
              to="/"
              className={`flex flex-col items-center justify-center w-full h-full ${
                isActive("/") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="text-xs mt-1">Inicio</span>
            </Link>
            <Link
              to="/round/setup"
              className={`flex flex-col items-center justify-center w-full h-full ${
                isActive("/round/setup") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs mt-1">Nueva</span>
            </Link>
            <Link
              to="/history"
              className={`flex flex-col items-center justify-center w-full h-full ${
                isActive("/history") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <History className="h-5 w-5" />
              <span className="text-xs mt-1">Historial</span>
            </Link>
            <Link
              to="/courses"
              className={`flex flex-col items-center justify-center w-full h-full ${
                isActive("/courses") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MapPin className="h-5 w-5" />
              <span className="text-xs mt-1">Campos</span>
            </Link>
            <Link
              to="/players"
              className={`flex flex-col items-center justify-center w-full h-full ${
                isActive("/players") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="text-xs mt-1">Jugadores</span>
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex flex-col items-center justify-center w-full h-full ${
                  location.pathname.startsWith("/admin")
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <Settings className="h-5 w-5" />
                <span className="text-xs mt-1">Admin</span>
              </Link>
            )}
          </div>
        </nav>
      )}

      {/* Add padding at bottom for mobile nav */}
      {user && <div className="h-16 md:hidden" />}
    </div>
  );
}
