"use client";

import { useEffect, useState } from "react";

type Settings = {
  general: { appName: string; supportEmail: string; defaultTimezone: string };
  email: {
    defaultSenderEmail: string;
    defaultSendingDomain: string;
    maxEmailSizeBytes: number;
    maxAttachmentSizeBytes: number;
  };
  limits: {
    maxEmailsPerDayPerUser: number;
    maxApiRequestsPerDayPerUser: number;
    maxDomainsPerUser: number;
    maxInboxSizeBytes: number;
  };
  storage: {
    totalStorageLimitBytes: number;
    perUserStorageLimitBytes: number;
    warningThresholdPercent: number;
  };
  security: { minPasswordLength: number; maxLoginAttempts: number; sessionTimeoutMinutes: number };
  features: { signupEnabled: boolean; aiEnabled: boolean; tempInboxEnabled: boolean };
  maintenance: { enabled: boolean; message: string };
  cleanupRules: { autoDeleteTrashDays: number };
};

type SectionKey = keyof Settings;

function numberInput(v: number, onChange: (n: number) => void) {
  return (
    <input
      type="number"
      value={v}
      onChange={(e) => onChange(Number(e.target.value || 0))}
      className="mt-1 w-full rounded-xl border border-[#e4e0f7] bg-white px-3 py-2 text-sm text-[#1c1b33]"
    />
  );
}

