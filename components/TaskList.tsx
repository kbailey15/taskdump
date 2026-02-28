import { Task } from "@/types";
import TaskCard from "./TaskCard";

interface TaskListProps {
  tasks: Task[];
  onStatusChange?: (updated: Task) => void;
}

export default function TaskList({ tasks, onStatusChange }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">
        No tasks yet. Paste some text above to get started.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onStatusChange={onStatusChange} />
      ))}
    </div>
  );
}
