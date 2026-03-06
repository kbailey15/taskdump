"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface GoalsData {
  long_term_goal?: string;
  focus_90_day?: string;
  priority_1?: string;
  priority_2?: string;
  priority_3?: string;
}

interface ScheduleData {
  wake_up_time?: string;
  work_start_time?: string;
  lunch_time?: string;
  lunch_duration_minutes?: string;
  wind_down_time?: string;
  lights_out_time?: string;
  work_days?: string[];
}

interface EnergyData {
  deep_work_time?: string;
  meetings_time?: string;
  admin_time?: string;
  energy_notes?: string;
}

interface TimeBudgetsData {
  work_pct?: number;
  health_pct?: number;
  life_admin_pct?: number;
  relationships_pct?: number;
  personal_growth_pct?: number;
  fun_pct?: number;
}

interface Commitment {
  label: string;
  days: string[];
  start_time: string;
  duration_minutes: string;
}

interface StandingData {
  commitments?: Commitment[];
}

interface ContextData {
  preferences?: string;
}

interface ProfileData {
  goals?: GoalsData;
  schedule?: ScheduleData;
  energy?: EnergyData;
  budgets?: TimeBudgetsData;
  standing?: StandingData;
  context?: ContextData;
}

type SectionKey = keyof ProfileData;

const SECTION_KEYS: SectionKey[] = ["goals", "schedule", "energy", "budgets", "standing", "context"];

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIME_OF_DAY_OPTIONS = [
  { value: "early_morning", label: "Early morning (before 8am)" },
  { value: "late_morning", label: "Late morning (8am–noon)" },
  { value: "afternoon", label: "Afternoon (noon–5pm)" },
  { value: "evening", label: "Evening (5pm+)" },
];

