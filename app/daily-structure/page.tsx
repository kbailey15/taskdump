"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import { DailyStructure, DailyStructureItem, DayOfWeek } from "@/types";

const DAYS: { label: string; short: string; value: DayOfWeek }[] = [
  { label: "Sunday", short: "Su", value: 0 },
  { label: "Monday", short: "Mo", value: 1 },
  { label: "Tuesday", short: "Tu", value: 2 },
  { label: "Wednesday", short: "We", value: 3 },
  { label: "Thursday", short: "Th", value: 4 },
  { label: "Friday", short: "Fr", value: 5 },
  { label: "Saturday", short: "Sa", value: 6 },
];

const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

function defaultItem(time: string): DailyStructureItem {
  return { time, days: WEEKDAYS };
}

interface StructureItemEditorProps {
  label: string;
  value: DailyStructureItem | null;
  defaultTime: string;
  onChange: (val: DailyStructureItem | null) => void;
}

function StructureItemEditor({ label, value, defaultTime, onChange }: StructureItemEditorProps) {
  const enabled = value !== null;

  function handleToggleEnabled() {
    onChange(enabled ? null : defaultItem(defaultTime));
  }

  function handleTimeChange(time: string) {
    if (!value) return;
    onChange({ ...value, time });
  }

  function handleDayToggle(day: DayOfWeek) {
    if (!value) return;
    const has = value.days.includes(day);
    const next = has
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b);
    onChange({ ...value, days: next as DayOfWeek[] });
  }

  function handleQuickSelect(days: DayOfWeek[]) {
    if (!value) return;
    onChange({ ...value, days });
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-400">{enabled ? "On" : "Off"}</span>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={handleToggleEnabled}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              enabled ? "bg-gray-900" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>

      {enabled && value && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 w-10">Time</label>
            <input
              type="time"
              value={value.time}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Days</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickSelect(WEEKDAYS)}
                  className="text-xs text-gray-400 hover:text-gray-700 underline"
                >
                  Weekdays
                </button>
                <button
                  onClick={() => handleQuickSelect(ALL_DAYS)}
                  className="text-xs text-gray-400 hover:text-gray-700 underline"
                >
                  Every day
                </button>
              </div>
            </div>
            <div className="flex gap-1.5">
              {DAYS.map(({ short, value: day }) => {
                const active = value.days.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                    title={DAYS.find((d) => d.value === day)?.label}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function DailyStructurePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wakeUp, setWakeUp] = useState<DailyStructureItem | null>(null);
  const [sleep, setSleep] = useState<DailyStructureItem | null>(null);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setEmail(user.email ?? null);

      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const ds: DailyStructure | null = data.daily_structure ?? null;
        setWakeUp(ds?.wake_up ?? null);
        setSleep(ds?.sleep ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaveMsg("");
    const daily_structure: DailyStructure = {
      wake_up: wakeUp,
      sleep,
    };
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_structure }),
    });
    if (res.ok) {
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 2000);
    } else {
      setSaveMsg("Failed to save.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <AppShell email={email}>
      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-lg font-bold text-gray-900">Daily Structure</h1>
        <p className="text-xs text-gray-400">
          Set your regular wake-up and sleep times. These appear on the Today calendar on the days you select.
        </p>

        <StructureItemEditor
          label="Wake up time"
          value={wakeUp}
          defaultTime="07:00"
          onChange={setWakeUp}
        />

        <StructureItemEditor
          label="Sleep time"
          value={sleep}
          defaultTime="22:00"
          onChange={setSleep}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
          >
            Save
          </button>
          {saveMsg && <p className="text-xs text-gray-500">{saveMsg}</p>}
        </div>
      </main>
    </AppShell>
  );
}
