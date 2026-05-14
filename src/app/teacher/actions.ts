"use server";

import { revalidatePath } from "next/cache";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

const MATERIAL_BUCKET = "activity-materials";

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} 값이 없습니다.`);
  }

  return value;
}

function getStoragePathFromPublicUrl(materialUrl: string | null) {
  if (!materialUrl) {
    return null;
  }

  try {
    const url = new URL(materialUrl);
    const marker = `/storage/v1/object/public/${MATERIAL_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function deleteActivity(formData: FormData) {
  const activityId = getRequiredFormValue(formData, "activityId");
  const supabase = getServiceSupabaseClient();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id,material_url")
    .eq("id", activityId)
    .single();

  if (activityError || !activity) {
    throw new Error("삭제할 활동을 찾지 못했어요.");
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id")
    .eq("activity_id", activityId);

  if (questionsError) {
    throw new Error(`질문 목록을 확인하지 못했어요: ${questionsError.message}`);
  }

  const questionIds = questions?.map((question) => question.id) ?? [];

  if (questionIds.length) {
    const { error } = await supabase
      .from("answers")
      .delete()
      .in("question_id", questionIds);

    if (error) {
      throw new Error(`답변을 삭제하지 못했어요: ${error.message}`);
    }
  }

  const deletes = await Promise.all([
    supabase.from("coaching_logs").delete().eq("activity_id", activityId),
    supabase.from("question_attempts").delete().eq("activity_id", activityId),
    supabase.from("questions").delete().eq("activity_id", activityId),
    supabase.from("students").delete().eq("activity_id", activityId),
  ]);
  const deleteError = deletes.find((result) => result.error)?.error;

  if (deleteError) {
    throw new Error(`활동 데이터를 삭제하지 못했어요: ${deleteError.message}`);
  }

  const { error: deleteActivityError } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId);

  if (deleteActivityError) {
    throw new Error(`활동을 삭제하지 못했어요: ${deleteActivityError.message}`);
  }

  const storagePath = getStoragePathFromPublicUrl(activity.material_url);

  if (storagePath) {
    const { error } = await supabase.storage
      .from(MATERIAL_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error("활동 이미지를 삭제하지 못했어요.", error);
    }
  }

  revalidatePath("/teacher");
}