const EMPTY_COMMITMENT: Commitment = { label: "", days: [], start_time: "", duration_minutes: "" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasData(obj: object | undefined): boolean {
  if (!obj) return false;
  return Object.values(obj).some((v) => {
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "number") return true;
    if (Array.isArray(v)) return v.length > 0;
    return false;
  });
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-gray-500 mb-1">{children}</label>;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white resize-none"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white text-gray-700"
    >
      <option value="">— select —</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function DayCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (days: string[]) => void;
}) {
  function toggle(day: string) {
    onChange(
      selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]
    );
  }
  return (
    <div className="flex gap-1.5">
      {DAYS_OF_WEEK.map((day) => {
        const active = selected.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={`w-9 h-8 rounded text-xs font-medium transition-colors ${
              active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  isComplete: boolean;
  onSave: () => void;
  saveMsg: string;
  children: React.ReactNode;
}

function SectionCard({ title, isComplete, onSave, saveMsg, children }: SectionCardProps) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {isComplete && (
          <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            Complete
          </span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSave}
          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700"
        >
          Save
        </button>
        {saveMsg && (
          <p className={`text-xs ${saveMsg.startsWith("Failed") ? "text-red-500" : "text-gray-500"}`}>
            {saveMsg}
          </p>
        )}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData>({});
  const [saveMsgs, setSaveMsgs] = useState<Partial<Record<SectionKey, string>>>({});
  const [newCommitment, setNewCommitment] = useState<Commitment>(EMPTY_COMMITMENT);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setEmail(user.email ?? null);

      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  function setField(section: SectionKey, field: string, value: unknown) {
    setProfile((prev) => ({
      ...prev,
      [section]: { ...(prev[section] ?? {}), [field]: value },
    }));
  }

  async function saveSection(key: SectionKey) {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: profile[key] ?? {} }),
    });
    const msg = res.ok ? "Saved." : "Failed to save.";
    setSaveMsgs((prev) => ({ ...prev, [key]: msg }));
    if (res.ok) {
      setTimeout(() => setSaveMsgs((prev) => ({ ...prev, [key]: "" })), 2000);
    }
  }

  function addCommitment() {
    if (!newCommitment.label.trim()) return;
    const updated = [...(profile.standing?.commitments ?? []), newCommitment];
    setProfile((prev) => ({ ...prev, standing: { commitments: updated } }));
    setNewCommitment(EMPTY_COMMITMENT);
  }

  function removeCommitment(index: number) {
    const updated = (profile.standing?.commitments ?? []).filter((_, i) => i !== index);
    setProfile((prev) => ({ ...prev, standing: { commitments: updated } }));
  }

  const completedCount = SECTION_KEYS.filter((k) => hasData(profile[k])).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  const goals = profile.goals ?? {};
  const schedule = profile.schedule ?? {};
  const energy = profile.energy ?? {};
  const budgets = profile.budgets ?? {};
  const standing = profile.standing ?? {};
  const context = profile.context ?? {};

  return (
    <AppShell email={email}>
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-gray-900">Know Me</h1>
          <p className="text-xs text-gray-400 mt-1">
            This context helps generate a personalized daily plan. The more you fill in, the smarter it gets.
          </p>
        </div>

        {/* Completion indicator */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-gray-900 h-1.5 rounded-full transition-all"
              style={{ width: `${(completedCount / SECTION_KEYS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {completedCount} of {SECTION_KEYS.length} sections complete
          </span>
        </div>

        {/* Section 1 — Goals & North Star */}
        <SectionCard
          title="Goals & North Star"
          isComplete={hasData(goals)}
          onSave={() => saveSection("goals")}
          saveMsg={saveMsgs.goals ?? ""}
        >
          <div>
            <FieldLabel>Long-term goal</FieldLabel>
            <TextArea
              value={goals.long_term_goal ?? ""}
              onChange={(v) => setField("goals", "long_term_goal", v)}
              placeholder="Where you're ultimately headed"
            />
          </div>
          <div>
            <FieldLabel>90-day focus</FieldLabel>
            <TextArea
              value={goals.focus_90_day ?? ""}
              onChange={(v) => setField("goals", "focus_90_day", v)}
              placeholder="What you're most focused on in the next 90 days"
            />
          </div>
          <div>
            <FieldLabel>Priority 1</FieldLabel>
            <TextInput
              value={goals.priority_1 ?? ""}
              onChange={(v) => setField("goals", "priority_1", v)}
              placeholder="Your top priority right now"
            />
          </div>
          <div>
            <FieldLabel>Priority 2</FieldLabel>
            <TextInput
              value={goals.priority_2 ?? ""}
              onChange={(v) => setField("goals", "priority_2", v)}
            />
          </div>
          <div>
            <FieldLabel>Priority 3</FieldLabel>
            <TextInput
              value={goals.priority_3 ?? ""}
              onChange={(v) => setField("goals", "priority_3", v)}
            />
          </div>
        </SectionCard>

        {/* Section 2 — Daily Schedule */}
        <SectionCard
          title="Daily Schedule"
          isComplete={hasData(schedule)}
          onSave={() => saveSection("schedule")}
          saveMsg={saveMsgs.schedule ?? ""}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Wake up</FieldLabel>
              <input
                type="time"
                value={schedule.wake_up_time ?? ""}
                onChange={(e) => setField("schedule", "wake_up_time", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
              />
            </div>
            <div>
              <FieldLabel>Work start</FieldLabel>
              <input
                type="time"
                value={schedule.work_start_time ?? ""}
                onChange={(e) => setField("schedule", "work_start_time", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
              />
            </div>
            <div>
              <FieldLabel>Lunch time</FieldLabel>
              <input
                type="time"
                value={schedule.lunch_time ?? ""}
                onChange={(e) => setField("schedule", "lunch_time", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
              />
            </div>
            <div>
              <FieldLabel>Lunch duration (min)</FieldLabel>
              <input
                type="number"
                min={0}
                value={schedule.lunch_duration_minutes ?? "45"}
                onChange={(e) => setField("schedule", "lunch_duration_minutes", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
              />
            </div>
            <div>
              <FieldLabel>Wind down</FieldLabel>
              <input
                type="time"
                value={schedule.wind_down_time ?? ""}
                onChange={(e) => setField("schedule", "wind_down_time", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
              />
            </div>
            <div>
              <FieldLabel>Lights out</FieldLabel>
              <input
                type="time"
                value={schedule.lights_out_time ?? ""}
                onChange={(e) => setField("schedule", "lights_out_time", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Work days</FieldLabel>
            <DayCheckboxes
              selected={schedule.work_days ?? []}
              onChange={(days) => setField("schedule", "work_days", days)}
            />
          </div>
        </SectionCard>

        {/* Section 3 — Energy Map */}
        <SectionCard
          title="Energy Map"
          isComplete={hasData(energy)}
          onSave={() => saveSection("energy")}
          saveMsg={saveMsgs.energy ?? ""}
        >
          <div>
            <FieldLabel>Best time for deep work</FieldLabel>
            <SelectInput
              value={energy.deep_work_time ?? ""}
              onChange={(v) => setField("energy", "deep_work_time", v)}
              options={TIME_OF_DAY_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel>Best time for meetings</FieldLabel>
            <SelectInput
              value={energy.meetings_time ?? ""}
              onChange={(v) => setField("energy", "meetings_time", v)}
              options={TIME_OF_DAY_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel>Best time for admin / email</FieldLabel>
            <SelectInput
              value={energy.admin_time ?? ""}
              onChange={(v) => setField("energy", "admin_time", v)}
              options={TIME_OF_DAY_OPTIONS}
            />
          </div>
          <div>
            <FieldLabel>Energy notes</FieldLabel>
            <TextArea
              value={energy.energy_notes ?? ""}
              onChange={(v) => setField("energy", "energy_notes", v)}
              placeholder="e.g. I fade after 3pm, need a reset after calls"
            />
          </div>
        </SectionCard>

        {/* Section 4 — Time Budgets */}
        <SectionCard
          title="Time Budgets"
          isComplete={hasData(budgets)}
          onSave={() => saveSection("budgets")}
          saveMsg={saveMsgs.budgets ?? ""}
        >
          <p className="text-xs text-gray-400">
            Roughly how much of your week do you want to spend on each area?
          </p>
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                { key: "work_pct", label: "Work" },
                { key: "health_pct", label: "Health" },
                { key: "life_admin_pct", label: "Life admin" },
                { key: "relationships_pct", label: "Relationships" },
                { key: "personal_growth_pct", label: "Personal growth" },
                { key: "fun_pct", label: "Fun" },
              ] as { key: keyof TimeBudgetsData; label: string }[]
            ).map(({ key, label }) => (
              <div key={key}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={budgets[key] ?? ""}
                  onChange={(e) =>
                    setField(
                      "budgets",
                      key,
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                  className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
                />
                <p className="text-xs text-gray-400 mt-0.5">% of week</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Section 5 — Standing Commitments */}
        <SectionCard
          title="Standing Commitments"
          isComplete={hasData(standing)}
          onSave={() => saveSection("standing")}
          saveMsg={saveMsgs.standing ?? ""}
        >
          {(standing.commitments ?? []).length > 0 && (
            <ul className="space-y-2">
              {(standing.commitments ?? []).map((c, i) => (
                <li key={i} className="flex items-start gap-3 bg-gray-50 rounded px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{c.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.days.join(", ")}
                      {c.start_time ? ` · ${c.start_time}` : ""}
                      {c.duration_minutes ? ` · ${c.duration_minutes} min` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCommitment(i)}
                    className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border border-dashed border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-xs text-gray-400 font-medium">Add commitment</p>
            <div>
              <FieldLabel>Label</FieldLabel>
              <TextInput
                value={newCommitment.label}
                onChange={(v) => setNewCommitment((prev) => ({ ...prev, label: v }))}
                placeholder="e.g. Gym, Team standup, Therapy"
              />
            </div>
            <div>
              <FieldLabel>Days</FieldLabel>
              <DayCheckboxes
                selected={newCommitment.days}
                onChange={(days) => setNewCommitment((prev) => ({ ...prev, days }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Start time</FieldLabel>
                <input
                  type="time"
                  value={newCommitment.start_time}
                  onChange={(e) =>
                    setNewCommitment((prev) => ({ ...prev, start_time: e.target.value }))
                  }
                  className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
                />
              </div>
              <div>
                <FieldLabel>Duration (min)</FieldLabel>
                <input
                  type="number"
                  min={0}
                  value={newCommitment.duration_minutes}
                  onChange={(e) =>
                    setNewCommitment((prev) => ({ ...prev, duration_minutes: e.target.value }))
                  }
                  className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:border-gray-400 bg-white"
                />
              </div>
            </div>
            <button
              onClick={addCommitment}
              disabled={!newCommitment.label.trim()}
              className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        </SectionCard>

        {/* Section 6 — Preferences & Context */}
        <SectionCard
          title="Preferences & Context"
          isComplete={hasData(context)}
          onSave={() => saveSection("context")}
          saveMsg={saveMsgs.context ?? ""}
        >
          <TextArea
            value={context.preferences ?? ""}
            onChange={(v) => setField("context", "preferences", v)}
            placeholder="Anything KBLOS should know about how you work and live — your ADHD, routines, what helps you focus, what drains you, etc."
            rows={4}
          />
        </SectionCard>
      </main>
    </AppShell>
  );
}
