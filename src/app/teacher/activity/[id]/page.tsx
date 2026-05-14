import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";
import {
  materialTypeLabels,
  openModeLabels,
  toOpenModes,
} from "@/lib/activity-labels";
import type { MaterialAnalysis } from "@/lib/ai/gemini";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

import { AnalyzeMaterialButton } from "./AnalyzeMaterialButton";

type TeacherActivityPageProps = {
  params: Promise<{ id: string }>;
};

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL 환경변수가 없습니다. .env.local에 앱 주소를 추가해 주세요.",
    );
  }

  return appUrl.replace(/\/$/, "");
}

function parseAnalysis(value: unknown): MaterialAnalysis | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const analysis = value as Partial<MaterialAnalysis>;

  if (
    typeof analysis.summary !== "string" ||
    !Array.isArray(analysis.keywords) ||
    !Array.isArray(analysis.main_elements) ||
    !Array.isArray(analysis.related_scopes) ||
    !Array.isArray(analysis.unrelated_scopes) ||
    typeof analysis.teacher_note !== "string"
  ) {
    return null;
  }

  return analysis as MaterialAnalysis;
}

function ListBlock({ items }: { items: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default async function TeacherActivityPage({
  params,
}: TeacherActivityPageProps) {
  const { id } = await params;
  const supabase = getServiceSupabaseClient();
  const { data: activity, error } = await supabase
    .from("activities")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !activity) {
    return (
      <PageShell
        description="활동 정보를 불러오지 못했어요."
        eyebrow="Activity"
        title="활동을 찾을 수 없어요"
        tone="teacher"
      >
        <Card className="grid gap-4">
          <p className="text-lg text-slate-600">
            초대 링크가 맞는지 확인해 주세요.
          </p>
          <Button href="/teacher" variant="quiet">
            목록으로 돌아가기
          </Button>
        </Card>
      </PageShell>
    );
  }

  const inviteUrl = `${getAppUrl()}/join/${activity.invite_code}`;
  const openModes = toOpenModes(activity.enabled_modes);
  const analysis = parseAnalysis(activity.ai_material_analysis);

  return (
    <PageShell
      actions={<Button href="/teacher" variant="quiet">목록으로</Button>}
      description="학생에게 초대 링크를 알려 주세요."
      eyebrow={`Code ${activity.invite_code}`}
      title={activity.title}
      tone="teacher"
    >
      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm font-bold text-slate-500">초대 링크</p>
          <p className="mt-3 break-all rounded-xl bg-slate-50 p-4 text-lg font-bold text-slate-800">
            {inviteUrl}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-slate-500">초대 코드</p>
          <p className="mt-3 text-4xl font-bold tracking-normal">
            {activity.invite_code}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-bold text-slate-500">자료 유형</p>
          <p className="mt-2 text-2xl font-bold">
            {materialTypeLabels[activity.material_type]}
          </p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-slate-500">제한 시간</p>
          <p className="mt-2 text-2xl font-bold">
            {Math.round(activity.time_limit_sec / 60)}분
          </p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-slate-500">상태</p>
          <p className="mt-2 text-2xl font-bold">{activity.status}</p>
        </Card>
      </section>

      <Card>
        <h2 className="text-2xl font-bold">공개 모드</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {openModes.map((mode) => (
            <span
              className="rounded-full bg-sky-50 px-4 py-2 text-base font-bold text-sky-700"
              key={mode}
            >
              {openModeLabels[mode]}
            </span>
          ))}
        </div>
      </Card>

      <Card className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">AI 자료 분석</h2>
            <p className="mt-2 text-slate-600">
              자료와 관련 있는 질문을 판단할 기준을 만듭니다.
            </p>
          </div>
          <AnalyzeMaterialButton activityId={activity.id} hasAnalysis={!!analysis} />
        </div>

        {analysis ? (
          <div className="grid gap-4">
            <div className="rounded-xl bg-teal-50 p-4">
              <p className="text-sm font-bold text-teal-700">요약</p>
              <p className="mt-2 text-lg leading-8 text-slate-800">
                {analysis.summary}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-bold">핵심 키워드</p>
                <ListBlock items={analysis.keywords} />
              </div>
              <div>
                <p className="font-bold">등장 요소</p>
                <ListBlock items={analysis.main_elements} />
              </div>
              <div>
                <p className="font-bold">관련 질문 범위</p>
                <ListBlock items={analysis.related_scopes} />
              </div>
              <div>
                <p className="font-bold">무관한 질문 범위</p>
                <ListBlock items={analysis.unrelated_scopes} />
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-700">교사용 참고</p>
              <p className="mt-2 text-lg leading-8 text-slate-800">
                {analysis.teacher_note}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-lg font-bold text-slate-600">
            아직 분석 결과가 없어요. 자료 분석하기를 눌러 주세요.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-2xl font-bold">자료 내용</h2>
        <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-lg leading-8 text-slate-700">
          {activity.material_text}
        </p>
      </Card>
    </PageShell>
  );
}
