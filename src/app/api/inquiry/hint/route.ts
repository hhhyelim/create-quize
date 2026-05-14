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
const hintSavedMessage = "힌트를 받았어요.";
const hintSaveFailedMessage =
  "힌트를 저장하지 못했어요. 다시 해 주세요.";
const hintLoadFailedMessage = "힌트를 받을 수 없어요. 다시 해 주세요.";

function encodeEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function isClosedControllerError(error: unknown) {
  return (
    error instanceof TypeError &&
    (error.message.includes("Controller is already closed") ||
      error.message.includes("Invalid state"))
  );
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
        let completedHint = "";
        let isStreamClosed = false;
        const hintInput = {
          analysis: context.analysis,
          materialText: context.materialText,
          previousTurns: context.previousTurns,
          studentText: context.studentText,
        };

        function safeEnqueue(event: string, data: unknown) {
          if (isStreamClosed || request.signal.aborted) {
            isStreamClosed = true;
            return false;
          }

          try {
            controller.enqueue(encodeEvent(event, data));
            return true;
          } catch (error) {
            if (!isClosedControllerError(error)) {
              throw error;
            }

            isStreamClosed = true;
            return false;
          }
        }

        function safeClose() {
          if (isStreamClosed) {
            return;
          }

          try {
            controller.close();
          } catch (error) {
            if (!isClosedControllerError(error)) {
              throw error;
            }
          } finally {
            isStreamClosed = true;
          }
        }

        safeEnqueue("meta", {
          ok: true,
          studentMessage: hintSavedMessage,
        });

        try {
          for await (const chunk of streamInquiryHint(hintInput)) {
            completedHint += chunk;

            if (!safeEnqueue("delta", { text: chunk })) {
              return;
            }
          }

          const normalizedHint = normalizeInquiryHint(completedHint, hintInput);
          const repairedHint = await repairInquiryHintIfNeeded(
            normalizedHint,
            hintInput,
          );

          if (repairedHint !== completedHint.trim()) {
            completedHint = repairedHint;

            if (!safeEnqueue("replace", { text: repairedHint })) {
              return;
            }
          } else {
            completedHint = completedHint.trim();
          }
        } catch (error) {
          if (isClosedControllerError(error) || request.signal.aborted) {
            return;
          }

          console.error("Gemini inquiry hint stream failed. Using fallback.", error);
          completedHint = buildFallbackInquiryHint(hintInput);

          if (!safeEnqueue("replace", { text: completedHint })) {
            return;
          }
        }

        try {
          await saveHintOrThrow({
            activityId: context.activityId,
            aiHint: completedHint,
            studentId: context.studentId,
            studentText: context.studentText,
          });

          safeEnqueue("done", {
            aiHint: completedHint,
            ok: true,
            studentMessage: hintSavedMessage,
          });
        } catch (error) {
          console.error("Failed to save inquiry hint.", error);
          safeEnqueue("error", {
            aiHint: completedHint,
            ok: false,
            studentMessage: hintSaveFailedMessage,
          });
        } finally {
          safeClose();
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
