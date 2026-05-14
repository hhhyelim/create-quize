"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";

import { createActivityAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "만드는 중..." : "활동 생성"}
    </Button>
  );
}

export function CreateActivityForm() {
  const [state, formAction] = useActionState(createActivityAction, {});

  return (
    <form action={formAction} className="grid gap-5">
      {state.error ? (
        <p className="rounded-xl bg-red-50 p-4 text-base font-bold text-red-700">
          {state.error}
        </p>
      ) : null}

      <label className="grid gap-2">
        <span className="text-base font-bold">활동 제목</span>
        <Input name="title" placeholder="예: 좋은 질문 만들기" required />
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-base font-bold">자료 유형</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["text", "직접 입력"],
            ["image", "이미지"],
            ["txt", "TXT 파일"],
          ].map(([value, label]) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-base font-bold"
              key={value}
            >
              <input
                defaultChecked={value === "text"}
                name="materialType"
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-sm font-bold text-slate-500">
          지금은 직접 입력만 저장돼요.
        </p>
      </fieldset>

      <label className="grid gap-2">
        <span className="text-base font-bold">자료 내용</span>
        <Textarea
          name="content"
          placeholder="학생들이 읽고 질문을 만들 짧은 글을 넣어 주세요."
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-base font-bold">제한 시간(분)</span>
        <Input
          defaultValue="15"
          max={180}
          min={1}
          name="timeLimitMinutes"
          required
          type="number"
        />
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-base font-bold">공개 모드</legend>
        <div className="grid gap-3">
          {[
            ["quick_question", "질문 놀이"],
            ["inquiry_question", "탐구 질문 만들기"],
            ["solve_friend_question", "친구의 질문 풀기"],
          ].map(([value, label]) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-base font-bold"
              key={value}
            >
              <input defaultChecked name="openModes" type="checkbox" value={value} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <SubmitButton />
        <Button href="/teacher" variant="quiet">
          돌아가기
        </Button>
      </div>
    </form>
  );
}
