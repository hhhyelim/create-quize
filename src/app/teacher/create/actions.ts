"use server";

import { redirect } from "next/navigation";
import { customAlphabet } from "nanoid";
import { z } from "zod";

import { analyzeAndSaveActivityMaterial } from "@/lib/ai/gemini";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type CreateActivityState = {
  error?: string;
};

const openModeSchema = z.enum([
  "quick_question",
  "inquiry_question",
  "solve_friend_question",
]);

const createActivitySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "활동 제목을 입력해 주세요.")
    .max(80, "활동 제목은 80자 안으로 입력해 주세요."),
  materialType: z.enum(["text", "image", "txt"]),
  content: z
    .string()
    .trim()
    .min(1, "자료 내용을 입력해 주세요.")
    .max(4000, "자료 내용은 4000자 안으로 입력해 주세요."),
  timeLimitMinutes: z.coerce
    .number()
    .int("제한 시간은 분 단위 숫자로 입력해 주세요.")
    .min(1, "제한 시간은 1분 이상이어야 해요.")
    .max(180, "제한 시간은 180분 이하로 입력해 주세요."),
  openModes: z
    .array(openModeSchema)
    .min(1, "공개할 질문 모드를 하나 이상 선택해 주세요."),
});

const makeInviteCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 7);

function toEnabledModeObject(openModes: Array<z.infer<typeof openModeSchema>>) {
  return {
    quick_question: openModes.includes("quick_question"),
    inquiry_question: openModes.includes("inquiry_question"),
    solve_friend_question: openModes.includes("solve_friend_question"),
  };
}

export async function createActivityAction(
  _previousState: CreateActivityState,
  formData: FormData,
): Promise<CreateActivityState> {
  const parsed = createActivitySchema.safeParse({
    title: formData.get("title"),
    materialType: formData.get("materialType"),
    content: formData.get("content"),
    timeLimitMinutes: formData.get("timeLimitMinutes"),
    openModes: formData.getAll("openModes"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 다시 확인해 주세요.",
    };
  }

  if (parsed.data.materialType !== "text") {
    return {
      error: "현재 MVP에서는 text 자료 입력만 사용할 수 있어요.",
    };
  }

  const supabase = getServiceSupabaseClient();
  let activityId: string | null = null;
  let lastError = "활동을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const inviteCode = makeInviteCode();
    const enabledModes = toEnabledModeObject(parsed.data.openModes);
    const { data, error } = await supabase
      .from("activities")
      .insert({
        title: parsed.data.title,
        teacher_id: "demo-teacher",
        invite_code: inviteCode,
        material_type: parsed.data.materialType,
        material_text: parsed.data.content,
        time_limit_sec: parsed.data.timeLimitMinutes * 60,
        enabled_modes: enabledModes,
        solve_mode_open: enabledModes.solve_friend_question,
        status: "active",
      })
      .select("id")
      .single();

    if (!error && data) {
      activityId = data.id;
      break;
    }

    lastError = error?.message
      ? `활동 저장 중 문제가 생겼어요: ${error.message}`
      : lastError;
  }

  if (!activityId) {
    return { error: lastError };
  }

  try {
    await analyzeAndSaveActivityMaterial(activityId);
  } catch (error) {
    console.error("활동 생성 후 자료 분석 실패", error);
  }

  redirect(`/teacher/activity/${activityId}`);
}
