"use client";

import { useState } from "react";
import { Task, TaskStatus } from "@/types";
import EditTaskModal from "./EditTaskModal";

const STATUS_CYCLE: TaskStatus[] = ["open", "in_progress", "waiting", "completed"];

const STATUS_COLORS: Record<TaskStatus, string> = {
  open: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  in_progress: "bg-blue-100 text-blue-700 hover:bg-blue-200",
  waiting: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200",
  completed: "bg-green-100 text-green-700 hover:bg-green-200",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "open",
  in_progress: "in progress",
  waiting: "waiting",
  completed: "done",
};

function getDueDateMeta(dueDate: string | null): {
  label: string;
  className: string;
} | null {
  if (!dueDate) return null;

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const daysUntil = Math.round(
    (new Date(dueDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) {
    return { label: `Overdue · ${dueDate}`, className: "text-red-600 font-medium" };
  }
  if (daysUntil === 0) {
    return { label: `Due today · ${dueDate}`, className: "text-red-500 font-medium" };
  }
  if (daysUntil <= 3) {
    return { label: `Due soon · ${dueDate}`, className: "text-yellow-600 font-medium" };
  }
  return { label: `Due ${dueDate}`, className: "text-gray-500" };
}

interface TaskCardProps {
  task: Task;
  onStatusChange?: (updated: Task) => void;
  onEdit?: (updated: Task) => void;
  onDelete?: (id: string) => void;
}

export default function TaskCard({ task, onStatusChange, onEdit, onDelete }: TaskCardProps) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  async function cycleStatus() {
    const next =
      STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
    setSaving(true);
    setStatus(next);

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    if (res.ok) {
      const data = await res.json();
      onStatusChange?.(data.task);
    } else {
      setStatus(status);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete?.(task.id);
    } else {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function dismissAsNotImportant(taskId: string) {
    setDismissing(true);
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      onDelete?.(taskId);
    } else {
      setDismissing(false);
    }
  }

  function handleSaved(updated: Task) {
    setShowEdit(false);
    setStatus(updated.status);
    onEdit?.(updated);
  }

  const dueMeta = getDueDateMeta(task.due_date);

  return (
    <>
      <div
        className={`border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow ${
          status === "completed" ? "border-gray-100 opacity-60" : "border-gray-200"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`font-medium text-sm ${
              status === "completed" ? "line-through text-gray-400" : "text-gray-900"
            }`}
          >
            {task.title}
          </h3>
          <button
            onClick={cycleStatus}
            disabled={saving}
            title="Click to cycle status"
            className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer disabled:cursor-wait ${STATUS_COLORS[status]}`}
          >
            {STATUS_LABELS[status]}
          </button>
        </div>

        {dueMeta && (
          <p className={`text-xs mt-1 ${dueMeta.className}`}>{dueMeta.label}</p>
        )}

        {task.primary_area && (
          <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
            {task.primary_area.replace("_", " ")}
          </span>
        )}

        {task.next_steps && (
          <p className="text-xs text-gray-600 mt-2">
            <span className="font-medium">Next:</span> {task.next_steps}
          </p>
        )}

        {task.notes && (
          <p className="text-xs text-gray-500 mt-1 italic">{task.notes}</p>
        )}

        {/* Actions */}
        <div className="mt-3 pt-2 border-t border-gray-50 space-y-2">
          <div className="flex items-center justify-end gap-3">
            {confirmDelete ? (
              <>
                <span className="text-xs text-gray-500">Delete this task?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowEdit(true)}
                  className="text-xs text-gray-400 hover:text-gray-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-gray-400 hover:text-red-600"
                >
                  Delete
                </button>
              </>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => dismissAsNotImportant(task.id)}
              disabled={dismissing}
              className="text-xs text-gray-300 hover:text-gray-500 italic disabled:opacity-50"
            >
              {dismissing ? "Dismissing…" : "Not actually important"}
            </button>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditTaskModal
          task={{ ...task, status }}
          onSave={handleSaved}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
