"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, UserSettings } from "@/types";
import TaskDumpInput from "@/components/TaskDumpInput";
import TaskList from "@/components/TaskList";
import AppShell from "@/components/AppShell";

function filterPill(isActive: boolean) {
  return `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    isActive
      ? "bg-gray-900 text-white border-gray-900"
      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700"
  }`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [dueTodayOnly, setDueTodayOnly] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setEmail(user.email ?? null);
        const [tasksRes, settingsRes] = await Promise.all([
          supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .neq("status", "not_important")
            .order("created_at", { ascending: false }),
          fetch("/api/settings"),
        ]);
        setTasks((tasksRes.data as Task[]) ?? []);
        if (settingsRes.ok) {
          const data: UserSettings = await settingsRes.json();
          setSettings(data);
        }
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

  // Build filter arrays from settings, appending "All" at the end
  const statusFilters: { id: string; label: string }[] = [
    ...(settings?.custom_statuses.filter((s) => !s.hidden) ?? [
      { id: "open", label: "Open" },
      { id: "in_progress", label: "In progress" },
      { id: "waiting", label: "Waiting" },
      { id: "completed", label: "Done" },
    ]),
    { id: "all", label: "All" },
  ];

  const areaFilters: { id: string; label: string }[] = [
    ...(settings?.custom_areas ?? [
      { id: "health", label: "Health" },
      { id: "life_admin", label: "Life admin" },
      { id: "career", label: "Career" },
      { id: "relationships", label: "Relationships" },
      { id: "fun", label: "Fun" },
    ]),
    { id: "all", label: "All areas" },
  ];

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
  const dueTodayCount = tasks.filter((t) => t.due_date === today).length;

  const filtered = tasks
    .filter((t) => {
      const statusMatch = statusFilter === "all" || t.status === statusFilter;
      const areaMatch = areaFilter === "all" || (t.areas ?? []).includes(areaFilter as never);
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
  function statusCount(id: string) {
    const base =
      areaFilter === "all" ? tasks : tasks.filter((t) => (t.areas ?? []).includes(areaFilter as never));
    return id === "all" ? base.length : base.filter((t) => t.status === id).length;
  }

  function areaCount(id: string) {
    const base =
      statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);
    return id === "all" ? base.length : base.filter((t) => (t.areas ?? []).includes(id as never)).length;
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
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Dump your tasks</h2>
          <TaskDumpInput onNewTask={handleNewTask} onUpdatedTask={handleUpdatedTask} />
        </section>

        <section>
          <div className="mb-4 space-y-2">
            {/* Status filters */}
            <div className="flex gap-1 flex-wrap">
              {statusFilters.map(({ id, label }) => {
                const count = statusCount(id);
                return (
                  <button
                    key={id}
                    onClick={() => setStatusFilter(id)}
                    className={filterPill(statusFilter === id)}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-1 ${statusFilter === id ? "opacity-70" : "opacity-50"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Area filters */}
            <div className="flex gap-1 flex-wrap">
              {areaFilters.map(({ id, label }) => {
                const count = areaCount(id);
                return (
                  <button
                    key={id}
                    onClick={() => setAreaFilter(id)}
                    className={filterPill(areaFilter === id)}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`ml-1 ${areaFilter === id ? "opacity-70" : "opacity-50"}`}>
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
    </AppShell>
  );
}
