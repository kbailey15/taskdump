"use client";

import { useState } from "react";
import { PendingActionResult, Task } from "@/types";

interface ConfirmationPromptProps {
  item: PendingActionResult;
  onConfirm: (id: string, updatedTask: Task) => void;
  onReject: (id: string, newTask: Task) => void;
}

export default function ConfirmationPrompt({
  item,
  onConfirm,
  onReject,
}: ConfirmationPromptProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    const res = await fetch(`/api/confirm-update?id=${item.pending_action_id}`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.task) {
      onConfirm(item.pending_action_id, data.task);
    }
    setLoading(false);
  }

  async function handleReject() {
    setLoading(true);
    const res = await fetch(`/api/reject-update?id=${item.pending_action_id}`, {
      method: "POST",
    });
    const data = await res.json();
    if (data.task) {
      onReject(item.pending_action_id, data.task);
    }
    setLoading(false);
  }

  return (
    <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
      <p className="text-sm font-medium text-yellow-900 mb-2">Possible duplicate detected</p>
      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div>
          <p className="text-gray-500 mb-1">New input:</p>
          <p className="font-medium text-gray-800">
            &ldquo;{item.candidate.title_display}&rdquo;
          </p>
        </div>
        <div>
          <p className="text-gray-500 mb-1">Existing task:</p>
          <p className="font-medium text-gray-800">{item.existing_task.title}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Similarity: {(item.score * 100).toFixed(0)}%
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-1 bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
        >
          Yes, update existing task
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex-1 bg-gray-200 text-gray-800 text-xs py-1.5 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          No, create as new task
        </button>
      </div>
    </div>
  );
}
