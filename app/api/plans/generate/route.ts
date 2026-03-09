import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { date: string; comments?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { date, comments } = body;
  if (!date) {
    return NextResponse.json({ error: "Missing required field: date" }, { status: 400 });
  }

  // Fetch user profile
  const { data: profileRow } = await supabase
    .from("user_profile")
    .select("data")
    .eq("user_id", user.id)
    .single();

  if (!profileRow?.data) {
    return NextResponse.json({ error: "Profile not set up yet." }, { status: 400 });
  }

  const profileData = profileRow.data;

  // Fetch open and in-progress tasks
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, due_date, duration, status, areas, next_steps, notes")
    .eq("user_id", user.id)
    .in("status", ["open", "in_progress"]);

  if (tasksError) {
    console.error("[plans/generate] tasks fetch error:", tasksError);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  // Derive day of week from date
  const dayOfWeek = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
  });

  const systemMessage = `You are KBLOS, a personal chief of staff and life operating system. Your job is to generate a realistic, personalized daily plan. You must return ONLY a valid JSON array. No preamble, no explanation, no markdown fences. Just the raw JSON array starting with [ and ending with ].

Each block must use the fields "start_time" and "end_time" (not "start" or "end"). Each block must use the field name "title" (not "activity" or any other name).

Valid block types (use exactly as written):
- deep_work — focused output-driven work sessions (business, building, writing, strategy)
- commitment — fixed standing obligations that are non-negotiable (gym on scheduled days, therapy, standing meetings)
- personal_growth — journaling, reflection, reading, therapy work, learning
- routine — logistics and daily maintenance (meals, getting ready, commute, wind-down)
- exercise — unscheduled or spontaneous physical activity
- life_admin — tasks like insurance calls, booking flights, errands
- admin — email, scheduling, planning, low-focus work
- break — intentional rest and recharge time
- meeting — calls and meetings with other people
- meal — dedicated meal times (if you want to separate from routine)`;

  const userMessage = `Today is ${date} (${dayOfWeek}).

USER PROFILE:
${JSON.stringify(profileData, null, 2)}

OPEN TASKS:
${JSON.stringify(tasks, null, 2)}

GENERATE a complete time-blocked day plan for ${date}.

Rules:
- Start from the user's wake_up_time, end at lights_out_time (both in their schedule section)
- Standing commitments from their profile are fixed blocks — include them exactly
- Schedule deep work tasks during their best deep_work_time window
- Schedule admin and life admin tasks during their admin_time window
- Include all meals, breaks, and wind-down from their daily schedule
- Prioritize tasks by due_date (soonest first), then by area (match their time budget priorities)
- The "why" field must reference the user's specific goals or 90-day focus — never be generic
- The "guidance" field must be concrete and actionable — for life admin tasks include exactly what to do, what to say, what to look for
- The "done_metric" field must be tangible — not "feel clearer" but "you have X written/sent/completed"
- Leave 5-10 minute buffers between blocks
- Do not schedule more than 5 hours of focused deep work in a single day
${comments ? `\nUSER ADJUSTMENTS: ${comments}` : ""}

Return only the raw JSON array of blocks. No other text.`;

  let rawText = "";
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: userMessage }],
      system: systemMessage,
    });

    rawText = (response.content[0] as { type: string; text: string }).text;

    // Strip accidental markdown fences
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    const normalized = parsed.map((block: Record<string, unknown>, i: number) => ({
      id: (block.id as string) ?? `block_${i + 1}`,
      start_time: (block.start_time ?? block.start) as string,
      end_time: (block.end_time ?? block.end) as string,
      title: (block.title ?? block.activity ?? block.name) as string,
      type: (block.type ?? block.block_type ?? "routine") as string,
      task_id: (block.task_id ?? null) as string | null,
      why: (block.why ?? "") as string,
      guidance: (block.guidance ?? "") as string,
      done_metric: (block.done_metric ?? block.doneMetric ?? "") as string,
      status: "pending" as const,
    }));

    // Fetch existing plan version
    const { data: existing } = await supabase
      .from("daily_plans")
      .select("version")
      .eq("user_id", user.id)
      .eq("date", date)
      .single();

    const record = {
      id: `${user.id}_${date}`,
      user_id: user.id,
      date,
      blocks: normalized,
      comments: comments ?? null,
      version: (existing?.version ?? 0) + 1,
    };

    const { data: saved, error: upsertError } = await supabase
      .from("daily_plans")
      .upsert(record, { onConflict: "user_id,date" })
      .select()
      .single();

    if (upsertError) {
      console.error("[plans/generate] upsert error:", upsertError);
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }

    return NextResponse.json({ plan: saved });
  } catch (err) {
    console.error("[plans/generate] error:", err);
    return NextResponse.json(
      { error: "Plan generation failed", raw: rawText },
      { status: 500 }
    );
  }
}
