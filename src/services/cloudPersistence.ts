import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AccessibleShop = {
  id: string;
  name: string;
};

export type CloudTenantContext = {
  organizationId: string;
  user: User;
  shops: AccessibleShop[];
};

export function cloudPersistenceError(error: unknown, stage: string): Error {
  if (error instanceof Error) return new Error(`${stage}: ${error.message}`);

  if (error && typeof error === "object") {
    const value = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    const detail = [
      value.message,
      value.details,
      value.hint,
      value.code ? `Code ${value.code}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    if (detail) return new Error(`${stage}: ${detail}`);
  }

  return new Error(`${stage}: Supabase rejected the request without returning details.`);
}

export function normalizeShopName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function loadCloudTenantContext(): Promise<CloudTenantContext | null> {
  if (!supabase) return null;

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw cloudPersistenceError(authError, "Authentication lookup failed");
  if (!auth.user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", auth.user.id)
    .single<{ organization_id: string }>();

  if (profileError) {
    throw cloudPersistenceError(profileError, "Organization lookup failed");
  }

  const { data: shops, error: shopsError } = await supabase
    .from("shops")
    .select("id, name")
    .eq("organization_id", profile.organization_id)
    .order("name")
    .returns<AccessibleShop[]>();

  if (shopsError) {
    throw cloudPersistenceError(shopsError, "Accessible shop lookup failed");
  }

  return {
    organizationId: profile.organization_id,
    user: auth.user,
    shops: shops ?? [],
  };
}

export function findCloudShop(
  shops: AccessibleShop[],
  shopName: string,
): AccessibleShop {
  const requestedName = normalizeShopName(shopName);
  const shop = shops.find(
    (candidate) => normalizeShopName(candidate.name) === requestedName,
  );

  if (!shop) {
    throw new Error(
      `Shop lookup failed: “${shopName || "No shop selected"}” does not match an accessible Crash Ops location.`,
    );
  }

  return shop;
}
