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

type ActivityMaterial = {
  id: string;
  material_text: string | null;
  material_type: "text" | "image" | "txt";
  material_url: string | null;
};

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

function getMimeTypeFromUrl(imageUrl: string) {
  const pathname = new URL(imageUrl).pathname.toLowerCase();

  if (pathname.endsWith(".png")) {
    return "image/png";
  }

  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

async function imageUrlToGenerativePart(imageUrl: string) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error("이미지 파일을 불러오지 못했어요.");
  }

  const mimeType = response.headers.get("content-type") ?? getMimeTypeFromUrl(imageUrl);
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");

  return {
    inlineData: {
      data,
      mimeType,
    },
  };
}

export async function analyzeMaterialImage(input: {
  imageUrl: string;
  materialText: string | null;
}) {
  const genAI = new GoogleGenerativeAI(requireGeminiApiKey());
  const model = genAI.getGenerativeModel({
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
    model: "gemini-2.5-flash",
  });
  const materialText = input.materialText?.trim();
  const prompt = buildMaterialAnalysisPrompt(
    materialText
      ? `이미지 자료입니다. 교사 보충 설명: ${materialText}`
      : "이미지 자료입니다. 이미지에 보이는 장소, 대상, 현상, 질문할 수 있는 방향을 분석해 주세요.",
  );
  const result = await model.generateContent([
    prompt,
    await imageUrlToGenerativePart(input.imageUrl),
  ]);

  return parseMaterialAnalysis(result.response.text());
}

async function analyzeActivityMaterial(activity: ActivityMaterial) {
  if (activity.material_type === "image") {
    if (activity.material_url) {
      try {
        return await analyzeMaterialImage({
          imageUrl: activity.material_url,
          materialText: activity.material_text,
        });
      } catch (error) {
        console.error("Gemini Vision 이미지 분석 실패. 텍스트 fallback으로 진행합니다.", error);
      }
    }

    return analyzeMaterialText(activity.material_text?.trim() || "이미지 자료");
  }

  return analyzeMaterialText(activity.material_text ?? "");
}

export async function analyzeAndSaveActivityMaterial(activityId: string) {
  const supabase = getServiceSupabaseClient();
  const { data: activity, error: activityError } = await supabase
    .from("activities")
    .select("id,material_text,material_type,material_url")
    .eq("id", activityId)
    .single();

  if (activityError || !activity) {
    throw new Error("분석할 활동을 찾지 못했어요.");
  }

  const analysis = await analyzeActivityMaterial(activity);
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
