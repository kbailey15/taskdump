import { z } from "zod";

const TaskAreaEnum = z.enum(["health", "life_admin", "career", "relationships", "fun"]);
const TaskStatusEnum = z.enum(["open", "in_progress", "waiting", "completed"]);
const ConfidenceEnum = z.enum(["high", "medium", "low"]);

export const TaskCandidateSchema = z.object({
  title_display: z.string().min(1),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  duration: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  current_steps: z.string().nullable(),
  status: TaskStatusEnum,
  next_steps: z.string().nullable(),
  notes: z.string().nullable(),
  areas: z.array(TaskAreaEnum),
  primary_area: TaskAreaEnum.nullable(),
  confidence: ConfidenceEnum,
});

export const ClaudeResponseSchema = z.object({
  tasks: z.array(TaskCandidateSchema),
  clarifications: z.array(z.string()).default([]),
});

export type ClaudeResponseRaw = z.infer<typeof ClaudeResponseSchema>;
export type TaskCandidateRaw = z.infer<typeof TaskCandidateSchema>;
