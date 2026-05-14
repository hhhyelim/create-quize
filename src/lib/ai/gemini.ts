import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { buildMaterialAnalysisPrompt } from "@/lib/ai/prompts";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const materialAnalysisSchema = z.object({
  summary: z.string(),
  keywords: z.array(z.string()).min(1),
  main_elements: z.array(z.string()),
  related_scopes: z.array(z.string()),
  unrelated_scopes: z.array(z.string()),
  teacher_note: z.string(),
});

export type MaterialAnalysis = z.infer<typeof materialAnalysisSchema>;

function requireGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경변수가 없습니다. .env.local에 Gemini API 키를 추가해 주세요.",
    );
  }

  return apiKey;
}

function stripJsonCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseMaterialAnalysis(text: string) {
  const cleaned = stripJsonCodeFence(text);

  try {
    return materialAnalysisSchema.parse(JSON.parse(cleaned));
  } catch {
    throw new Error(
      "Gemini 분석 결과를 JSON으로 읽지 못했어요. 잠시 후 다시 분석해 주세요.",
    );
  }
}

export async function analyzeMaterialText(materialText: string) {
  if (!materialText.trim()) {
    throw new Error("분석할 자료 내용이 없습니다.");
  }

  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  const model = genAI.getGenerativeModel({
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
    model: "gemini-2.5-flash",
  });

  const result = await model.generateContent(
    buildMaterialAnalysisPrompt(materialText),
  );
  const responseText = result.response.text();

  return parseMaterialAnalysis(responseText);
}

export async function analyzeAndSaveActivityMaterial(activityId: string) {
  const supabase = getServiceSupabaseClient();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id,material_text")
    .eq("id", activityId)
    .single();

  if (activityError || !activity) {
    throw new Error("분석할 활동을 찾지 못했어요.");
  }

  const analysis = await analyzeMaterialText(activity.material_text ?? "");
  const { error: updateError } = await supabase
    .from("activities")
    .update({
      ai_material_analysis: analysis,
      material_keywords: analysis.keywords,
      material_summary: analysis.summary,
    })
    .eq("id", activityId);

  if (updateError) {
    throw new Error(`분석 결과를 저장하지 못했어요: ${updateError.message}`);
  }

  return analysis;
}
