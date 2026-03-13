"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import { DailyPlan, PlanBlock, PlanEditEntry } from "@/types";

const DOT_COLORS: Record<string, string> = {
  deep_work:      "#2A5C8C",
  meeting:        "#2A5C8C",
  commitment:     "#2A5C8C",
  personal_growth:"#2A5C8C",
  exercise:       "#3A7D52",
  break:          "#3A7D52",
  meal:           "#3A7D52",
  admin:          "#9B59B6",
  life_admin:     "#9B59B6",
  routine:        "#9C9790",
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

// Returns true if the current moment is past the block's scheduled start on its plan date.
// Edits flagged as late suggest the day deviated from the plan.
function isEditLate(planDate: string, blockStartTime: string): boolean {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (planDate < todayStr) return true;  // editing a past day = always late
  if (planDate > todayStr) return false; // future plan = never late
  const [h, m] = blockStartTime.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
}

type EditFormState = {
  start_time: string;
  end_time: string;
  title: string;
  why: string;
  guidance: string;
  done_metric: string;
};

const NUDGE_KEY = "late_edit_nudge_dismissed";
const NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function TodayPage() {
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
  const tomorrowStr = offsetDate(todayStr, 1);

  const [viewDate, setViewDate] = useState(todayStr);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [tomorrowPlanExists, setTomorrowPlanExists] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genComments, setGenComments] = useState("");
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenComments, setRegenComments] = useState("");
  const [regenError, setRegenError] = useState("");
  const [currentMinutes, setCurrentMinutes] = useState(0);

  // Edit modal state
  const [editBlock, setEditBlock] = useState<PlanBlock | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Move modal state
  const [moveBlock, setMoveBlock] = useState<PlanBlock | null>(null);
  const [moveForm, setMoveForm] = useState<{ date: string; start_time: string; end_time: string } | null>(null);
  const [savingMove, setSavingMove] = useState(false);

  // Late-edit pattern nudge
  const [lateEditNudge, setLateEditNudge] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);

  // End of day review state
  const [showReview, setShowReview] = useState(false);
  const [reflection, setReflection] = useState("");
  const [reviewBlockStatuses, setReviewBlockStatuses] = useState<Record<string, "complete" | "deferred" | "dropped">>({});
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const isViewingToday = viewDate === todayStr;
  const viewDateLabel = getDateLabel(viewDate);
  const showTomorrowNudge = isViewingToday && currentMinutes >= 18 * 60 && tomorrowPlanExists === false;
  const showEodBanner = isViewingToday && currentMinutes >= 18 * 60;

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

  // Check for the 3-day late-edit pattern whenever viewing today.
  // If the last 3 days all have at least one late edit and the nudge
  // hasn't been recently dismissed, show a gentle schedule-review prompt.
  useEffect(() => {
    const _n = new Date();
    const today = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, "0")}-${String(_n.getDate()).padStart(2, "0")}`;
    if (viewDate !== today) return;

    const dismissed = localStorage.getItem(NUDGE_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < NUDGE_COOLDOWN_MS) return;

    const dates = [offsetDate(today, -1), offsetDate(today, -2), offsetDate(today, -3)];
    Promise.all(
      dates.map((d) =>
        fetch(`/api/plans?date=${d}`).then((r) => (r.ok ? r.json() : { plan: null }))
      )
    ).then((results) => {
      const allHaveLateEdits = results.every((data) =>
        (data.plan?.edit_log ?? []).some((e: PlanEditEntry) => e.was_late)
      );
      if (allHaveLateEdits) setLateEditNudge(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate]);

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
      body: JSON.stringify({ date: plan.date, blocks: updatedBlocks, edit_log: plan.edit_log ?? [] }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan(data.plan);
      setExpandedBlockId(null);
    }
  }

  async function handleSkip(block: PlanBlock) {
    if (!plan) return;
    const updatedBlocks = plan.blocks.map((b) =>
      b.id === block.id ? { ...b, status: "skipped" as const } : b
    );
    const entry: PlanEditEntry = {
      ts: new Date().toISOString(),
      block_id: block.id,
      block_title: block.title,
      changes: [{ field: "status", old: block.status, new: "skipped" }],
      scheduled_start: block.start_time,
      plan_date: plan.date,
      was_late: isEditLate(plan.date, block.start_time),
      action: "skip",
    };
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: plan.date, blocks: updatedBlocks, edit_log: [...(plan.edit_log ?? []), entry] }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan(data.plan);
      setExpandedBlockId(null);
    }
  }

  function handleOpenMove(block: PlanBlock) {
    setExpandedBlockId(null);
    setMoveBlock(block);
    setMoveForm({ date: plan?.date ?? viewDate, start_time: block.start_time, end_time: block.end_time });
  }

  function getMoveConflict(newStart: string, newEnd: string): string | null {
    if (!plan || !moveBlock) return null;
    const newStartMin = timeToMinutes(newStart);
    const newEndMin = timeToMinutes(newEnd);
    for (const b of plan.blocks) {
      if (b.id === moveBlock.id) continue;
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      if (newStartMin < bEnd && newEndMin > bStart) return b.title;
    }
    return null;
  }

  async function handleSaveMove() {
    if (!plan || !moveBlock || !moveForm) return;
    setSavingMove(true);
    try {
      const isRecurring =
        moveBlock.is_recurring ??
        (["routine", "exercise", "meal", "break"] as PlanBlock["type"][]).includes(moveBlock.type);

      const isSameDate = moveForm.date === plan.date;

      const conflictTitle = isSameDate ? getMoveConflict(moveForm.start_time, moveForm.end_time) : null;
      const conflictNote =
        isRecurring && conflictTitle
          ? `"${moveBlock.title}" (recurring) moved to ${moveForm.start_time}–${moveForm.end_time}, overlaps with "${conflictTitle}"`
          : undefined;

      const updatedBlock: PlanBlock = {
        ...moveBlock,
        start_time: moveForm.start_time,
        end_time: moveForm.end_time,
        rescheduled_from: {
          start_time: moveBlock.rescheduled_from?.start_time ?? moveBlock.start_time,
          end_time: moveBlock.rescheduled_from?.end_time ?? moveBlock.end_time,
        },
      };

      const entry: PlanEditEntry = {
        ts: new Date().toISOString(),
        block_id: moveBlock.id,
        block_title: moveBlock.title,
        changes: [
          { field: "start_time", old: moveBlock.start_time, new: moveForm.start_time },
          { field: "end_time", old: moveBlock.end_time, new: moveForm.end_time },
          ...(isSameDate ? [] : [{ field: "date", old: plan.date, new: moveForm.date }]),
        ],
        scheduled_start: moveBlock.rescheduled_from?.start_time ?? moveBlock.start_time,
        plan_date: plan.date,
        was_late: isEditLate(plan.date, moveBlock.start_time),
        action: "move",
        conflict_note: conflictNote,
      };

      if (isSameDate) {
        // Same-date move: update block in place
        const updatedBlocks = plan.blocks.map((b) => (b.id === moveBlock.id ? updatedBlock : b));
        const res = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: plan.date, blocks: updatedBlocks, edit_log: [...(plan.edit_log ?? []), entry] }),
        });
        if (res.ok) {
          const data = await res.json();
          setPlan(data.plan);
          setMoveBlock(null);
          setMoveForm(null);
          showToast("Block moved");
        }
      } else {
        // Cross-date move: remove from current plan, add to target date plan
        const blocksWithoutMoved = plan.blocks.filter((b) => b.id !== moveBlock.id);

        // Save current plan without the block
        const currentRes = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: plan.date, blocks: blocksWithoutMoved, edit_log: [...(plan.edit_log ?? []), entry] }),
        });

        // Fetch target date plan and add block
        const targetRes = await fetch(`/api/plans?date=${moveForm.date}`);
        const targetData = await targetRes.json();
        const targetBlocks: PlanBlock[] = targetData.plan?.blocks ?? [];
        const targetEditLog: unknown[] = targetData.plan?.edit_log ?? [];

        await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: moveForm.date, blocks: [...targetBlocks, updatedBlock], edit_log: targetEditLog }),
        });

        if (currentRes.ok) {
          const data = await currentRes.json();
          setPlan(data.plan);
          setMoveBlock(null);
          setMoveForm(null);
          showToast("Block moved");
        }
      }
    } finally {
      setSavingMove(false);
    }
  }

  // Open edit modal for a block
  function handleOpenEdit(block: PlanBlock, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedBlockId(null);
    setEditBlock(block);
    setEditForm({
      start_time: block.start_time,
      end_time: block.end_time,
      title: block.title,
      why: block.why ?? "",
      guidance: block.guidance ?? "",
      done_metric: block.done_metric ?? "",
    });
  }

  async function handleSaveEdit() {
    if (!plan || !editBlock || !editForm) return;
    setSavingEdit(true);
    try {
      const fields: (keyof EditFormState)[] = ["start_time", "end_time", "title", "why", "guidance", "done_metric"];
      const changes = fields
        .filter((f) => editForm[f] !== ((editBlock[f as keyof PlanBlock] as string) ?? ""))
        .map((f) => ({
          field: f,
          old: (editBlock[f as keyof PlanBlock] as string) ?? "",
          new: editForm[f],
        }));

      const updatedBlock: PlanBlock = { ...editBlock, ...editForm };
      // Clear step checks when guidance text changes (indices may no longer be valid)
      if (changes.some((c) => c.field === "guidance")) {
        updatedBlock.guidance_checks = [];
      }

      const updatedBlocks = plan.blocks.map((b) => (b.id === editBlock.id ? updatedBlock : b));

      const updatedEditLog = [...(plan.edit_log ?? [])];
      if (changes.length > 0) {
        const entry: PlanEditEntry = {
          ts: new Date().toISOString(),
          block_id: editBlock.id,
          block_title: editBlock.title,
          changes,
          scheduled_start: editBlock.start_time,
          plan_date: plan.date,
          was_late: isEditLate(plan.date, editBlock.start_time),
        };
        updatedEditLog.push(entry);
      }

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: plan.date, blocks: updatedBlocks, edit_log: updatedEditLog }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setEditBlock(null);
        setEditForm(null);
        showToast("Block saved");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  // Toggle a guidance step checkbox — persisted to DB, does not create an edit_log entry
  async function handleToggleGuidanceCheck(lineIndex: number) {
    if (!plan || !expandedBlockId) return;
    const block = plan.blocks.find((b) => b.id === expandedBlockId);
    if (!block) return;
    const checks = block.guidance_checks ?? [];
    const newChecks = checks.includes(lineIndex)
      ? checks.filter((i) => i !== lineIndex)
      : [...checks, lineIndex];

    const updatedBlock = { ...block, guidance_checks: newChecks };
    const updatedBlocks = plan.blocks.map((b) =>
      b.id === expandedBlockId ? updatedBlock : b
    );
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: plan.date, blocks: updatedBlocks, edit_log: plan.edit_log ?? [] }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan(data.plan);
    }
  }

  function dismissNudge() {
    setLateEditNudge(false);
    localStorage.setItem(NUDGE_KEY, Date.now().toString());
  }

  async function handleSaveReview() {
    if (!plan) return;
    const deferredCount = Object.values(reviewBlockStatuses).filter(s => s === "deferred").length;
    const updatedBlocks = plan.blocks.map((b) => {
      const newStatus = reviewBlockStatuses[b.id];
      if (newStatus === "complete") return { ...b, status: "complete" as const };
      if (newStatus === "deferred") return { ...b, status: "deferred" as const };
      if (newStatus === "dropped") return { ...b, status: "dropped" as const };
      return b;
    });
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: plan.date,
        blocks: updatedBlocks,
        edit_log: plan.edit_log ?? [],
        review: {
          reflection,
          reviewed_at: new Date().toISOString(),
          deferred_count: deferredCount,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setPlan(data.plan);
      showToast("Day reviewed ✓");
      setShowReview(false);
      setReflection("");
      setReviewBlockStatuses({});
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
      <main className="max-w-2xl mx-auto px-4 py-8 bg-[#F4F1EC] min-h-screen">
        {/* Page header with date navigation */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => navigateDate(-1)}
            className="p-1 rounded transition-colors text-xl leading-none hover:opacity-60"
            style={{ color: "#9C9790" }}
            aria-label="Previous day"
          >
            ‹
          </button>
          <div className="flex-1">
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "36px", fontWeight: "bold", lineHeight: 1.1, color: "#1A1814" }}>
              {isViewingToday ? "Today" : viewDateLabel.split(",")[0]}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#9C9790" }}>{viewDateLabel}</p>
          </div>
          <button
            onClick={() => navigateDate(1)}
            className="p-1 rounded transition-colors text-xl leading-none hover:opacity-60"
            style={{ color: "#9C9790" }}
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

        {/* Late-edit pattern nudge — shown when 3 consecutive days had post-schedule edits */}
        {lateEditNudge && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              Your plans have been shifting after the fact the last few days — that&apos;s completely fine, life happens. Would it help to add more buffer time between blocks, or move some things to better match how your days actually flow?
            </p>
            <div className="mt-3 flex gap-4">
              <button
                onClick={() => {
                  dismissNudge();
                  setShowRegenConfirm(true);
                }}
                className="text-xs font-medium text-blue-700 underline"
              >
                Adjust my schedule
              </button>
              <button
                onClick={dismissNudge}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                No thanks
              </button>
            </div>
          </div>
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

            {/* EOD review banner — shown after 6pm when viewing today */}
            {showEodBanner && !showReview && (
              <button
                onClick={() => setShowReview(true)}
                className="w-full mb-4 text-left bg-[#F5EDD0] border border-[#D4A84B] rounded-lg px-4 py-3 text-sm text-[#7A6830] cursor-pointer"
              >
                Ready to close out today? → Review your day
              </button>
            )}

            {/* EOD review panel */}
            {showReview && (
              <div className="mb-4 p-5 bg-[#FDFBF7] border border-[#DDD9CE] rounded-lg">
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "22px", color: "#1A1814" }} className="mb-4">
                  Day Review
                </h2>

                {/* Completed section */}
                <div className="mb-4">
                  <p className="uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>
                    Completed
                  </p>
                  {plan.blocks.filter(b => b.status === "completed").length === 0 ? (
                    <p className="text-sm" style={{ color: "#9C9790" }}>None yet</p>
                  ) : (
                    <div className="space-y-1">
                      {plan.blocks.filter(b => b.status === "completed").map(b => (
                        <p key={b.id} className="text-sm" style={{ color: "#1A1814" }}>{b.title}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Didn't finish section */}
                <div className="mb-4">
                  <p className="uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>
                    Didn&apos;t finish
                  </p>
                  {plan.blocks.filter(b => b.status === "pending" || b.status === "skipped").length === 0 ? (
                    <p className="text-sm" style={{ color: "#9C9790" }}>All done!</p>
                  ) : (
                    <div className="space-y-2">
                      {plan.blocks.filter(b => b.status === "pending" || b.status === "skipped").map(b => {
                        const localStatus = reviewBlockStatuses[b.id];
                        return (
                          <div key={b.id} className="flex items-center justify-between gap-3">
                            <p className="text-sm flex-1 min-w-0 truncate" style={{ color: "#1A1814" }}>{b.title}</p>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => setReviewBlockStatuses(prev => ({ ...prev, [b.id]: "complete" }))}
                                className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                                  localStatus === "complete"
                                    ? "bg-[#3A7D52] text-white border-[#3A7D52]"
                                    : "bg-[#D8EDDF] text-[#3A7D52] border border-[#3A7D52]/20"
                                }`}
                              >
                                Done ✓
                              </button>
                              <button
                                onClick={() => setReviewBlockStatuses(prev => ({ ...prev, [b.id]: "deferred" }))}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${
                                  localStatus === "deferred"
                                    ? "bg-[#D4A84B] border-[#D4A84B] text-white"
                                    : "border-[#DDD9CE] text-[#9C9790] hover:border-[#D4A84B] hover:text-[#7A6830]"
                                }`}
                              >
                                Defer to tomorrow
                              </button>
                              <button
                                onClick={() => setReviewBlockStatuses(prev => ({ ...prev, [b.id]: "dropped" }))}
                                className={`text-xs px-2 py-1 rounded border transition-colors ${
                                  localStatus === "dropped"
                                    ? "bg-[#9C9790] border-[#9C9790] text-white"
                                    : "border-[#DDD9CE] text-[#9C9790] hover:border-[#9C9790]"
                                }`}
                              >
                                Drop it
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reflection */}
                <div className="mb-4">
                  <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="One line — what moved today?"
                    rows={2}
                    className="w-full text-sm border border-[#DDD9CE] rounded-lg px-3 py-2 bg-[#F4F1EC] text-[#1A1814] placeholder-[#9C9790] focus:outline-none focus:border-[#2A5C8C] transition-colors resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveReview}
                    className="flex-1 py-2 bg-[#1A1814] text-[#F4F1EC] text-sm font-medium rounded-lg hover:bg-[#333] transition-colors"
                  >
                    Save &amp; close day
                  </button>
                  <button
                    onClick={() => setShowReview(false)}
                    className="px-4 py-2 text-sm transition-colors hover:opacity-80"
                    style={{ color: "#9C9790" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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

            {/* EOD reflection — rescheduled recurring block conflicts */}
            {(() => {
              const conflicts = (plan.edit_log ?? []).filter((e) => e.conflict_note);
              if (!conflicts.length) return null;
              return (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1.5">
                    Note for your end-of-day reflection
                  </p>
                  <p className="text-xs text-amber-700 mb-2">
                    A recurring block was rescheduled to a time that overlapped with another block.
                  </p>
                  {conflicts.map((e, i) => (
                    <p key={i} className="text-xs text-amber-600 leading-relaxed">• {e.conflict_note}</p>
                  ))}
                </div>
              );
            })()}

            {/* Timeline */}
            <div className="space-y-2">
              {plan.blocks.map((block) => {
                const isActive = block.id === activeBlockId;
                const isCompleted = block.status === "completed";
                const isSkipped = block.status === "skipped";

                const isExpanded = expandedBlockId === block.id;

                return (
                  <div
                    key={block.id}
                    onClick={() => setExpandedBlockId((prev) => prev === block.id ? null : block.id)}
                    className={`group cursor-pointer p-4 transition-all ${isCompleted || isSkipped ? "opacity-40" : ""}`}
                    style={{
                      background: "#FDFBF7",
                      border: "1px solid #DDD9CE",
                      borderLeft: isActive ? "3px solid #2A5C8C" : "1px solid #DDD9CE",
                      borderRadius: "10px",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-0.5" style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "#9C9790" }}>
                          {formatTimeRange(block.start_time, block.end_time)}
                          {block.rescheduled_from && (
                            <span className="ml-1.5 line-through" style={{ color: "#DDD9CE" }}>
                              {formatTimeRange(block.rescheduled_from.start_time, block.rescheduled_from.end_time)}
                            </span>
                          )}
                        </p>
                        <p
                          className="font-medium"
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: "14px",
                            color: "#1A1814",
                            textDecoration: isSkipped ? "line-through" : "none",
                          }}
                        >
                          {block.title}
                          {(block as PlanBlock & { sub?: string }).sub && (
                            <span style={{ fontSize: "14px", fontStyle: "italic", fontWeight: "normal", color: "#9C9790" }}>
                              {" \u2014 "}{(block as PlanBlock & { sub?: string }).sub}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Edit button — visible on card hover only */}
                        <button
                          onClick={(e) => handleOpenEdit(block, e)}
                          title="Edit block"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                          style={{ color: "#9C9790" }}
                          aria-label="Edit block"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                          </svg>
                        </button>
                        <span className="inline-flex items-center gap-0.5 bg-[#EDE9E0] text-[#9C9790] text-xs font-mono rounded-full px-2 py-0.5">
                          ⏱ {(() => { const m = timeToMinutes(block.end_time) - timeToMinutes(block.start_time); return m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`; })()}
                        </span>
                        {isSkipped ? (
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DOT_COLORS[block.type] ?? "#9C9790" }} />
                        )}
                      </div>
                    </div>

                    {/* Inline expanded details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                        {/* Why */}
                        {block.why && (
                          <div>
                            <p className="uppercase tracking-widest mb-1.5" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>Why you&apos;re doing this</p>
                            <div className="px-3 py-2.5 rounded-lg bg-[#F5EDD0] border-l-[3px] border-[#D4A84B]">
                              <p className="text-sm italic" style={{ color: "#1A1814" }}>{block.why}</p>
                            </div>
                          </div>
                        )}

                        {/* Guidance steps */}
                        {block.guidance && (() => {
                          const lines = block.guidance.split("\n").filter((l) => l.trim());
                          const checks = block.guidance_checks ?? [];
                          return (
                            <div>
                              <p className="uppercase tracking-widest mb-1.5" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>How to do it</p>
                              {lines.length <= 1 ? (
                                <div className="flex items-start gap-2.5">
                                  <button
                                    onClick={() => handleToggleGuidanceCheck(0)}
                                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                                      checks.includes(0)
                                        ? "bg-[#1A1814] border-[#1A1814]"
                                        : "bg-[#F4F1EC] border-[#DDD9CE] hover:border-[#9C9790]"
                                    }`}
                                    aria-label="Toggle step"
                                  >
                                    {checks.includes(0) && (
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </button>
                                  <span className="text-sm" style={{ color: checks.includes(0) ? "#9C9790" : "#1A1814", textDecoration: checks.includes(0) ? "line-through" : "none" }}>
                                    {block.guidance}
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {lines.map((line, i) => (
                                    <div key={i} className="flex items-start gap-2.5">
                                      <button
                                        onClick={() => handleToggleGuidanceCheck(i)}
                                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                                          checks.includes(i)
                                            ? "bg-[#1A1814] border-[#1A1814]"
                                            : "bg-[#F4F1EC] border-[#DDD9CE] hover:border-[#9C9790]"
                                        }`}
                                        aria-label={`Toggle step ${i + 1}`}
                                      >
                                        {checks.includes(i) && (
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                          </svg>
                                        )}
                                      </button>
                                      <span className="text-sm" style={{ color: checks.includes(i) ? "#9C9790" : "#1A1814", textDecoration: checks.includes(i) ? "line-through" : "none" }}>
                                        {line}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Done when */}
                        {block.done_metric && (
                          <div>
                            <p className="uppercase tracking-widest mb-1.5" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>Done when</p>
                            <div className="px-3 py-2.5 rounded-lg bg-[#D8EDDF] border-l-[3px] border-[#3A7D52]">
                              <p className="text-sm" style={{ color: "#1A1814" }}>{block.done_metric}</p>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {block.status === "completed" ? (
                          <p className="text-sm font-medium" style={{ color: "#9C9790" }}>Completed ✓</p>
                        ) : block.status === "skipped" ? (
                          <p className="text-sm font-medium" style={{ color: "#9C9790" }}>Skipped</p>
                        ) : (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleMarkComplete(block)}
                              className="w-full py-2 bg-[#1A1814] text-[#F4F1EC] text-sm font-medium rounded-lg hover:bg-[#333] transition-colors"
                            >
                              Mark complete
                            </button>
                            <div className="flex items-center justify-between pt-0.5">
                              <button
                                onClick={() => handleOpenMove(block)}
                                className="text-xs underline transition-colors hover:opacity-80"
                                style={{ color: "#9C9790" }}
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleSkip(block)}
                                className="text-xs transition-colors hover:text-red-400"
                                style={{ color: "#9C9790" }}
                              >
                                Skip
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Move block modal */}
      {moveBlock && moveForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setMoveBlock(null); setMoveForm(null); } }}
        >
          <div className="bg-[#FDFBF7] border border-[#DDD9CE] w-full sm:max-w-sm sm:rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: "#1A1814" }}>Move block</h2>
              <button
                onClick={() => { setMoveBlock(null); setMoveForm(null); }}
                className="text-lg leading-none transition-colors hover:opacity-60"
                style={{ color: "#9C9790" }}
              >
                ✕
              </button>
            </div>

            <p className="text-sm mb-4 truncate" style={{ color: "#9C9790" }}>{moveBlock.title}</p>

            <div className="mb-4">
              <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>New date</label>
              <input
                type="date"
                value={moveForm.date}
                onChange={(e) => setMoveForm({ ...moveForm, date: e.target.value })}
                className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] focus:outline-none focus:border-[#2A5C8C] transition-colors"
              />
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>New start</label>
                <input
                  type="time"
                  value={moveForm.start_time}
                  onChange={(e) => setMoveForm({ ...moveForm, start_time: e.target.value })}
                  className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] focus:outline-none focus:border-[#2A5C8C] transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>New end</label>
                <input
                  type="time"
                  value={moveForm.end_time}
                  onChange={(e) => setMoveForm({ ...moveForm, end_time: e.target.value })}
                  className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] focus:outline-none focus:border-[#2A5C8C] transition-colors"
                />
              </div>
            </div>

            {/* Real-time conflict warning (same-date only) */}
            {(() => {
              if (!plan || moveForm.date !== plan.date) return null;
              const conflictTitle = getMoveConflict(moveForm.start_time, moveForm.end_time);
              if (!conflictTitle) return null;
              const isRecurring =
                moveBlock.is_recurring ??
                (["routine", "exercise", "meal", "break"] as PlanBlock["type"][]).includes(moveBlock.type);
              return (
                <div className={`mb-4 p-3 rounded-lg text-xs leading-relaxed ${
                  isRecurring
                    ? "bg-[#F5EDD0] border-l-[3px] border-[#D4A84B] text-[#1A1814]"
                    : "bg-[#F4F1EC] text-[#9C9790]"
                }`}>
                  {isRecurring
                    ? <>⚠ Overlaps with &ldquo;{conflictTitle}&rdquo;. Since this is a recurring block, it will be flagged in your end-of-day reflection.</>
                    : <>Overlaps with &ldquo;{conflictTitle}&rdquo;</>}
                </div>
              );
            })()}

            <div className="flex gap-2">
              <button
                onClick={handleSaveMove}
                disabled={savingMove}
                className="flex-1 py-2 bg-[#1A1814] text-[#F4F1EC] text-sm font-medium rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
              >
                {savingMove ? "Moving…" : "Move"}
              </button>
              <button
                onClick={() => { setMoveBlock(null); setMoveForm(null); }}
                className="px-4 py-2 text-sm transition-colors hover:opacity-80"
                style={{ color: "#9C9790" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit block modal */}
      {editBlock && editForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setEditBlock(null); setEditForm(null); } }}
        >
          <div className="bg-[#FDFBF7] border border-[#DDD9CE] w-full h-full sm:h-auto sm:max-w-lg sm:rounded-2xl p-6 overflow-y-auto sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "#1A1814" }}>Edit block</h2>
              <button
                onClick={() => { setEditBlock(null); setEditForm(null); }}
                className="text-lg leading-none transition-colors hover:opacity-60"
                style={{ color: "#9C9790" }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Times */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>Start time</label>
                  <input
                    type="time"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                    className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] focus:outline-none focus:border-[#2A5C8C] transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>End time</label>
                  <input
                    type="time"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                    className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] focus:outline-none focus:border-[#2A5C8C] transition-colors"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] focus:outline-none focus:border-[#2A5C8C] transition-colors"
                />
              </div>

              {/* Why */}
              <div>
                <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>Why you&apos;re doing this</label>
                <textarea
                  value={editForm.why}
                  onChange={(e) => setEditForm({ ...editForm, why: e.target.value })}
                  rows={2}
                  className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] placeholder-[#9C9790] focus:outline-none focus:border-[#2A5C8C] transition-colors resize-none"
                />
              </div>

              {/* Guidance / steps */}
              <div>
                <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>
                  How to do it
                  <span className="ml-1 normal-case" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>(each line becomes a step)</span>
                </label>
                <textarea
                  value={editForm.guidance}
                  onChange={(e) => setEditForm({ ...editForm, guidance: e.target.value })}
                  rows={4}
                  className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] placeholder-[#9C9790] focus:outline-none focus:border-[#2A5C8C] transition-colors resize-none"
                  placeholder="Step 1&#10;Step 2&#10;Step 3"
                />
              </div>

              {/* Done metric */}
              <div>
                <label className="block uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: "#9C9790" }}>Done when</label>
                <textarea
                  value={editForm.done_metric}
                  onChange={(e) => setEditForm({ ...editForm, done_metric: e.target.value })}
                  rows={2}
                  className="w-full text-sm bg-[#F4F1EC] border border-[#DDD9CE] rounded-lg px-3 py-2 text-[#1A1814] placeholder-[#9C9790] focus:outline-none focus:border-[#2A5C8C] transition-colors resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 py-2 bg-[#1A1814] text-[#F4F1EC] text-sm font-medium rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => { setEditBlock(null); setEditForm(null); }}
                className="px-4 py-2 text-sm transition-colors hover:opacity-80"
                style={{ color: "#9C9790" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1A1814] text-[#F4F1EC] text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </AppShell>
  );
}

