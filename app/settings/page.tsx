"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FilterItem, UserSettings } from "@/types";

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function deduplicateId(base: string, existingIds: string[]): string {
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState("");

  const [statuses, setStatuses] = useState<FilterItem[]>([]);
  const [areas, setAreas] = useState<FilterItem[]>([]);
  const [newArea, setNewArea] = useState("");

  const [statusMsg, setStatusMsg] = useState("");
  const [areaMsg, setAreaMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);

      const res = await fetch("/api/settings");
      if (res.ok) {
        const data: UserSettings = await res.json();
        setStatuses(data.custom_statuses);
        setAreas(data.custom_areas);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleEmailUpdate() {
    setEmailMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) {
      setEmailMsg(`Error: ${error.message}`);
    } else {
      setEmailMsg("Check your new email address for a confirmation link.");
      setNewEmail("");
    }
  }

  async function saveStatuses(updated: FilterItem[]) {
    setStatusMsg("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_statuses: updated }),
    });
    if (res.ok) {
      setStatuses(updated);
      setStatusMsg("Saved.");
      setTimeout(() => setStatusMsg(""), 2000);
    } else {
      setStatusMsg("Failed to save.");
    }
  }

  async function saveAreas(updated: FilterItem[]) {
    setAreaMsg("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_areas: updated }),
    });
    if (res.ok) {
      setAreas(updated);
      setAreaMsg("Saved.");
      setTimeout(() => setAreaMsg(""), 2000);
    } else {
      setAreaMsg("Failed to save.");
    }
  }

  function handleStatusLabelChange(id: string, label: string) {
    setStatuses((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }

  function handleStatusToggleHidden(id: string) {
    const visible = statuses.filter((s) => !s.hidden);
    const item = statuses.find((s) => s.id === id);
    if (!item) return;
    // Prevent hiding the last visible item
    if (!item.hidden && visible.length <= 1) return;
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, hidden: !s.hidden } : s))
    );
  }

  function handleAreaLabelChange(id: string, label: string) {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, label } : a)));
  }

  function handleDeleteArea(id: string) {
    if (areas.length <= 1) return;
    setAreas((prev) => prev.filter((a) => a.id !== id));
  }

  function handleAddArea() {
    const trimmed = newArea.trim();
    if (!trimmed) return;
    const base = slugify(trimmed);
    const existingIds = areas.map((a) => a.id);
    const id = deduplicateId(base, existingIds);
    setAreas((prev) => [...prev, { id, label: trimmed }]);
    setNewArea("");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
        <a href="/tasks" className="text-xs text-gray-500 hover:text-gray-800">
          ← Tasks
        </a>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8">
        {/* Account */}
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Account</h2>
          <p className="text-xs text-gray-500">
            Current email: <span className="text-gray-800">{email}</span>
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="New email address"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
            />
            <button
              onClick={handleEmailUpdate}
              disabled={!newEmail.trim()}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40"
            >
              Update
            </button>
          </div>
          {emailMsg && <p className="text-xs text-gray-500">{emailMsg}</p>}
        </section>

        {/* Status tabs */}
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Status tabs</h2>
          <p className="text-xs text-gray-400">Rename or hide status filters. The status value saved to tasks is unchanged.</p>
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => handleStatusLabelChange(s.id, e.target.value)}
                  className={`flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 ${
                    s.hidden ? "opacity-40" : ""
                  }`}
                />
                <button
                  onClick={() => handleStatusToggleHidden(s.id)}
                  title={s.hidden ? "Show" : "Hide"}
                  className="text-xs text-gray-400 hover:text-gray-700 w-6 text-center"
                >
                  {s.hidden ? "○" : "●"}
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => saveStatuses(statuses)}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
          >
            Save
          </button>
          {statusMsg && <p className="text-xs text-gray-500">{statusMsg}</p>}
        </section>

        {/* Area tabs */}
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Area tabs</h2>
          <p className="text-xs text-gray-400">Rename, remove, or add area filters.</p>
          <div className="space-y-2">
            {areas.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={a.label}
                  onChange={(e) => handleAreaLabelChange(a.id, e.target.value)}
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
                />
                <button
                  onClick={() => handleDeleteArea(a.id)}
                  disabled={areas.length <= 1}
                  title="Remove"
                  className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-30 w-6 text-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddArea()}
              placeholder="Add area…"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
            />
            <button
              onClick={handleAddArea}
              disabled={!newArea.trim()}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <button
            onClick={() => saveAreas(areas)}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
          >
            Save
          </button>
          {areaMsg && <p className="text-xs text-gray-500">{areaMsg}</p>}
        </section>
      </main>
    </div>
  );
}
