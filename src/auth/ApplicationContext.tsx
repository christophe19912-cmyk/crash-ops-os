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

const UserContext = createContext<UserProfile | null>(null);
const OrganizationContext = createContext<Organization | null>(null);
const RoleContext = createContext<AppRole | null>(null);
const ContextStatus = createContext({ loading: false, error: "", needsSetup: false, refresh: () => {} });

export function ApplicationContextProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
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

  const status = useMemo(() => ({ loading, error, needsSetup: Boolean(user && !loading && (!profile || !profile.organization_id)), refresh: () => setRefreshKey((value) => value + 1) }), [error, loading, profile, user]);

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
