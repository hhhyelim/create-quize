"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { Textarea } from "@/components/Textarea";

type Question = {
  id: string;
  question_text: string;
};

type SubmitQuestionResponse = {
  accepted: boolean;
  question?: Question;
  reason:
    | "Empty"
    | "HateSpeech"
    | "Meaningless"
    | "Profanity"
    | "server_error"
    | "Valid";
  rejectedCount: number;
  studentMessage: string;
  warningRequired: boolean;
};

type QuickQuestionFormProps = {
  activityId: string;
  initialWarningRequired: boolean;
  initialQuestions: Question[];
  studentId: string;
  timeLimitSec: number;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
}

export function QuickQuestionForm({
  activityId,
  initialWarningRequired,
  initialQuestions,
  studentId,
  timeLimitSec,
}: QuickQuestionFormProps) {
  const [questionText, setQuestionText] = useState("");
  const [questions, setQuestions] = useState(initialQuestions);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSec);
  const [warningRequired, setWarningRequired] = useState(initialWarningRequired);
  const isTimeOver = remainingSeconds <= 0;

  useEffect(() => {
    if (remainingSeconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [remainingSeconds]);

  const timerText = useMemo(
    () =>
      isTimeOver
        ? "시간이 끝났어요."
        : `남은 시간 ${formatTime(remainingSeconds)}`,
    [isTimeOver, remainingSeconds],
  );

  async function submitQuestion() {
    if (isTimeOver || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/questions/submit", {
        body: JSON.stringify({
          activityId,
          questionText,
          studentId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as SubmitQuestionResponse;

      setMessage(result.studentMessage);
      setWarningRequired(result.warningRequired);

      if (!response.ok || !result.accepted || !result.question) {
        setMessageTone("error");
        return;
      }

      setMessageTone("success");
      setQuestionText("");
      setQuestions((current) => [result.question!, ...current]);
    } catch {
      setMessageTone("error");
      setMessage("질문을 보내지 못했어요. 다시 해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-xl bg-yellow-50 p-4">
        <p className="text-xl font-bold text-slate-800">{timerText}</p>
      </div>

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

      {warningRequired ? (
        <div className="grid gap-4 rounded-xl border border-red-300 bg-red-50 p-5">
          <div className="grid gap-3">
            <h2 className="text-2xl font-bold text-red-800">
              ⚠️ 잠깐 멈춰 주세요
            </h2>
            <div className="grid gap-1 text-lg leading-8 text-red-700">
              <p>작성한 질문이 여러 번 받아들여지지 않았어요.</p>
              <p>이 활동은 자료를 보고 궁금한 점을 질문으로 만드는 시간이에요.</p>
              <p>친구들이 함께 읽을 수 있는 질문을 써 주세요.</p>
            </div>
          </div>
          <Button
            disabled={isTimeOver}
            onClick={() => {
              setWarningRequired(false);
              setMessage("");
            }}
            type="button"
            variant="secondary"
          >
            다시 작성하기
          </Button>
        </div>
      ) : (
        <>
          <label className="grid gap-2">
            <span className="text-lg font-bold">내 질문</span>
            <Textarea
              disabled={isTimeOver || isSubmitting}
              onChange={(event) => setQuestionText(event.target.value)}
              placeholder="예: 주인공은 왜 그렇게 말했을까?"
              value={questionText}
            />
          </label>

          <Button
            disabled={isTimeOver || isSubmitting}
            onClick={submitQuestion}
            type="button"
          >
            {isSubmitting ? "질문을 확인하고 있어요..." : "질문 보내기"}
          </Button>
        </>
      )}

      <div>
        <h2 className="text-2xl font-bold">내가 보낸 질문</h2>
        <div className="mt-4 grid gap-3">
          {questions.length ? (
            questions.map((question) => (
              <p
                className="rounded-xl bg-sky-50 p-4 text-lg leading-8 text-slate-800"
                key={question.id}
              >
                {question.question_text}
              </p>
            ))
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-lg text-slate-600">
              아직 보낸 질문이 없어요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
