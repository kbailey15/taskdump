import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TaskStatus } from "@/types";

const VALID_STATUSES: TaskStatus[] = ["open", "in_progress", "waiting", "completed"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { status?: TaskStatus };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: body.status })
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[tasks/[id]] update error:", updateError);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }

  const { data: updated } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", params.id)
    .single();

  return NextResponse.json({ task: updated });
}
