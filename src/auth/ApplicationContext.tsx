import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";

const TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";

export type AppRole =
  | "platform_admin"
  | "organization_admin"
  | "regional_manager"
  | "shop_manager";

export type UserProfile = {
  id: string;
  organization_id: string | null;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
  is_active: boolean;
};

const TEST_PROFILE: UserProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  organization_id: "00000000-0000-4000-8000-000000000002",
  email: "test@crashops.local",
  full_name: "Crash Ops Test User",
  role: "platform_admin",
  is_active: true,
};

const TEST_ORGANIZATION: Organization = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Crash Ops Test Organization",
  slug: "crash-ops-test",
  address: null,
  phone: null,
  website: null,
  timezone: "America/New_York",
  is_active: true,
};

const UserContext = createContext<UserProfile | null>(null);
const OrganizationContext = createContext<Organization | null>(null);
const RoleContext = createContext<AppRole | null>(null);
const ContextStatus = createContext({ loading: false, error: "", needsSetup: false, refresh: () => {} });

export function ApplicationContextProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(TEST_MODE ? TEST_PROFILE : null);
  const [organization, setOrganization] = useState<Organization | null>(TEST_MODE ? TEST_ORGANIZATION : null);
  const [loading, setLoading] = useState(TEST_MODE ? false : Boolean(user));
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (TEST_MODE) {
      setProfile(TEST_PROFILE);
      setOrganization(TEST_ORGANIZATION);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    setProfile(null);
    setOrganization(null);
    setError("");

    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, organization_id, email, full_name, role, is_active")
        .eq("id", user.id)
        .maybeSingle<UserProfile>();

      if (!active) return;
      if (profileError) {
        setError("Your account is signed in, but its Crash Ops profile could not be loaded.");
        setLoading(false);
        return;
      }

      setProfile(data);
      if (data?.organization_id) {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("id, name, slug, address, phone, website, timezone, is_active")
          .eq("id", data.organization_id)
          .single<Organization>();
        if (!active) return;
        if (orgError) setError("Your organization could not be loaded.");
        else setOrganization(org);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [refreshKey, user]);

  const status = useMemo(
    () => ({
      loading,
      error,
      needsSetup: TEST_MODE ? false : Boolean(user && !loading && (!profile || !profile.organization_id)),
      refresh: () => setRefreshKey((value) => value + 1),
    }),
    [error, loading, profile, user],
  );

  return (
    <ContextStatus.Provider value={status}>
      <UserContext.Provider value={profile}>
        <OrganizationContext.Provider value={organization}>
          <RoleContext.Provider value={profile?.role ?? null}>
            {children}
          </RoleContext.Provider>
        </OrganizationContext.Provider>
      </UserContext.Provider>
    </ContextStatus.Provider>
  );
}

export const useUserProfile = () => useContext(UserContext);
export const useOrganization = () => useContext(OrganizationContext);
export const useRole = () => useContext(RoleContext);
export const useApplicationContextStatus = () => useContext(ContextStatus);