export function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; settings?: Settings; error?: string };
      if (!res.ok || !json.ok || !json.settings) {
        setError(json.error ?? "Failed to load settings.");
        return;
      }
      setSettings(json.settings);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSection<K extends SectionKey>(section: K, values: Settings[K]) {
    setSaving(section);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section, values }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; settings?: Settings; error?: string };
      if (!res.ok || !json.ok || !json.settings) {
        setError(json.error ?? `Failed to save ${section}.`);
        return;
      }
      setSettings(json.settings);
      setSuccess(`${section} saved.`);
    } finally {
      setSaving(null);
    }
  }

  if (loading || !settings) {
    return (
      <section className="rounded-2xl border border-[#ece9fb] bg-white p-6 text-sm text-[#6f6b8c] shadow-sm">
        Loading settings...
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#eae7f8] bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-[#1c1b33]">Admin Settings</h2>
        <p className="mt-1 text-sm text-[#4f4a6b]">Persisted system configuration with section-level saves.</p>
      </section>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p> : null}

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">General</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div><label className="text-xs font-semibold text-[#555370]">App name</label><input value={settings.general.appName} onChange={(e)=>setSettings({...settings,general:{...settings.general,appName:e.target.value}})} className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm" /></div>
          <div><label className="text-xs font-semibold text-[#555370]">Support email</label><input value={settings.general.supportEmail} onChange={(e)=>setSettings({...settings,general:{...settings.general,supportEmail:e.target.value}})} className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm" /></div>
          <div><label className="text-xs font-semibold text-[#555370]">Default timezone</label><input value={settings.general.defaultTimezone} onChange={(e)=>setSettings({...settings,general:{...settings.general,defaultTimezone:e.target.value}})} className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm" /></div>
        </div>
        <button onClick={()=>void saveSection("general", settings.general)} disabled={saving==="general"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="general"?"Saving...":"Save General"}</button>
      </section>

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">Email</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><label className="text-xs font-semibold text-[#555370]">Default sender email</label><input value={settings.email.defaultSenderEmail} onChange={(e)=>setSettings({...settings,email:{...settings.email,defaultSenderEmail:e.target.value}})} className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm" /></div>
          <div><label className="text-xs font-semibold text-[#555370]">Default sending domain</label><input value={settings.email.defaultSendingDomain} onChange={(e)=>setSettings({...settings,email:{...settings.email,defaultSendingDomain:e.target.value}})} className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm" /></div>
          <div><label className="text-xs font-semibold text-[#555370]">Max email size (bytes)</label>{numberInput(settings.email.maxEmailSizeBytes, (n)=>setSettings({...settings,email:{...settings.email,maxEmailSizeBytes:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Max attachment size (bytes)</label>{numberInput(settings.email.maxAttachmentSizeBytes, (n)=>setSettings({...settings,email:{...settings.email,maxAttachmentSizeBytes:n}}))}</div>
        </div>
        <button onClick={()=>void saveSection("email", settings.email)} disabled={saving==="email"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="email"?"Saving...":"Save Email"}</button>
      </section>

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">Limits</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div><label className="text-xs font-semibold text-[#555370]">Max emails/day/user</label>{numberInput(settings.limits.maxEmailsPerDayPerUser,(n)=>setSettings({...settings,limits:{...settings.limits,maxEmailsPerDayPerUser:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Max API requests/day/user</label>{numberInput(settings.limits.maxApiRequestsPerDayPerUser,(n)=>setSettings({...settings,limits:{...settings.limits,maxApiRequestsPerDayPerUser:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Max domains/user</label>{numberInput(settings.limits.maxDomainsPerUser,(n)=>setSettings({...settings,limits:{...settings.limits,maxDomainsPerUser:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Max inbox size (bytes)</label>{numberInput(settings.limits.maxInboxSizeBytes,(n)=>setSettings({...settings,limits:{...settings.limits,maxInboxSizeBytes:n}}))}</div>
        </div>
        <button onClick={()=>void saveSection("limits", settings.limits)} disabled={saving==="limits"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="limits"?"Saving...":"Save Limits"}</button>
      </section>

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">Storage</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div><label className="text-xs font-semibold text-[#555370]">Total storage limit (bytes, 0=auto)</label>{numberInput(settings.storage.totalStorageLimitBytes,(n)=>setSettings({...settings,storage:{...settings.storage,totalStorageLimitBytes:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Per-user storage limit (bytes, 0=plan)</label>{numberInput(settings.storage.perUserStorageLimitBytes,(n)=>setSettings({...settings,storage:{...settings.storage,perUserStorageLimitBytes:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Warning threshold (%)</label>{numberInput(settings.storage.warningThresholdPercent,(n)=>setSettings({...settings,storage:{...settings.storage,warningThresholdPercent:n}}))}</div>
        </div>
        <button onClick={()=>void saveSection("storage", settings.storage)} disabled={saving==="storage"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="storage"?"Saving...":"Save Storage"}</button>
      </section>

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">Security</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div><label className="text-xs font-semibold text-[#555370]">Minimum password length</label>{numberInput(settings.security.minPasswordLength,(n)=>setSettings({...settings,security:{...settings.security,minPasswordLength:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Max login attempts (not enforced — unlimited)</label>{numberInput(settings.security.maxLoginAttempts,(n)=>setSettings({...settings,security:{...settings.security,maxLoginAttempts:n}}))}</div>
          <div><label className="text-xs font-semibold text-[#555370]">Session timeout (minutes)</label>{numberInput(settings.security.sessionTimeoutMinutes,(n)=>setSettings({...settings,security:{...settings.security,sessionTimeoutMinutes:n}}))}</div>
        </div>
        <button onClick={()=>void saveSection("security", settings.security)} disabled={saving==="security"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="security"?"Saving...":"Save Security"}</button>
      </section>

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">Features</h3>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-[#1c1b33]"><input type="checkbox" checked={settings.features.signupEnabled} onChange={(e)=>setSettings({...settings,features:{...settings.features,signupEnabled:e.target.checked}})} />Signup enabled</label>
          <label className="flex items-center gap-2 text-sm text-[#1c1b33]"><input type="checkbox" checked={settings.features.aiEnabled} onChange={(e)=>setSettings({...settings,features:{...settings.features,aiEnabled:e.target.checked}})} />AI enabled</label>
          <label className="flex items-center gap-2 text-sm text-[#1c1b33]"><input type="checkbox" checked={settings.features.tempInboxEnabled} onChange={(e)=>setSettings({...settings,features:{...settings.features,tempInboxEnabled:e.target.checked}})} />Temp inbox enabled</label>
        </div>
        <button onClick={()=>void saveSection("features", settings.features)} disabled={saving==="features"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="features"?"Saving...":"Save Features"}</button>
      </section>

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">Maintenance</h3>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-[#1c1b33]"><input type="checkbox" checked={settings.maintenance.enabled} onChange={(e)=>setSettings({...settings,maintenance:{...settings.maintenance,enabled:e.target.checked}})} />Enable maintenance mode (admin-only access)</label>
          <div><label className="text-xs font-semibold text-[#555370]">Maintenance message</label><textarea value={settings.maintenance.message} onChange={(e)=>setSettings({...settings,maintenance:{...settings.maintenance,message:e.target.value}})} className="mt-1 w-full rounded-xl border border-[#e4e0f7] px-3 py-2 text-sm" rows={3} /></div>
        </div>
        <button onClick={()=>void saveSection("maintenance", settings.maintenance)} disabled={saving==="maintenance"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="maintenance"?"Saving...":"Save Maintenance"}</button>
      </section>

      <section className="rounded-2xl border border-[#ece9fb] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1c1b33]">Cleanup Rules</h3>
        <div className="mt-3 max-w-sm">
          <label className="text-xs font-semibold text-[#555370]">Auto delete trash after days</label>
          {numberInput(settings.cleanupRules.autoDeleteTrashDays,(n)=>setSettings({...settings,cleanupRules:{...settings.cleanupRules,autoDeleteTrashDays:n}}))}
        </div>
        <button onClick={()=>void saveSection("cleanupRules", settings.cleanupRules)} disabled={saving==="cleanupRules"} className="mt-4 rounded-xl bg-[#5b3dff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving==="cleanupRules"?"Saving...":"Save Cleanup Rules"}</button>
      </section>
    </div>
  );
}
