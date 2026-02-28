"use client";

import { useState } from "react";
import { ParseResult, Task, PendingActionResult, TaskCandidate } from "@/types";
import TaskCard from "./TaskCard";
import ConfirmationPrompt from "./ConfirmationPrompt";

interface ResultsPanelProps {
  result: ParseResult;
  onNewTask: (task: Task) => void;
  onUpdatedTask: (task: Task) => void;
}

export default function ResultsPanel({
  result,
  onNewTask,
  onUpdatedTask,
}: ResultsPanelProps) {
  const [pendingItems, setPendingItems] = useState<PendingActionResult[]>(
    result.pending
  );
  const [unconfirmedItems, setUnconfirmedItems] = useState<TaskCandidate[]>(
    result.unconfirmed
  );
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  function handleConfirm(id: string, updatedTask: Task) {
    setPendingItems((prev) => prev.filter((p) => p.pending_action_id !== id));
    onUpdatedTask(updatedTask);
  }

  function handleReject(id: string, newTask: Task) {
    setPendingItems((prev) => prev.filter((p) => p.pending_action_id !== id));
    onNewTask(newTask);
  }

  async function handleSaveUnconfirmed(candidate: TaskCandidate, idx: number) {
    setSavingIdx(idx);
    const res = await fetch("/api/parse-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate }),
    });
    const data = await res.json();
    if (data.created?.[0]) {
      setUnconfirmedItems((prev) => prev.filter((_, i) => i !== idx));
      onNewTask(data.created[0]);
    }
    setSavingIdx(null);
  }

  function handleDiscardUnconfirmed(idx: number) {
    setUnconfirmedItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const hasContent =
    result.created.length > 0 ||
    result.updated.length > 0 ||
    pendingItems.length > 0 ||
    unconfirmedItems.length > 0 ||
    result.clarifications.length > 0;

  if (!hasContent) return null;

  return (
    <div className="space-y-6">
      {result.created.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-green-700 mb-2">
            Created ({result.created.length})
          </h3>
          <div className="space-y-2">
            {result.created.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      )}

      {result.updated.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-blue-700 mb-2">
            Updated ({result.updated.length})
          </h3>
          <div className="space-y-2">
            {result.updated.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      )}

      {pendingItems.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-yellow-700 mb-2">
            Possible duplicates ({pendingItems.length})
          </h3>
          <div className="space-y-2">
            {pendingItems.map((item) => (
              <ConfirmationPrompt
                key={item.pending_action_id}
                item={item}
                onConfirm={handleConfirm}
                onReject={handleReject}
              />
            ))}
          </div>
        </section>
      )}

      {unconfirmedItems.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">
            Unconfirmed ({unconfirmedItems.length})
          </h3>
          <div className="space-y-2">
            {unconfirmedItems.map((candidate, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50"
              >
                <p className="text-sm text-gray-700 mb-2">
                  Is this a task?{" "}
                  <span className="font-medium">
                    &ldquo;{candidate.title_display}&rdquo;
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveUnconfirmed(candidate, idx)}
                    disabled={savingIdx === idx}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingIdx === idx ? "Saving…" : "Yes, save it"}
                  </button>
                  <button
                    onClick={() => handleDiscardUnconfirmed(idx)}
                    className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300"
                  >
                    No, discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {result.clarifications.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-red-600 mb-2">
            Couldn&apos;t parse
          </h3>
          <ul className="list-disc list-inside space-y-1">
            {result.clarifications.map((c, i) => (
              <li key={i} className="text-sm text-gray-600 italic">
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
