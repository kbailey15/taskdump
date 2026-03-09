"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import { DailyPlan, PlanBlock, PlanBlockType } from "@/types";

const TYPE_STYLES: Record<PlanBlockType, { bg: string; text: string; label: string }> = {
  deep_work:      { bg: "bg-indigo-100",  text: "text-indigo-700",  label: "Deep work" },
  admin:          { bg: "bg-gray-100",    text: "text-gray-600",    label: "Admin" },
  life_admin:     { bg: "bg-amber-100",   text: "text-amber-700",   label: "Life admin" },
  meeting:        { bg: "bg-blue-100",    text: "text-blue-700",    label: "Meeting" },
  routine:        { bg: "bg-slate-100",   text: "text-slate-600",   label: "Routine" },
  break:          { bg: "bg-green-100",   text: "text-green-700",   label: "Break" },
  exercise:       { bg: "bg-emerald-100", text: "text-emerald-700", label: "Exercise" },
  meal:           { bg: "bg-orange-100",  text: "text-orange-700",  label: "Meal" },
  commitment:     { bg: "bg-purple-100",  text: "text-purple-700",  label: "Commitment" },
  personal_growth:{ bg: "bg-rose-100",   text: "text-rose-700",    label: "Personal growth" },
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  const min = m > 0 ? `:${String(m).padStart(2, "0")}` : "";
  return `${hour}${min} ${suffix}`;
}

