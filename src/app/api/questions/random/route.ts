import { NextResponse } from "next/server";

import { getRandomQuestion } from "@/lib/questions/random-question";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const result = await getRandomQuestion({
    activityId: searchParams.get("activityId") ?? "",
    studentId: searchParams.get("studentId") ?? "",
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
