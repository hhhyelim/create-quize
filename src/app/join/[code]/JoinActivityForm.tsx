"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

import { joinActivityAction } from "./actions";

type JoinActivityFormProps = {
  activityId: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "들어가는 중..." : "시작하기"}
    </Button>
  );
}

export function JoinActivityForm({ activityId }: JoinActivityFormProps) {
  const [state, formAction] = useActionState(joinActivityAction, {});

  return (
    <form action={formAction} className="grid gap-5">
      {state.error ? (
        <p className="rounded-xl bg-red-50 p-4 text-base font-bold text-red-700">
          {state.error}
        </p>
      ) : null}
      <input name="activityId" type="hidden" value={activityId} />
      <label className="grid gap-2">
        <span className="text-lg font-bold">내 이름</span>
        <Input name="displayName" placeholder="예: 민준" required />
      </label>
      <SubmitButton />
    </form>
  );
}
