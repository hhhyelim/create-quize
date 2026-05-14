import "server-only";

import { z } from "zod";

import { generateInquiryHint } from "@/lib/ai/inquiryHint";
import type { MaterialAnalysis } from "@/lib/ai/gemini";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

import { parseMaterialAnalysis } from "./inquiry-common";

export type InquiryHintResult = {
  ok: boolean;
  aiHint: string;
  step: number;
  studentMessage: string;
};

const hintSchema = z.object({
  activityId: z.string().trim().min(1),
  studentId: z.string().trim().min(1),
  studentText: z.string(),
});

export type InquiryHintContext = {
  activityId: string;
  analysis: MaterialAnalysis | null;
  materialText: string | null;
  previousTurns: Array<{
    aiHint: string;
    studentText: string;
  }>;
  step: number;
  studentId: string;
  studentText: string;
};

export async function prepareInquiryHintContext(
  body: unknown,
): Promise<
  | { ok: true; context: InquiryHintContext }
  | { ok: false; result: InquiryHintResult }
> {
  const parsed = hintSchema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      result: {
        ok: false,
        aiHint: "",
        step: 0,
        studentMessage: "참여 정보를 다시 확인해 주세요.",
      },
    };
  }

  const { activityId, studentId } = parsed.data;
  const studentText = parsed.data.studentText.trim();
  const supabase = getServiceSupabaseClient();
  const [
    { data: activity },
    { data: student },
    { count },
    { data: previousLogs },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("id,material_text,ai_material_analysis")
      .eq("id", activityId)
      .single(),
    supabase
      .from("students")
      .select("id,activity_id")
      .eq("id", studentId)
      .single(),
    supabase
      .from("coaching_logs")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", activityId)
      .eq("student_id", studentId),
    supabase
      .from("coaching_logs")
      .select("student_text,ai_hint")
      .eq("activity_id", activityId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true })
      .limit(6),
  ]);

  if (!activity || !student || student.activity_id !== activity.id) {
    return {
      ok: false,
      result: {
        ok: false,
        aiHint: "",
        step: 0,
        studentMessage: "참여 정보를 다시 확인해 주세요.",
      },
    };
  }

  return {
    ok: true,
    context: {
      activityId: activity.id,
      analysis: parseMaterialAnalysis(activity.ai_material_analysis),
      materialText: activity.material_text,
      previousTurns: (previousLogs ?? []).map((log) => ({
        aiHint: log.ai_hint,
        studentText: log.student_text,
      })),
      step: (count ?? 0) + 1,
      studentId: student.id,
      studentText,
    },
  };
}

export async function saveInquiryHintLog(input: {
  activityId: string;
  aiHint: string;
  step: number;
  studentId: string;
  studentText: string;
}) {
  const supabase = getServiceSupabaseClient();

  return supabase.from("coaching_logs").insert({
    activity_id: input.activityId,
    ai_hint: input.aiHint,
    step: input.step,
    student_id: input.studentId,
    student_text: input.studentText,
  });
}

export async function getInquiryHint(
  body: unknown,
): Promise<InquiryHintResult> {
  const prepared = await prepareInquiryHintContext(body);

  if (!prepared.ok) {
    return prepared.result;
  }

  const { context } = prepared;
  const aiHint = await generateInquiryHint({
    analysis: context.analysis,
    materialText: context.materialText,
    previousTurns: context.previousTurns,
    step: context.step,
    studentText: context.studentText,
  });
  const { error } = await saveInquiryHintLog({
    activityId: context.activityId,
    aiHint,
    step: context.step,
    studentId: context.studentId,
    studentText: context.studentText,
  });

  if (error) {
    return {
      ok: false,
      aiHint,
      step: context.step,
      studentMessage: "힌트를 저장하지 못했어요. 다시 해 주세요.",
    };
  }

  return {
    ok: true,
    aiHint,
    step: context.step,
    studentMessage: "힌트를 받았어요.",
  };
}
