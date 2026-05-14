"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type JoinActivityState = {
  error?: string;
};

const joinActivitySchema = z.object({
  activityId: z.string().min(1, "활동 정보가 없습니다."),
  displayName: z
    .string()
    .trim()
    .min(1, "이름을 입력해 주세요.")
    .max(30, "이름은 30자 안으로 입력해 주세요."),
});

export async function joinActivityAction(
  _previousState: JoinActivityState,
  formData: FormData,
): Promise<JoinActivityState> {
  const parsed = joinActivitySchema.safeParse({
    activityId: formData.get("activityId"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 다시 확인해 주세요.",
    };
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("students")
    .insert({
      activity_id: parsed.data.activityId,
      display_name: parsed.data.displayName,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error: error?.message
        ? `참여 정보를 저장하지 못했어요: ${error.message}`
        : "참여 정보를 저장하지 못했어요. 다시 시도해 주세요.",
    };
  }

  redirect(`/student/activity/${parsed.data.activityId}?studentId=${data.id}`);
}
