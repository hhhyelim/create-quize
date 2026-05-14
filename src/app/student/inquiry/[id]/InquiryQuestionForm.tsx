"use client";

import { useMemo, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/Button";
import { Textarea } from "@/components/Textarea";
import { validateQuestionInput } from "@/lib/questions/question-input-validator";

type ChatMessage = {
  id: string;
  role: "student" | "ai";
  text: string;
};

type StreamEvent = {
  event: string;
  data: {
    aiHint?: string;
    ok?: boolean;
    studentMessage?: string;
    text?: string;
  };
};

type SubmitInquiryResponse = {
  accepted: boolean;
  reason:
    | "Empty"
    | "HateSpeech"
    | "Meaningless"
    | "Profanity"
    | "server_error"
    | "Valid";
  studentMessage: string;
};

type InquiryQuestionFormProps = {
  activityId: string;
  studentId: string;
};

function makeMessageId(role: ChatMessage["role"]) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseSseEvent(rawEvent: string): StreamEvent | null {
  const eventLine = rawEvent
    .split("\n")
    .find((line) => line.startsWith("event: "));
  const dataLine = rawEvent
    .split("\n")
    .find((line) => line.startsWith("data: "));

  if (!eventLine || !dataLine) {
    return null;
  }

  try {
    return {
      data: JSON.parse(dataLine.slice(6)) as StreamEvent["data"],
      event: eventLine.slice(7).trim(),
    };
  } catch {
    return null;
  }
}

export function InquiryQuestionForm({
  activityId,
  studentId,
}: InquiryQuestionFormProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hintCount, setHintCount] = useState(0);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastHintStudentText, setLastHintStudentText] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );
  const [studentText, setStudentText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const finalQuestionValidation = useMemo(
    () => validateQuestionInput(studentText),
    [studentText],
  );

  const canSubmitFinalQuestion = useMemo(() => {
    return (
      hintCount > 0 &&
      studentText.trim() !== lastHintStudentText &&
      finalQuestionValidation.isValid
    );
  }, [
    finalQuestionValidation.isValid,
    hintCount,
    lastHintStudentText,
    studentText,
  ]);

  function updateAiMessage(
    messageId: string,
    text: string,
    mode: "append" | "replace",
  ) {
    setChatMessages((current) =>
      current.map((messageItem) =>
        messageItem.id === messageId
          ? {
              ...messageItem,
              text: mode === "append" ? `${messageItem.text}${text}` : text,
            }
          : messageItem,
      ),
    );
  }

  async function requestHint() {
    if (isHintLoading) {
      return;
    }

    const trimmedStudentText = studentText.trim();
    const studentMessageId = makeMessageId("student");
    const aiMessageId = makeMessageId("ai");

    setIsHintLoading(true);
    setMessage("");
    setLastHintStudentText(trimmedStudentText);
    setChatMessages((current) => [
      ...current,
      {
        id: studentMessageId,
        role: "student",
        text: trimmedStudentText || "아직 질문을 쓰는 중이에요.",
      },
      { id: aiMessageId, role: "ai", text: "" },
    ]);

    try {
      const response = await fetch("/api/inquiry/hint", {
        body: JSON.stringify({
          activityId,
          studentId,
          studentText,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok || !response.body) {
        const result = (await response.json()) as {
          studentMessage?: string;
        };

        setMessageTone("error");
        setMessage(result.studentMessage ?? "힌트를 받지 못했어요. 다시 해 주세요.");
        updateAiMessage(
          aiMessageId,
          "힌트를 받지 못했어요. 다시 해 주세요.",
          "replace",
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const parsed = parseSseEvent(rawEvent);

          if (!parsed) {
            continue;
          }

          if (parsed.event === "delta" && parsed.data.text) {
            updateAiMessage(aiMessageId, parsed.data.text, "append");
          }

          if (parsed.event === "replace" && parsed.data.text) {
            updateAiMessage(aiMessageId, parsed.data.text, "replace");
          }

          if (parsed.event === "done") {
            setHintCount((current) => current + 1);
            setMessageTone("success");
            setMessage(parsed.data.studentMessage ?? "힌트를 받았어요.");
          }

          if (parsed.event === "error") {
            setMessageTone("error");
            setMessage(
              parsed.data.studentMessage ??
                "힌트를 저장하지 못했어요. 다시 해 주세요.",
            );
          }
        }
      }
    } catch {
      updateAiMessage(
        aiMessageId,
        "좋아요. 지금 질문에서 가장 궁금한 말을 하나 골라 보세요. 그리고 그 말에 대해 어떤 일이 생기는지 붙여 다시 써 보세요.",
        "replace",
      );
      setMessageTone("error");
      setMessage("힌트를 받지 못했어요. 다시 해 주세요.");
    } finally {
      setIsHintLoading(false);
    }
  }

  async function submitFinalQuestion() {
    if (isSubmitting || submitted) {
      return;
    }

    if (hintCount <= 0 || studentText.trim() === lastHintStudentText) {
      return;
    }

    if (!finalQuestionValidation.isValid) {
      setMessageTone("error");
      setMessage(finalQuestionValidation.studentMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/inquiry/submit", {
        body: JSON.stringify({
          activityId,
          questionText: studentText,
          studentId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as SubmitInquiryResponse;

      setMessage(result.studentMessage);

      if (!response.ok || !result.accepted) {
        setMessageTone("error");
        return;
      }

      setMessageTone("success");
      setSubmitted(true);
    } catch {
      setMessageTone("error");
      setMessage("질문을 저장하지 못했어요. 다시 해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    void submitFinalQuestion();
  }

  return (
    <div className="grid gap-5">
      {message ? (
        <p
          className={[
            "rounded-xl p-4 text-base font-bold",
            messageTone === "success"
              ? "bg-teal-50 text-teal-700"
              : "bg-red-50 text-red-700",
          ].join(" ")}
        >
          {message}
        </p>
      ) : null}

      <section className="grid max-h-[420px] gap-3 overflow-y-auto rounded-xl bg-slate-50 p-4">
        {chatMessages.length ? (
          chatMessages.map((chatMessage) => (
            <div
              className={[
                "max-w-[88%] rounded-xl px-4 py-3 text-lg leading-8",
                chatMessage.role === "student"
                  ? "justify-self-end bg-sky-600 text-white"
                  : "justify-self-start bg-white text-slate-800 ring-1 ring-slate-200",
              ].join(" ")}
              key={chatMessage.id}
            >
              {chatMessage.text || "생각하는 중..."}
            </div>
          ))
        ) : (
          <p className="rounded-xl bg-white p-4 text-lg leading-8 text-slate-600 ring-1 ring-slate-200">
            질문을 적고 힌트를 받으면 탐구가 시작돼요.
          </p>
        )}
      </section>

      <label className="grid gap-2">
        <span className="text-lg font-bold">내 탐구 질문</span>
        <Textarea
          disabled={isSubmitting || submitted}
          onChange={(event) => setStudentText(event.target.value)}
          onKeyDown={handleQuestionKeyDown}
          placeholder="깊게 알아보고 싶은 질문을 써 보세요."
          value={studentText}
        />
      </label>

      {!canSubmitFinalQuestion && !submitted ? (
        <p className="rounded-xl bg-slate-50 p-4 text-base font-bold text-slate-600">
          {studentText.trim() && !finalQuestionValidation.isValid
            ? finalQuestionValidation.studentMessage
            : "AI의 힌트와 함께 탐구 질문을 더 다듬어 써 볼까요?"}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={isHintLoading || isSubmitting || submitted}
          onClick={requestHint}
          type="button"
          variant="quiet"
        >
          {isHintLoading ? "생각하는 중..." : "힌트 받기"}
        </Button>
        {canSubmitFinalQuestion && !submitted ? (
          <Button
            disabled={isHintLoading || isSubmitting}
            onClick={submitFinalQuestion}
            type="button"
            variant="secondary"
          >
            {isSubmitting ? "저장하는 중..." : "최종 질문 제출"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
