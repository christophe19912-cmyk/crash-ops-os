import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// This branch is isolated for Vercel testing only. Keep production/main Supabase-backed.
const TEST_MODE = true;
const TEST_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "test@crashops.local",
  app_metadata: {},
  user_metadata: { full_name: "Crash Ops Test User" },
  created_at: new Date(0).toISOString(),
} as User;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(TEST_MODE ? false : Boolean(supabase));
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (TEST_MODE || !supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(error ? null : data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      },
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: TEST_MODE ? TEST_USER : session?.user ?? null,
      loading,
      passwordRecovery,
      clearPasswordRecovery: () => setPasswordRecovery(false),
      signOut: async () => {
        if (TEST_MODE || !supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [loading, passwordRecovery, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
