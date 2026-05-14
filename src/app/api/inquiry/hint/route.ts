import { NextResponse } from "next/server";

import {
  buildFallbackInquiryHint,
  normalizeInquiryHint,
  repairInquiryHintIfNeeded,
  streamInquiryHint,
} from "@/lib/ai/inquiryHint";
import {
  prepareInquiryHintContext,
  saveInquiryHintLog,
} from "@/lib/inquiry/get-hint";

const encoder = new TextEncoder();

function encodeEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function saveHintOrThrow(input: {
  activityId: string;
  aiHint: string;
  step: number;
  studentId: string;
  studentText: string;
}) {
  const { error } = await saveInquiryHintLog(input);

  if (error) {
    throw new Error(error.message);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prepared = await prepareInquiryHintContext(body);

    if (!prepared.ok) {
      return NextResponse.json(prepared.result, { status: 400 });
    }

    const { context } = prepared;
    const stream = new ReadableStream({
      async start(controller) {
        let completedHint = "";

        controller.enqueue(
          encodeEvent("meta", {
            ok: true,
            step: context.step,
            studentMessage: "힌트를 받았어요.",
          }),
        );

        try {
          for await (const chunk of streamInquiryHint({
            analysis: context.analysis,
            materialText: context.materialText,
            previousTurns: context.previousTurns,
            step: context.step,
            studentText: context.studentText,
          })) {
            completedHint += chunk;
            controller.enqueue(encodeEvent("delta", { text: chunk }));
          }

          const normalizedHint = normalizeInquiryHint(completedHint, {
            analysis: context.analysis,
            materialText: context.materialText,
            previousTurns: context.previousTurns,
            step: context.step,
            studentText: context.studentText,
          });

          const repairedHint = await repairInquiryHintIfNeeded(
            normalizedHint,
            {
              analysis: context.analysis,
              materialText: context.materialText,
              previousTurns: context.previousTurns,
              step: context.step,
              studentText: context.studentText,
            },
          );

          if (repairedHint !== completedHint.trim()) {
            completedHint = repairedHint;
            controller.enqueue(encodeEvent("replace", { text: repairedHint }));
          } else {
            completedHint = completedHint.trim();
          }
        } catch (error) {
          console.error(
            "Gemini 탐구 질문 스트리밍 실패. fallback 힌트로 진행합니다.",
            error,
          );
          completedHint = buildFallbackInquiryHint({
            analysis: context.analysis,
            materialText: context.materialText,
            previousTurns: context.previousTurns,
            step: context.step,
            studentText: context.studentText,
          });
          controller.enqueue(encodeEvent("replace", { text: completedHint }));
        }

        try {
          await saveHintOrThrow({
            activityId: context.activityId,
            aiHint: completedHint,
            step: context.step,
            studentId: context.studentId,
            studentText: context.studentText,
          });

          controller.enqueue(
            encodeEvent("done", {
              aiHint: completedHint,
              ok: true,
              step: context.step,
              studentMessage: "힌트를 받았어요.",
            }),
          );
        } catch (error) {
          console.error("탐구 질문 힌트 저장 실패.", error);
          controller.enqueue(
            encodeEvent("error", {
              aiHint: completedHint,
              ok: false,
              step: context.step,
              studentMessage: "힌트를 저장하지 못했어요. 다시 해 주세요.",
            }),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      {
        aiHint: "",
        ok: false,
        step: 0,
        studentMessage: "힌트를 받지 못했어요. 다시 해 주세요.",
      },
      { status: 500 },
    );
  }
}
