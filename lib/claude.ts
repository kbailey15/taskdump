import Anthropic from "@anthropic-ai/sdk";
import { ClaudeResponseSchema } from "@/lib/schemas";
import { TaskCandidate } from "@/types";
import { cleanTitle, normalizeTitle } from "@/lib/normalize";

const client = new Anthropic();

const LOCATION = "Boston, MA, USA (America/New_York timezone)";

function buildSystemPrompt(): string {
  const now = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `You are a task parser. The user will paste freeform text containing one or more tasks. Your job is to extract structured task records from the input.

Today's date: ${now}
User location: ${LOCATION}
Use these to resolve all relative date references (e.g. "next week", "this Sunday", "by Friday", "in two weeks"). Always output resolved YYYY-MM-DD dates — never leave due_date null just because the input used relative language.

Output a JSON object with this shape:
{
  "tasks": [
    {
      "title_display": "string — the raw task phrasing from the user's input",
      "due_date": "YYYY-MM-DD or null",
      "duration": "HH:MM or null — only if explicitly stated",
      "current_steps": "string or null — current progress notes",
      "status": "open|in_progress|waiting|completed",
      "next_steps": "string or null",
      "notes": "string or null — user-facing notes only",
      "areas": ["health"|"life_admin"|"career"|"relationships"|"fun"],
      "primary_area": "string or null — single most relevant area",
      "confidence": "high|medium|low"
    }
  ],
  "clarifications": ["string — only for genuinely unparseable fragments"]
}

Rules:
- Always output a candidate when the input is plausibly a task — err toward including, not excluding
- confidence=low when very vague (e.g. "do it", "call them") — the UI will prompt the user
- confidence=medium when moderately clear; high when unambiguous
- Never hallucinate fields — leave null if not stated
- Do not compute title, title_normalized — the server does that
- clarifications: only for single words, gibberish, or truly unparseable fragments
- areas enum: health, life_admin, career, relationships, fun
- status default: open
- Output ONLY valid JSON. No markdown, no code fences, no explanation.`;
}

export async function parseTasks(input: string): Promise<{
  candidates: TaskCandidate[];
  clarifications: string[];
  error?: string;
}> {
  let rawContent = "";

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: input }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return {
        candidates: [],
        clarifications: [],
        error: "I couldn't parse that — please reformat or try again",
      };
    }

    rawContent = textBlock.text;
    // Strip markdown code fences if Claude wraps the response
    const jsonText = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const parsed = JSON.parse(jsonText);
    const validated = ClaudeResponseSchema.parse(parsed);

    // Server-side field computation
    const candidates: TaskCandidate[] = validated.tasks.map((t) => ({
      ...t,
      title: cleanTitle(t.title_display),
      title_normalized: normalizeTitle(t.title_display),
    }));

    return { candidates, clarifications: validated.clarifications };
  } catch (err) {
    // Log raw response server-side only, never expose to client
    console.error("[claude.ts] Parse error:", err);
    if (rawContent) {
      console.error("[claude.ts] Raw response:", rawContent);
    }
    return {
      candidates: [],
      clarifications: [],
      error: "I couldn't parse that — please reformat or try again",
    };
  }
}