function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function getActiveBlockId(blocks: PlanBlock[], currentMinutes: number): string | null {
  for (const block of blocks) {
    if (currentMinutes >= timeToMinutes(block.start_time) && currentMinutes < timeToMinutes(block.end_time)) {
      return block.id;
    }
  }
  return null;
}

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function getDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function TodayPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = offsetDate(todayStr, 1);

  const [viewDate, setViewDate] = useState(todayStr);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [tomorrowPlanExists, setTomorrowPlanExists] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genComments, setGenComments] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<PlanBlock | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenComments, setRegenComments] = useState("");
  const [regenError, setRegenError] = useState("");
  const [currentMinutes, setCurrentMinutes] = useState(0);

  const isViewingToday = viewDate === todayStr;
  const viewDateLabel = getDateLabel(viewDate);
  const showTomorrowNudge = isViewingToday && currentMinutes >= 18 * 60 && tomorrowPlanExists === false;

  // Load user on mount
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email ?? null);
    }
    loadUser();
  }, []);

  // Load plan when viewDate changes
  useEffect(() => {
    async function loadPlan() {
      setLoading(true);
      const res = await fetch(`/api/plans?date=${viewDate}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan ?? null);
        if (viewDate === tomorrowStr) {
          setTomorrowPlanExists(!!data.plan);
        }
      }
      setLoading(false);
    }
    loadPlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate]);

  // Check tomorrow's plan for the nudge banner (once on mount)
  useEffect(() => {
    async function checkTomorrow() {
      const res = await fetch(`/api/plans?date=${tomorrowStr}`);
      if (res.ok) {
        const data = await res.json();
        setTomorrowPlanExists(!!data.plan);
      }
    }
    checkTomorrow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 60-second ticker to re-evaluate active block
  useEffect(() => {
    function tick() {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  function navigateDate(days: number) {
    setViewDate((prev) => offsetDate(prev, days));
    setPlan(null);
    setLoading(true);
    setShowRegenConfirm(false);
    setGenComments("");
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: viewDate, comments: genComments || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setGenComments("");
        if (viewDate === tomorrowStr) setTomorrowPlanExists(true);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    setRegenError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: viewDate, comments: regenComments || undefined }),
      });
      if (!res.ok) {
        setRegenError("Something went wrong. Try again.");
        return;
      }
      const data = await res.json();
      setPlan(data.plan);
      setRegenComments("");
      setShowRegenConfirm(false);
    } catch {
      setRegenError("Something went wrong. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkComplete(block: PlanBlock) {
    if (!plan) return;
    const updatedBlocks = plan.blocks.map((b) =>
      b.id === block.id ? { ...b, status: "completed" as const } : b
    );
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: plan.date, blocks: updatedBlocks }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan(data.plan);
      setSelectedBlock(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  const activeBlockId = plan ? getActiveBlockId(plan.blocks, currentMinutes) : null;
  const completedCount = plan ? plan.blocks.filter((b) => b.status === "completed").length : 0;
  const totalCount = plan ? plan.blocks.length : 0;

  return (
    <AppShell email={email}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Page header with date navigation */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigateDate(-1)}
            className="text-gray-400 hover:text-gray-700 p-1 rounded transition-colors text-xl leading-none"
            aria-label="Previous day"
          >
            ‹
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">
              {isViewingToday ? "Today" : viewDate === tomorrowStr ? "Tomorrow" : viewDateLabel}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">{viewDateLabel}</p>
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="text-gray-400 hover:text-gray-700 p-1 rounded transition-colors text-xl leading-none"
            aria-label="Next day"
          >
            ›
          </button>
        </div>

        {/* Tomorrow nudge banner */}
        {showTomorrowNudge && (
          <button
            onClick={() => navigateDate(1)}
            className="w-full mb-4 text-left px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Plan tomorrow before you wind down →
          </button>
        )}

        {/* Generating state */}
        {generating && (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">KBLOS is planning your day…</p>
          </div>
        )}

        {/* Empty state */}
        {!generating && !plan && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              No plan for {isViewingToday ? "today" : viewDate === tomorrowStr ? "tomorrow" : "this day"} yet.
            </p>
            <textarea
              value={genComments}
              onChange={(e) => setGenComments(e.target.value)}
              placeholder="Optional: add context or adjustments…"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
            />
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              {`Generate ${isViewingToday ? "today" : viewDate === tomorrowStr ? "tomorrow" : "this day"}'s plan`}
            </button>
          </div>
        )}

        {/* Plan view */}
        {!generating && plan && (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400">{viewDateLabel}</span>
              <span className="text-xs text-gray-500 font-medium">
                {completedCount} of {totalCount} blocks complete
              </span>
              <button
                onClick={() => { setShowRegenConfirm((v) => !v); setRegenError(""); }}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Regenerate
              </button>
            </div>

            {/* Regenerate confirm panel */}
            {showRegenConfirm && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <p className="text-sm text-gray-700">This will replace your current plan. Continue?</p>
                <textarea
                  value={regenComments}
                  onChange={(e) => setRegenComments(e.target.value)}
                  placeholder="Optional: describe any adjustments…"
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                />
                {regenError && <p className="text-sm text-red-500">{regenError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleRegenerate}
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => { setShowRegenConfirm(false); setRegenError(""); }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-2">
              {plan.blocks.map((block) => {
                const isActive = block.id === activeBlockId;
                const isCompleted = block.status === "completed";
                const typeStyle = TYPE_STYLES[block.type] ?? TYPE_STYLES.routine;

                return (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlock(block)}
                    className={`cursor-pointer rounded-lg p-4 bg-white transition-all ${
                      isActive
                        ? "border border-gray-200 border-l-4 border-l-indigo-500"
                        : "border border-gray-200 hover:border-gray-300"
                    } ${isCompleted ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">
                          {formatTimeRange(block.start_time, block.end_time)}
                        </p>
                        <p className="text-sm font-medium text-gray-900">{block.title}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                        {typeStyle.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Block detail modal */}
      {selectedBlock && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlock(null); }}
        >
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-xl p-6 space-y-4 overflow-y-auto sm:max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">
                  {formatTimeRange(selectedBlock.start_time, selectedBlock.end_time)}
                </p>
                <h2 className="text-base font-semibold text-gray-900">{selectedBlock.title}</h2>
              </div>
              <button
                onClick={() => setSelectedBlock(null)}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Why */}
            {selectedBlock.why && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Why you&apos;re doing this</p>
                <p className="text-sm italic text-gray-500">{selectedBlock.why}</p>
              </div>
            )}

            {/* Guidance */}
            {selectedBlock.guidance && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">How to do it</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedBlock.guidance}</p>
              </div>
            )}

            {/* Done when */}
            {selectedBlock.done_metric && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Done when</p>
                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 leading-5">✓</span>
                  <p className="text-sm text-gray-700">{selectedBlock.done_metric}</p>
                </div>
              </div>
            )}

            {/* Mark complete */}
            {selectedBlock.status === "completed" ? (
              <p className="text-sm text-gray-400 font-medium">Completed ✓</p>
            ) : (
              <button
                onClick={() => handleMarkComplete(selectedBlock)}
                className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                Mark complete
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
