"use client";

import { Button } from "@/components/Button";

import { deleteActivity } from "./actions";

type DeleteActivityFormProps = {
  activityId: string;
  activityTitle: string;
};

export function DeleteActivityForm({
  activityId,
  activityTitle,
}: DeleteActivityFormProps) {
  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(`"${activityTitle}" 활동을 삭제할까요?`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteActivity} onSubmit={confirmDelete}>
      <input name="activityId" type="hidden" value={activityId} />
      <Button
        className="text-red-700 ring-red-200 hover:bg-red-50"
        type="submit"
        variant="quiet"
      >
        삭제
      </Button>
    </form>
  );
}
