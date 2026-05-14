"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Button";

type AnalyzeMaterialButtonProps = {
  activityId: string;
  hasAnalysis: boolean;
};

export function AnalyzeMaterialButton({
  activityId,
  hasAnalysis,
}: AnalyzeMaterialButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "idle" | "analyzing" | "failed" | "complete"
  >(hasAnalysis ? "complete" : "idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function analyzeMaterial() {
    setStatus("analyzing");
    setErrorMessage("");

    const response = await fetch(
      `/api/activities/${activityId}/analyze-material`,
      { method: "POST" },
    );
    const result: { error?: string; ok?: boolean } = await response.json();

    if (!response.ok || !result.ok) {
      setStatus("failed");
      setErrorMessage(result.error ?? "자료 분석에 실패했어요.");
      return;
    }

    setStatus("complete");
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={status === "analyzing"}
          onClick={analyzeMaterial}
          type="button"
          variant={hasAnalysis ? "quiet" : "secondary"}
        >
          {status === "analyzing"
            ? "분석 중..."
            : hasAnalysis
              ? "다시 분석하기"
              : "자료 분석하기"}
        </Button>
        <p className="text-base font-bold text-slate-600">
          {status === "idle" ? "분석 전" : null}
          {status === "analyzing" ? "Gemini가 자료를 읽고 있어요." : null}
          {status === "failed" ? "분석 실패" : null}
          {status === "complete" ? "분석 완료" : null}
        </p>
      </div>
      {errorMessage ? (
        <p className="rounded-xl bg-red-50 p-4 text-base font-bold text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
