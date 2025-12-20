import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
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
  const [, setIsInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Check active session
    console.log("[Auth] Checking session...");
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log("[Auth] Session result:", { session: !!session, error });
      if (!isMounted) return;

      if (session?.user) {
        localStorage.setItem("access_token", session.access_token);
        fetchUserProfile(session.user.id, session.user.email || "").then(() => {
          if (isMounted) setIsInitialized(true);
        });
      } else {
        console.log("[Auth] No session, setting loading=false");
        setLoading(false);
        setIsInitialized(true);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] onAuthStateChange:", event, { hasSession: !!session });
      if (!isMounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        console.log("[Auth] SIGNED_IN, fetching profile...");
        localStorage.setItem("access_token", session.access_token);
        await fetchUserProfile(session.user.id, session.user.email || "");
      } else if (event === "SIGNED_OUT") {
        console.log("[Auth] SIGNED_OUT");
        setUser(null);
        localStorage.removeItem("access_token");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchUserProfile(userId: string, email: string) {
    console.log("[Auth] fetchUserProfile called:", { userId, email });
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile fetch timeout")), 5000)
      );

      const fetchPromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const result = await Promise.race([fetchPromise, timeoutPromise]) as Awaited<typeof fetchPromise>;
      const { data: profile, error } = result;
      console.log("[Auth] Profile fetch result:", { profile, error });

      if (error) {
        console.warn("Profile not found, using defaults:", error.message);
      }

      // Set user even if profile doesn't exist (use defaults)
      setUser({
        id: userId,
        email,
        displayName: profile?.display_name || null,
        role: profile?.role || "user",
        status: profile?.status || "active",
        permissions: (profile?.permissions || []) as Permission[],
        linkedPlayerId: profile?.linked_player_id || null,
        createdAt: profile?.created_at || new Date().toISOString(),
        updatedAt: profile?.updated_at || new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      // Still set user with defaults so app doesn't break
      setUser({
        id: userId,
        email,
        displayName: null,
        role: "user",
        status: "active",
        permissions: [],
        linkedPlayerId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      console.log("[Auth] Setting loading=false");
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    console.log("[Auth] login called:", { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log("[Auth] login result:", { hasData: !!data, hasSession: !!data?.session, error });

    if (error) throw error;

    if (data.session) {
      localStorage.setItem("access_token", data.session.access_token);
    }
  }

  async function register(email: string, password: string, displayName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) throw error;

    if (data.session) {
      localStorage.setItem("access_token", data.session.access_token);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    localStorage.removeItem("access_token");
  }

  const isOwner = user?.role === "owner";
  const isAdmin = user?.role === "admin" || isOwner;

  function hasPermission(permission: Permission): boolean {
    if (!user) return false;
    // Owner and admin have all permissions
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
