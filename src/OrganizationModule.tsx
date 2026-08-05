import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { useOrganization, useRole, useUserProfile } from "./auth/ApplicationContext";

type OrganizationPage = "Company" | "Centers" | "Users" | "Roles" | "Integrations";
type Center = { id: string; name: string; code: string | null; timezone: string; is_active: boolean };
type OrgUser = { id: string; email: string | null; full_name: string | null; role: string; is_active: boolean };
const integrations = ["CCC ONE", "Nexsyis", "Mitchell", "Outlook", "Gmail"];
const timeZones = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix"];

export default function OrganizationModule({ page }: { page: OrganizationPage }) {
  const organization = useOrganization();
  const profile = useUserProfile();
  const role = useRole();
  const [company, setCompany] = useState({ name: "", address: "", phone: "", website: "", timezone: "America/New_York" });
  const [centers, setCenters] = useState<Center[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [newCenter, setNewCenter] = useState({ name: "", code: "", timezone: "America/New_York" });
  const [message, setMessage] = useState("");
  const canAdmin = role === "platform_admin" || role === "organization_admin";

  const loadOrganizationData = useCallback(async (targetOrganization = organization) => {
    if (!supabase || !targetOrganization) return;
    const [{ data: centerRows }, { data: userRows }] = await Promise.all([
      supabase.from("shops").select("id, name, code, timezone, is_active").eq("organization_id", targetOrganization.id).order("name"),
      supabase.from("profiles").select("id, email, full_name, role, is_active").eq("organization_id", targetOrganization.id).order("full_name"),
    ]);
    setCompany({ name: targetOrganization.name, address: targetOrganization.address || "", phone: targetOrganization.phone || "", website: targetOrganization.website || "", timezone: targetOrganization.timezone || "America/New_York" });
    setCenters(centerRows || []);
    setUsers(userRows || []);
  }, [organization]);

  useEffect(() => {
    if (!organization) return;
    void (async () => {
      await loadOrganizationData(organization);
    })();
  }, [loadOrganizationData, organization]);

  async function saveCompany() {
    if (!supabase || !organization || !canAdmin) return;
    const { error } = await supabase.from("organizations").update(company).eq("id", organization.id);
    setMessage(error ? error.message : "Company profile saved.");
  }

  async function addCenter() {
    if (!supabase || !organization || !newCenter.name.trim() || !canAdmin) return;
    const { error } = await supabase.from("shops").insert({ organization_id: organization.id, name: newCenter.name, code: newCenter.code || null, timezone: newCenter.timezone });
    setMessage(error ? error.message : "Center created.");
    if (!error) setNewCenter({ name: "", code: "", timezone: company.timezone });
    await loadOrganizationData();
  }

  async function updateCenter(center: Center) {
    if (!supabase || !canAdmin) return;
    const { error } = await supabase.from("shops").update({ name: center.name, code: center.code, timezone: center.timezone, is_active: center.is_active }).eq("id", center.id);
    setMessage(error ? error.message : "Center updated.");
    await loadOrganizationData();
  }

  async function deleteCenter(centerId: string) {
    if (!supabase || !canAdmin) return;
    const { error } = await supabase.from("shops").delete().eq("id", centerId);
    setMessage(error ? error.message : "Center deleted.");
    await loadOrganizationData();
  }

  return <><header className="topbar"><div><p className="eyebrow">ORGANIZATION</p><h2>{page}</h2><p className="page-description">Manage the company structure that powers Crash Ops OS access, centers, and integrations.</p></div></header><section className="panel org-panel">{message && <div className="context-banner">{message}</div>}{page === "Company" && <div className="org-form"><label>Name<input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} disabled={!canAdmin} /></label><label>Address<input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} disabled={!canAdmin} /></label><label>Phone<input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} disabled={!canAdmin} /></label><label>Website<input value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} disabled={!canAdmin} /></label><label>Time Zone<select value={company.timezone} onChange={(e) => setCompany({ ...company, timezone: e.target.value })} disabled={!canAdmin}>{timeZones.map((zone) => <option key={zone}>{zone}</option>)}</select></label><button disabled={!canAdmin} onClick={() => void saveCompany()} type="button">Save company</button></div>}{page === "Centers" && <div className="org-stack"><div className="org-form inline"><input placeholder="Center name" value={newCenter.name} onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })} /><input placeholder="Shop code (optional)" value={newCenter.code} onChange={(e) => setNewCenter({ ...newCenter, code: e.target.value })} /><select value={newCenter.timezone} onChange={(e) => setNewCenter({ ...newCenter, timezone: e.target.value })}>{timeZones.map((zone) => <option key={zone}>{zone}</option>)}</select><button disabled={!canAdmin} onClick={() => void addCenter()} type="button">Add center</button></div>{centers.map((center) => <div className="org-row" key={center.id}><input value={center.name} onChange={(e) => setCenters(centers.map((item) => item.id === center.id ? { ...item, name: e.target.value } : item))} /><input value={center.code || ""} onChange={(e) => setCenters(centers.map((item) => item.id === center.id ? { ...item, code: e.target.value } : item))} /><select value={center.timezone} onChange={(e) => setCenters(centers.map((item) => item.id === center.id ? { ...item, timezone: e.target.value } : item))}>{timeZones.map((zone) => <option key={zone}>{zone}</option>)}</select><button disabled={!canAdmin} onClick={() => void updateCenter(center)} type="button">Save</button><button disabled={!canAdmin} onClick={() => void deleteCenter(center.id)} type="button">Delete</button></div>)}</div>}{page === "Users" && <div className="org-stack">{users.map((user) => <div className="org-row readonly" key={user.id}><strong>{user.full_name || user.email}</strong><span>{user.email}</span><span>{user.is_active ? "Active" : "Inactive"}</span></div>)}</div>}{page === "Roles" && <div className="org-stack">{users.map((user) => <div className="org-row readonly" key={user.id}><strong>{user.full_name || user.email}</strong><span>{user.role.replaceAll("_", " ")}</span><span>{user.id === profile?.id ? "Current user" : "Team member"}</span></div>)}</div>}{page === "Integrations" && <div className="integration-grid">{integrations.map((name) => <article className="integration-card" key={name}><strong>{name}</strong><span>Planned connector</span><p>Connection controls will be enabled in a future integration phase.</p></article>)}</div>}</section></>;
}
