"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/components/AppShell";

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export default function TodayPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMinute, setCurrentMinute] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setEmail(user.email ?? null);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      setCurrentMinute(now.getHours() * 60 + now.getMinutes());
    }
    updateTime();
    const interval = setInterval(updateTime, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Scroll current hour into view once loaded
  useEffect(() => {
    if (loading || !scrollRef.current) return;
    const currentHour = Math.floor(currentMinute / 60);
    const rowHeight = 80;
    const scrollTarget = currentHour * rowHeight - 120;
    scrollRef.current.scrollTop = Math.max(0, scrollTarget);
  }, [loading, currentMinute]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <AppShell email={email}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-gray-900">Today</h1>
          <p className="text-xs text-gray-500 mt-0.5">{today}</p>
        </div>

        <div
          ref={scrollRef}
          className="relative bg-white border border-gray-200 rounded-lg overflow-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          {/* Current time indicator */}
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: `${(currentMinute / 1440) * 100}%` }}
          >
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          </div>

          {/* Hour rows */}
          {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
            <div
              key={hour}
              className="flex border-b border-gray-100 last:border-b-0"
              style={{ minHeight: "80px" }}
            >
              <div className="w-16 flex-shrink-0 px-3 pt-2">
                <span className="text-xs text-gray-400">{formatHour(hour)}</span>
              </div>
              <div className="flex-1 border-l border-gray-100" />
            </div>
          ))}
        </div>
      </main>
    </AppShell>
  );
}
