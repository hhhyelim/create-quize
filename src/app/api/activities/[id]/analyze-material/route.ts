import { NextResponse } from "next/server";

import { analyzeAndSaveActivityMaterial } from "@/lib/ai/gemini";

type AnalyzeMaterialRouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: AnalyzeMaterialRouteProps) {
  const { id } = await params;

  try {
    const analysis = await analyzeAndSaveActivityMaterial(id);

    return NextResponse.json({ analysis, ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "자료 분석 중 알 수 없는 오류가 발생했어요.";

    return NextResponse.json({ error: message, ok: false }, { status: 400 });
  }
}
