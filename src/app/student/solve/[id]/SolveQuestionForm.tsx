"use client";

import { useState } from "react";

import { Button } from "@/components/Button";
import { Textarea } from "@/components/Textarea";

type FriendQuestion = {
  id: string;
  question_text: string;
  answerCount: number;
};

type RandomQuestionResponse = {
  ok: boolean;
  question: FriendQuestion | null;
  message: string;
};

type SubmitAnswerResponse = {
  accepted: boolean;
  reason:
    | "accepted"
    | "already_answered"
    | "empty"
    | "invalid_question"
    | "invalid_student"
    | "own_question"
    | "server_error"
    | "too_short";
  studentMessage: string;
};

type SolveQuestionFormProps = {
  activityId: string;
  initialQuestion: FriendQuestion | null;
  studentId: string;
};

export function SolveQuestionForm({
  activityId,
  initialQuestion,
  studentId,
}: SolveQuestionFormProps) {
  const [answerText, setAnswerText] = useState("");
  const [isFetchingQuestion, setIsFetchingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">(
    "success",
  );
  const [question, setQuestion] = useState<FriendQuestion | null>(
    initialQuestion,
  );
  const [submitted, setSubmitted] = useState(false);

  async function fetchRandomQuestion() {
    setIsFetchingQuestion(true);
    setAnswerText("");
    setMessage("");
    setSubmitted(false);

    try {
      const params = new URLSearchParams({ activityId, studentId });
      const response = await fetch(`/api/questions/random?${params.toString()}`);
      const result = (await response.json()) as RandomQuestionResponse;

      setQuestion(result.question);

      if (!response.ok || !result.ok) {
        setMessageTone("error");
        setMessage(result.message);
        return;
      }

      if (!result.question) {
        setMessageTone("success");
        setMessage(result.message);
      }
    } catch {
      setMessageTone("error");
      setMessage("친구 질문을 불러오지 못했어요.");
      setQuestion(null);
    } finally {
      setIsFetchingQuestion(false);
    }
  }

  async function submitCurrentAnswer() {
    if (!question || isSubmitting || submitted) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/answers/submit", {
        body: JSON.stringify({
          answerText,
          questionId: question.id,
          studentId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as SubmitAnswerResponse;

      setMessage(result.studentMessage);

      if (!response.ok || !result.accepted) {
        setMessageTone("error");
        return;
      }

      setMessageTone("success");
      setSubmitted(true);
    } catch {
      setMessageTone("error");
      setMessage("답변을 저장하지 못했어요. 다시 해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
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

      {isFetchingQuestion ? (
        <p className="rounded-xl bg-slate-50 p-5 text-lg font-bold text-slate-600">
          친구 질문을 고르고 있어요.
        </p>
      ) : question ? (
        <>
          <section className="grid gap-3 rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <p className="text-sm font-bold text-emerald-700">친구 질문</p>
            <p className="text-2xl font-bold leading-9 text-slate-900">
              {question.question_text}
            </p>
          </section>

          <label className="grid gap-2">
            <span className="text-lg font-bold">내 답변</span>
            <Textarea
              disabled={isSubmitting || submitted}
              onChange={(event) => setAnswerText(event.target.value)}
              placeholder="친구 질문을 읽고 내 생각을 써 보세요."
              value={answerText}
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={isSubmitting || submitted}
              onClick={submitCurrentAnswer}
              type="button"
              variant="secondary"
            >
              {isSubmitting ? "저장하는 중..." : "답변 제출"}
            </Button>
            <Button
              disabled={isFetchingQuestion || isSubmitting}
              onClick={fetchRandomQuestion}
              type="button"
              variant="quiet"
            >
              다음 질문 받기
            </Button>
          </div>
        </>
      ) : (
        <section className="grid gap-2 rounded-xl bg-slate-50 p-5 text-slate-700">
          <p className="text-xl font-bold">아직 풀 수 있는 친구 질문이 없어요.</p>
          <p className="text-lg leading-8">
            질문 놀이에서 친구들이 질문을 더 만들면 다시 해 볼 수 있어요.
          </p>
          <Button
            className="mt-2"
            disabled={isFetchingQuestion}
            onClick={fetchRandomQuestion}
            type="button"
            variant="quiet"
          >
            다음 질문 받기
          </Button>
        </section>
      )}
    </div>
  );
}
