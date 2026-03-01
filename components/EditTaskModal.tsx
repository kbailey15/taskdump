"use client";

import { useState } from "react";
import { Task, TaskStatus, TaskArea } from "@/types";

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Done" },
];

const AREAS: { value: TaskArea; label: string }[] = [
  { value: "health", label: "Health" },
  { value: "life_admin", label: "Life admin" },
  { value: "career", label: "Career" },
  { value: "relationships", label: "Relationships" },
  { value: "fun", label: "Fun" },
];

interface EditTaskModalProps {
  task: Task;
  onSave: (updated: Task) => void;
  onClose: () => void;
}

export default function EditTaskModal({ task, onSave, onClose }: EditTaskModalProps) {
  const [titleDisplay, setTitleDisplay] = useState(task.title_display);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [areas, setAreas] = useState<TaskArea[]>(task.areas ?? []);
  const [primaryArea, setPrimaryArea] = useState<TaskArea | "">(task.primary_area ?? "");
  const [nextSteps, setNextSteps] = useState(task.next_steps ?? "");
  const [currentSteps, setCurrentSteps] = useState(task.current_steps ?? "");
  const [notes, setNotes] = useState(task.notes ?? "");
  const [duration, setDuration] = useState(task.duration ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleArea(area: TaskArea) {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
    // Clear primary_area if it was deselected
    if (primaryArea === area) setPrimaryArea("");
  }

  async function handleSave() {
    if (!titleDisplay.trim()) return;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title_display: titleDisplay.trim(),
        due_date: dueDate || null,
        status,
        areas,
        primary_area: primaryArea || null,
        next_steps: nextSteps.trim() || null,
        current_steps: currentSteps.trim() || null,
        notes: notes.trim() || null,
        duration: duration.trim() || null,
      }),
    });

    const data = await res.json();
    if (res.ok && data.task) {
      onSave(data.task);
    } else {
      setError(data.error ?? "Failed to save");
    }
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Edit task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input
              type="text"
              value={titleDisplay}
              onChange={(e) => setTitleDisplay(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Due date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Areas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Areas</label>
            <div className="flex flex-wrap gap-2">
              {AREAS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleArea(value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    areas.includes(value)
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary area */}
          {areas.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Primary area</label>
              <select
                value={primaryArea}
                onChange={(e) => setPrimaryArea(e.target.value as TaskArea | "")}
                className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— none —</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {AREAS.find((x) => x.value === a)?.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Next steps */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Next steps</label>
            <textarea
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Current steps */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current progress</label>
            <textarea
              value={currentSteps}
              onChange={(e) => setCurrentSteps(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duration (HH:MM)</label>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 01:30"
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !titleDisplay.trim()}
            className="text-sm bg-blue-600 text-white rounded-md px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
