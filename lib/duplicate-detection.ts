import { distance } from "fastest-levenshtein";
import { Task, TaskCandidate, TaskArea } from "@/types";

export type DuplicateConfidence = "high" | "medium" | "low";

export interface DuplicateResult {
  confidence: DuplicateConfidence;
  score: number;
  matchedTask: Task | null;
}

/**
 * Compute normalized Levenshtein similarity between two strings.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance(a, b) / maxLen;
}

/**
 * Check if two task area arrays have any overlap.
 */
function areasOverlap(a: TaskArea[] | null, b: TaskArea[] | null): boolean {
  if (!a || !b || a.length === 0 || b.length === 0) return false;
  return a.some((area) => b.includes(area));
}

/**
 * Count shared tokens between two normalized title strings.
 */
function sharedTokenCount(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  let count = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) count++;
  });
  return count;
}

/**
 * Find the best duplicate match for a candidate among existing tasks.
 * Returns high/medium/low confidence and the matched task (if any).
 */
export function findDuplicate(
  candidate: TaskCandidate,
  existingTasks: Task[]
): DuplicateResult {
  if (!candidate.title_normalized || existingTasks.length === 0) {
    return { confidence: "low", score: 0, matchedTask: null };
  }

  let bestScore = 0;
  let bestTask: Task | null = null;

  for (const task of existingTasks) {
    const score = similarity(candidate.title_normalized!, task.title_normalized);
    if (score > bestScore) {
      bestScore = score;
      bestTask = task;
    }
  }

  if (!bestTask || bestScore < 0.80) {
    return { confidence: "low", score: bestScore, matchedTask: null };
  }

  if (bestScore >= 0.92) {
    return { confidence: "high", score: bestScore, matchedTask: bestTask };
  }

  // Medium range: 0.80–0.92 — require additional signal
  const candidateAreas = candidate.areas ?? [];
  const taskAreas = bestTask.areas ?? [];
  const overlap = areasOverlap(candidateAreas, taskAreas);
  const shared = sharedTokenCount(candidate.title_normalized!, bestTask.title_normalized);

  if (overlap || shared >= 2) {
    return { confidence: "medium", score: bestScore, matchedTask: bestTask };
  }

  return { confidence: "low", score: bestScore, matchedTask: null };
}
