import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "@/lib/api";
import type { User, Permission } from "@/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isOwner: boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have a stored token and fetch user profile
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUserProfile() {
    try {
      const data = await authApi.getMe() as unknown as Record<string, unknown>;
      setUser({
        id: data.id as string,
        email: data.email as string,
        displayName: (data.display_name ?? data.displayName ?? null) as string | null,
        role: (data.role ?? "user") as User["role"],
        status: (data.status ?? "active") as User["status"],
        permissions: (data.permissions ?? []) as Permission[],
        linkedPlayerId: (data.linked_player_id ?? data.linkedPlayerId ?? null) as string | null,
        createdAt: (data.created_at ?? data.createdAt ?? new Date().toISOString()) as string,
        updatedAt: (data.updated_at ?? data.updatedAt ?? new Date().toISOString()) as string,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // Token is invalid, clear it
      localStorage.removeItem("access_token");
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = await authApi.login(email, password);
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
    }
    // Fetch user profile after login
    await fetchUserProfile();
  }

  async function register(email: string, password: string, displayName?: string) {
    const data = await authApi.register(email, password, displayName);
    if (data.session?.access_token) {
      localStorage.setItem("access_token", data.session.access_token);
    }
    // Fetch user profile after registration
    await fetchUserProfile();
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem("access_token");
    setUser(null);
  }

  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || isOwner;

  function hasPermission(permission: Permission): boolean {
    if (!user) return false;
    if (user.role === "owner" || user.role === "admin") return true;
    return user.permissions.includes(permission);
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAdmin,
    isOwner,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
