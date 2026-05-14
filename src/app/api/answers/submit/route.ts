import { NextResponse } from "next/server";

import { submitAnswer } from "@/lib/answers/submit-answer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await submitAnswer(body);

    return NextResponse.json(result, { status: result.accepted ? 200 : 400 });
  } catch {
    return NextResponse.json(
      {
        accepted: false,
        reason: "server_error",
        studentMessage: "답변을 저장하지 못했어요. 다시 해 주세요.",
      },
      { status: 500 },
    );
  }
}
