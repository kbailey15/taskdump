"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskStatus, TaskArea } from "@/types";
import TaskDumpInput from "@/components/TaskDumpInput";
import TaskList from "@/components/TaskList";

type StatusFilter = "all" | TaskStatus;
type AreaFilter = "all" | TaskArea;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Done" },
  { value: "all", label: "All" },
];

const AREA_FILTERS: { value: AreaFilter; label: string }[] = [
  { value: "all", label: "All areas" },
  { value: "health", label: "Health" },
  { value: "life_admin", label: "Life admin" },
  { value: "career", label: "Career" },
  { value: "relationships", label: "Relationships" },
  { value: "fun", label: "Fun" },
];

function filterPill(isActive: boolean) {
  return `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    isActive
      ? "bg-gray-900 text-white border-gray-900"
      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
  }`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [dueTodayOnly, setDueTodayOnly] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email ?? null);
        const { data } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setTasks((data as Task[]) ?? []);
      }
      setLoading(false);
    }
    load();
  }, []);

  function handleNewTask(task: Task) {
    setTasks((prev) => [task, ...prev]);
  }

  function handleUpdatedTask(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleDeleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dueTodayCount = tasks.filter((t) => t.due_date === today).length;

  const filtered = tasks
    .filter((t) => {
      const statusMatch = statusFilter === "all" || t.status === statusFilter;
      const areaMatch = areaFilter === "all" || (t.areas ?? []).includes(areaFilter);
      const dueTodayMatch = !dueTodayOnly || t.due_date === today;
      return statusMatch && areaMatch && dueTodayMatch;
    })
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1;
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

  // Count helpers — each dimension filters against the OTHER active filter
  function statusCount(s: StatusFilter) {
    const base = areaFilter === "all" ? tasks : tasks.filter((t) => (t.areas ?? []).includes(areaFilter));
    return s === "all" ? base.length : base.filter((t) => t.status === s).length;
  }

  function areaCount(a: AreaFilter) {
    const base = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);
    return a === "all" ? base.length : base.filter((t) => (t.areas ?? []).includes(a)).length;
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
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">TaskDump</h1>
        <div className="flex items-center gap-3">
          {email && (
            <span className="text-xs text-gray-500 hidden sm:block">{email}</span>
          )}
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Dump your tasks</h2>
          <TaskDumpInput onNewTask={handleNewTask} onUpdatedTask={handleUpdatedTask} />
        </section>

        <section>
          <div className="mb-4 space-y-2">
            {/* Status filters */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map(({ value, label }) => {
                const count = statusCount(value);
                return (
                  <button
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    className={filterPill(statusFilter === value)}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-1 ${statusFilter === value ? "opacity-70" : "opacity-50"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Area filters */}
            <div className="flex gap-1 flex-wrap">
              {AREA_FILTERS.map(({ value, label }) => {
                const count = areaCount(value);
                return (
                  <button
                    key={value}
                    onClick={() => setAreaFilter(value)}
                    className={filterPill(areaFilter === value)}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-1 ${areaFilter === value ? "opacity-70" : "opacity-50"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Due today filter */}
            <div className="flex gap-1">
              <button
                onClick={() => setDueTodayOnly((v) => !v)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  dueTodayOnly
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
                }`}
              >
                Due today
                {dueTodayCount > 0 && (
                  <span className={`ml-1 ${dueTodayOnly ? "opacity-70" : "opacity-50"}`}>{dueTodayCount}</span>
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            {filtered.length} of {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>

          <TaskList
            tasks={filtered}
            onStatusChange={handleUpdatedTask}
            onEdit={handleUpdatedTask}
            onDelete={handleDeleteTask}
          />
        </section>
      </main>
    </div>
  );
}
