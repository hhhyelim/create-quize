import { NextResponse } from "next/server";

import { generateInquiryHintStrict } from "@/lib/ai/inquiryHint";
import {
  prepareInquiryHintContext,
  saveInquiryHintLog,
} from "@/lib/inquiry/get-hint";

const encoder = new TextEncoder();
const hintSavedMessage = "힌트를 받았어요.";
const hintSaveFailedMessage =
  "힌트를 저장하지 못했어요. 다시 해 주세요.";
const hintLoadFailedMessage = "힌트를 받을 수 없어요. 다시 해 주세요.";
const geminiFailedMessage =
  "Gemini 응답을 끝까지 받지 못했어요. 잠시 후 다시 시도해 주세요.";

function encodeEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function saveHintOrThrow(input: {
  activityId: string;
  aiHint: string;
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
        function enqueue(event: string, data: unknown) {
          controller.enqueue(encodeEvent(event, data));
        }

        try {
          enqueue("meta", {
            ok: true,
            studentMessage: hintSavedMessage,
          });

          const aiHint = await generateInquiryHintStrict({
            analysis: context.analysis,
            materialText: context.materialText,
            previousTurns: context.previousTurns,
            studentText: context.studentText,
          });

          enqueue("delta", { text: aiHint });

          try {
            await saveHintOrThrow({
              activityId: context.activityId,
              aiHint,
              studentId: context.studentId,
              studentText: context.studentText,
            });

            enqueue("done", {
              aiHint,
              ok: true,
              studentMessage: hintSavedMessage,
            });
          } catch (error) {
            console.error("Failed to save inquiry hint.", error);
            enqueue("error", {
              aiHint,
              ok: false,
              studentMessage: hintSaveFailedMessage,
            });
          }
        } catch (error) {
          console.error("Gemini inquiry hint failed.", error);
          enqueue("error", {
            aiHint: "",
            ok: false,
            studentMessage: geminiFailedMessage,
          });
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
        studentMessage: hintLoadFailedMessage,
      },
      { status: 500 },
    );
  }
}
