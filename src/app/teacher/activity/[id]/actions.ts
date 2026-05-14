"use server";

import { revalidatePath } from "next/cache";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} 값이 없습니다.`);
  }

  return value;
}

export async function updateQuestionStatus(formData: FormData) {
  const activityId = getRequiredFormValue(formData, "activityId");
  const questionId = getRequiredFormValue(formData, "questionId");
  const status = getRequiredFormValue(formData, "status");

  if (status !== "accepted" && status !== "hidden") {
    throw new Error("질문 상태 값이 올바르지 않습니다.");
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from("questions")
    .update({ status })
    .eq("id", questionId)
    .eq("activity_id", activityId);

  if (error) {
    throw new Error(`질문 상태를 바꾸지 못했어요: ${error.message}`);
  }

  revalidatePath(`/teacher/activity/${activityId}`);
}

export async function openSolveMode(formData: FormData) {
  const activityId = getRequiredFormValue(formData, "activityId");
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from("activities")
    .update({ solve_mode_open: true })
    .eq("id", activityId);

  if (error) {
    throw new Error(`질문 풀기를 열지 못했어요: ${error.message}`);
  }

  revalidatePath(`/teacher/activity/${activityId}`);
}

export async function closeActivity(formData: FormData) {
  const activityId = getRequiredFormValue(formData, "activityId");
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from("activities")
    .update({ status: "closed" })
    .eq("id", activityId);

  if (error) {
    throw new Error(`활동을 종료하지 못했어요: ${error.message}`);
  }

  revalidatePath(`/teacher/activity/${activityId}`);
}
