"use client";

import { useState } from "react";
import { ParseResult, Task } from "@/types";
import ResultsPanel from "./ResultsPanel";

interface TaskDumpInputProps {
  onNewTask: (task: Task) => void;
  onUpdatedTask: (task: Task) => void;
}

export default function TaskDumpInput({ onNewTask, onUpdatedTask }: TaskDumpInputProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/parse-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? "Something went wrong");
    } else {
      setResult(data as ParseResult);
      setText("");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your tasks here… e.g. &quot;Schedule dentist appointment next week, finish quarterly report by Friday, call mom&quot;"
          rows={5}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Parsing…" : "Parse tasks"}
          </button>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      </form>

      {result && (
        <ResultsPanel
          result={result}
          onNewTask={onNewTask}
          onUpdatedTask={onUpdatedTask}
        />
      )}
    </div>
  );
}
