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

// Fix 3: editor takes enabled + value separately so toggling off never discards state
interface StructureItemEditorProps {
  label: string;
  enabled: boolean;
  value: DailyStructureItem;
  onToggle: () => void;
  onChange: (val: DailyStructureItem) => void;
}

function StructureItemEditor({ label, enabled, value, onToggle, onChange }: StructureItemEditorProps) {
  const noDaysSelected = enabled && value.days.length === 0;

  function handleDayToggle(day: DayOfWeek) {
    const has = value.days.includes(day);
    const next = has
      ? value.days.filter((d) => d !== day)
      : ([...value.days, day].sort((a, b) => a - b) as DayOfWeek[]);
    onChange({ ...value, days: next });
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
            onClick={onToggle}
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

      {enabled && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 w-10">Time</label>
            <input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Days</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onChange({ ...value, days: WEEKDAYS })}
                  className="text-xs text-gray-400 hover:text-gray-700 underline"
                >
                  Weekdays
                </button>
                <button
                  onClick={() => onChange({ ...value, days: ALL_DAYS })}
                  className="text-xs text-gray-400 hover:text-gray-700 underline"
                >
                  Every day
                </button>
              </div>
            </div>
            <div className="flex gap-1.5">
              {DAYS.map(({ short, label: dayLabel, value: day }) => {
                const active = value.days.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    title={dayLabel}
                    className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
            {/* Fix 2: warn when no days selected */}
            {noDaysSelected && (
              <p className="text-xs text-amber-600">Select at least one day.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default function DailyStructurePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fix 3: keep item state separate from enabled flag so toggling never discards settings
  const [wakeUpEnabled, setWakeUpEnabled] = useState(false);
  const [wakeUp, setWakeUp] = useState<DailyStructureItem>({ time: "07:00", days: WEEKDAYS });
  const [sleepEnabled, setSleepEnabled] = useState(false);
  const [sleep, setSleep] = useState<DailyStructureItem>({ time: "22:00", days: WEEKDAYS });

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
        if (ds?.wake_up) {
          setWakeUpEnabled(true);
          setWakeUp(ds.wake_up);
        }
        if (ds?.sleep) {
          setSleepEnabled(true);
          setSleep(ds.sleep);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    // Fix 2: block save if days is empty on an enabled item
    if (wakeUpEnabled && wakeUp.days.length === 0) {
      setSaveMsg("Select at least one day for Wake up time.");
      return;
    }
    if (sleepEnabled && sleep.days.length === 0) {
      setSaveMsg("Select at least one day for Sleep time.");
      return;
    }

    setSaveMsg("");
    // Fix 3: only send the item if enabled, otherwise null
    const daily_structure: DailyStructure = {
      wake_up: wakeUpEnabled ? wakeUp : null,
      sleep: sleepEnabled ? sleep : null,
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

  const hasEmptyDays =
    (wakeUpEnabled && wakeUp.days.length === 0) ||
    (sleepEnabled && sleep.days.length === 0);

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
          enabled={wakeUpEnabled}
          value={wakeUp}
          onToggle={() => setWakeUpEnabled((v) => !v)}
          onChange={setWakeUp}
        />

        <StructureItemEditor
          label="Sleep time"
          enabled={sleepEnabled}
          value={sleep}
          onToggle={() => setSleepEnabled((v) => !v)}
          onChange={setSleep}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={hasEmptyDays}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-40"
          >
            Save
          </button>
          {saveMsg && (
            <p className={`text-xs ${saveMsg.startsWith("Failed") || saveMsg.startsWith("Select") ? "text-red-500" : "text-gray-500"}`}>
              {saveMsg}
            </p>
          )}
        </div>
      </main>
    </AppShell>
  );
}
