"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";
import { DailyPlan, PlanBlock, Task } from "@/types";

interface DeferredItem {
  block: PlanBlock;
  original_date: string;
  plan_id: string;
}

const DEFERRED_STATUSES = new Set(["deferred", "skipped", "dropped"]);

const STATUS_BADGE: Record<string, string> = {
  deferred: "bg-[#F5EDD0] text-[#7A6830] border border-[#D4A84B]",
  skipped: "bg-[#EEECE8] text-[#9C9790] border border-[#DDD9CE]",
  dropped: "bg-red-50 text-red-600 border border-red-200",
};

function formatOriginalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `From ${dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })}`;
}

export default function DeferredPage() {
  const [items, setItems] = useState<DeferredItem[]>([]);
  const [notImportantTasks, setNotImportantTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  // Per-item UI state (deferred blocks)
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Per-task UI state (not important)
  const [niDeletingId, setNiDeletingId] = useState<string | null>(null);
  const [niActionLoading, setNiActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setEmail(user.email ?? null);

      const [plansRes, tasksRes] = await Promise.all([
        supabase
          .from("daily_plans")
          .select("id, date, blocks")
          .eq("user_id", user.id)
          .order("date", { ascending: false }),
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "not_important")
          .order("updated_at", { ascending: false }),
      ]);

      if (plansRes.data) {
        const extracted: DeferredItem[] = [];
        for (const plan of plansRes.data as Pick<DailyPlan, "id" | "date" | "blocks">[]) {
          for (const block of plan.blocks) {
            if (DEFERRED_STATUSES.has(block.status)) {
              extracted.push({
                block,
                original_date: plan.date,
                plan_id: plan.id,
              });
            }
          }
        }
        setItems(extracted);
      }

      setNotImportantTasks((tasksRes.data as Task[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function restoreTask(task: Task) {
    setNiActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "open" }),
      });
      if (!res.ok) throw new Error();
      setNotImportantTasks((prev) => prev.filter((t) => t.id !== task.id));
      setNiDeletingId(null);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setNiActionLoading(false);
    }
  }

  async function permanentlyDeleteTask(task: Task) {
    setNiActionLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNotImportantTasks((prev) => prev.filter((t) => t.id !== task.id));
      setNiDeletingId(null);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setNiActionLoading(false);
    }
  }

  function openReschedule(blockId: string) {
    setReschedulingId(blockId);
    setDeletingId(null);
    setRescheduleDate("");
    setRescheduleTime("");
  }

  function openDelete(blockId: string) {
    setDeletingId(blockId);
    setReschedulingId(null);
  }

  function closeAll() {
    setReschedulingId(null);
    setDeletingId(null);
    setRescheduleDate("");
    setRescheduleTime("");
  }

  async function confirmReschedule(item: DeferredItem) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/deferred", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: item.plan_id,
          block_id: item.block.id,
          date: rescheduleDate || undefined,
          time: rescheduleTime || undefined,
        }),
      });
      if (!res.ok) throw new Error("Reschedule failed");
      setItems((prev) =>
        prev.filter((i) => !(i.block.id === item.block.id && i.plan_id === item.plan_id))
      );
      closeAll();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmDelete(item: DeferredItem) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/deferred", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: item.plan_id,
          block_id: item.block.id,
        }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setItems((prev) =>
        prev.filter((i) => !(i.block.id === item.block.id && i.plan_id === item.plan_id))
      );
      closeAll();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AppShell email={email}>
      <div className="max-w-2xl mx-auto px-6 py-10" style={{ backgroundColor: "#FDFBF7", minHeight: "100vh" }}>
        {/* Heading */}
        <h1
          className="text-3xl mb-6"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#1A1814" }}
        >
          Deferred
        </h1>

        {/* Banner */}
        <div className="bg-[#F5EDD0] border border-[#D4A84B] rounded-lg px-4 py-3 text-sm text-[#7A6830] mb-8">
          Nothing here gets deleted unless you delete it. These are tasks KBLOS moved — we still have them.
        </div>

        {/* Deferred blocks section */}
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: "'DM Sans', sans-serif", color: "#1A1814" }}
        >
          Moved from schedule
        </h2>

        {/* Content */}
        {loading ? (
          <p className="text-sm" style={{ color: "#9C9790" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm mb-10" style={{ color: "#9C9790" }}>
            Nothing deferred yet. When KBLOS moves a block, it will appear here.
          </p>
        ) : (
          <ul className="space-y-3 mb-10">
            {items.map((item) => {
              const isRescheduling = reschedulingId === item.block.id;
              const isDeleting = deletingId === item.block.id;

              return (
                <li
                  key={`${item.plan_id}-${item.block.id}`}
                  className="rounded-lg border border-[#DDD9CE] px-5 py-4"
                  style={{ backgroundColor: "#FDFBF7" }}
                >
                  {/* Status badge */}
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${
                      STATUS_BADGE[item.block.status] ?? STATUS_BADGE.deferred
                    }`}
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {item.block.status}
                  </span>

                  {/* Title */}
                  <p
                    className="font-semibold text-base leading-snug mb-1"
                    style={{ fontFamily: "'DM Sans', sans-serif", color: "#1A1814" }}
                  >
                    {item.block.title}
                  </p>

                  {/* Original date */}
                  <p
                    className="text-xs mb-3"
                    style={{ fontFamily: "'DM Mono', monospace", color: "#9C9790" }}
                  >
                    {formatOriginalDate(item.original_date)}
                  </p>

                  {/* Action buttons */}
                  {!isRescheduling && !isDeleting && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openReschedule(item.block.id)}
                        className="text-xs px-3 py-1.5 rounded text-white transition-opacity hover:opacity-80"
                        style={{ backgroundColor: "#2A5C8C", fontFamily: "'DM Sans', sans-serif" }}
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => openDelete(item.block.id)}
                        className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-[#EEECE8]"
                        style={{
                          borderColor: "#DDD9CE",
                          color: "#9C9790",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {/* Reschedule inline panel */}
                  {isRescheduling && (
                    <div className="mt-3 pt-3 border-t border-[#DDD9CE] space-y-3">
                      <div>
                        <label
                          className="block text-xs mb-1"
                          style={{ color: "#7A6830", fontFamily: "'DM Mono', monospace" }}
                        >
                          Which day? Leave blank and KBLOS will decide
                        </label>
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="text-sm border border-[#DDD9CE] rounded px-2 py-1.5 w-full focus:outline-none focus:border-[#2A5C8C]"
                          style={{ backgroundColor: "#FDFBF7", color: "#1A1814" }}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs mb-1"
                          style={{ color: "#7A6830", fontFamily: "'DM Mono', monospace" }}
                        >
                          Specific time? Leave blank and KBLOS will place it
                        </label>
                        <input
                          type="time"
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="text-sm border border-[#DDD9CE] rounded px-2 py-1.5 w-full focus:outline-none focus:border-[#2A5C8C]"
                          style={{ backgroundColor: "#FDFBF7", color: "#1A1814" }}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => confirmReschedule(item)}
                          disabled={actionLoading}
                          className="text-xs px-3 py-1.5 rounded text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ backgroundColor: "#2A5C8C", fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {actionLoading ? "Rescheduling…" : "Reschedule"}
                        </button>
                        <button
                          onClick={closeAll}
                          disabled={actionLoading}
                          className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-[#EEECE8] disabled:opacity-50"
                          style={{
                            borderColor: "#DDD9CE",
                            color: "#9C9790",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete confirmation */}
                  {isDeleting && (
                    <div className="mt-3 pt-3 border-t border-[#DDD9CE]">
                      <p
                        className="text-sm mb-3"
                        style={{ color: "#1A1814", fontFamily: "'DM Sans', sans-serif" }}
                      >
                        Remove this for good?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmDelete(item)}
                          disabled={actionLoading}
                          className="text-xs px-3 py-1.5 rounded text-white bg-red-500 transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                          {actionLoading ? "Deleting…" : "Yes, remove"}
                        </button>
                        <button
                          onClick={closeAll}
                          disabled={actionLoading}
                          className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-[#EEECE8] disabled:opacity-50"
                          style={{
                            borderColor: "#DDD9CE",
                            color: "#9C9790",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Divider */}
        {!loading && (
          <div className="border-t border-[#DDD9CE] my-8" />
        )}

        {/* Not Important section */}
        {!loading && (
          <>
            <h2
              className="text-base font-semibold mb-1"
              style={{ fontFamily: "'DM Sans', sans-serif", color: "#1A1814" }}
            >
              Marked not important
            </h2>
            <p className="text-xs mb-5" style={{ color: "#9C9790", fontFamily: "'DM Mono', monospace" }}>
              Was this anxiety, or does it actually need to happen?
            </p>

            {notImportantTasks.length === 0 ? (
              <p className="text-sm" style={{ color: "#9C9790" }}>
                Nothing here. Tasks you dismiss as &ldquo;not important&rdquo; will show up for review.
              </p>
            ) : (
              <ul className="space-y-3">
                {notImportantTasks.map((task) => {
                  const isDeleting = niDeletingId === task.id;

                  return (
                    <li
                      key={task.id}
                      className="rounded-lg border border-[#DDD9CE] px-5 py-4"
                      style={{ backgroundColor: "#FDFBF7" }}
                    >
                      <p
                        className="font-semibold text-base leading-snug mb-3"
                        style={{ fontFamily: "'DM Sans', sans-serif", color: "#1A1814" }}
                      >
                        {task.title_display}
                      </p>

                      {!isDeleting && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => restoreTask(task)}
                            disabled={niActionLoading}
                            className="text-xs px-3 py-1.5 rounded text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                            style={{ backgroundColor: "#2A5C8C", fontFamily: "'DM Sans', sans-serif" }}
                          >
                            {niActionLoading ? "Restoring…" : "Actually needed"}
                          </button>
                          <button
                            onClick={() => setNiDeletingId(task.id)}
                            disabled={niActionLoading}
                            className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-[#EEECE8] disabled:opacity-50"
                            style={{
                              borderColor: "#DDD9CE",
                              color: "#9C9790",
                              fontFamily: "'DM Sans', sans-serif",
                            }}
                          >
                            Delete for good
                          </button>
                        </div>
                      )}

                      {isDeleting && (
                        <div className="pt-1">
                          <p
                            className="text-sm mb-3"
                            style={{ color: "#1A1814", fontFamily: "'DM Sans', sans-serif" }}
                          >
                            Remove this permanently?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => permanentlyDeleteTask(task)}
                              disabled={niActionLoading}
                              className="text-xs px-3 py-1.5 rounded text-white bg-red-500 transition-opacity hover:opacity-80 disabled:opacity-50"
                              style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                              {niActionLoading ? "Deleting…" : "Yes, remove"}
                            </button>
                            <button
                              onClick={() => setNiDeletingId(null)}
                              disabled={niActionLoading}
                              className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-[#EEECE8] disabled:opacity-50"
                              style={{
                                borderColor: "#DDD9CE",
                                color: "#9C9790",
                                fontFamily: "'DM Sans', sans-serif",
                              }}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
