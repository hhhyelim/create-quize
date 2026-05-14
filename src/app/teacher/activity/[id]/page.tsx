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
import { closeActivity, openSolveMode, updateQuestionStatus } from "./actions";

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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function getPreviewText(materialText: string | null) {
  const text = materialText?.trim();

  if (!text) {
    return "자료 내용이 없습니다.";
  }

  return text.length > 260 ? `${text.slice(0, 260)}...` : text;
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </Card>
  );
}

function HiddenInput({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  return <input name={name} type="hidden" value={value} />;
}

export default async function TeacherActivityPage({
  params,
}: TeacherActivityPageProps) {
  const { id } = await params;
  const supabase = getServiceSupabaseClient();
  const [
    { data: activity, error: activityError },
    { data: students, error: studentsError },
    { data: questions, error: questionsError },
    { data: answers, error: answersError },
    { data: coachingLogs, error: coachingLogsError },
  ] = await Promise.all([
    supabase.from("activities").select("*").eq("id", id).single(),
    supabase
      .from("students")
      .select("id,display_name,rejected_count,warning_shown")
      .eq("activity_id", id)
      .order("display_name", { ascending: true }),
    supabase
      .from("questions")
      .select("id,student_id,question_text,status,created_at")
      .eq("activity_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("answers").select("id,question_id,student_id"),
    supabase.from("coaching_logs").select("id,student_id").eq("activity_id", id),
  ]);

  if (activityError || !activity) {
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

  const safeStudents = students ?? [];
  const safeQuestions = questions ?? [];
  const safeAnswers = answers ?? [];
  const safeCoachingLogs = coachingLogs ?? [];
  const inviteUrl = `${getAppUrl()}/join/${activity.invite_code}`;
  const openModes = toOpenModes(activity.enabled_modes);
  const analysis = parseAnalysis(activity.ai_material_analysis);
  const studentById = new Map(
    safeStudents.map((student) => [student.id, student]),
  );
  const questionCountsByStudent = new Map<string, number>();
  const answerCountsByStudent = new Map<string, number>();
  const answerCountsByQuestion = new Map<string, number>();

  for (const question of safeQuestions) {
    questionCountsByStudent.set(
      question.student_id,
      (questionCountsByStudent.get(question.student_id) ?? 0) + 1,
    );
  }

  for (const answer of safeAnswers) {
    answerCountsByStudent.set(
      answer.student_id,
      (answerCountsByStudent.get(answer.student_id) ?? 0) + 1,
    );
    answerCountsByQuestion.set(
      answer.question_id,
      (answerCountsByQuestion.get(answer.question_id) ?? 0) + 1,
    );
  }

  const rejectedTotal = safeStudents.reduce(
    (sum, student) => sum + (student.rejected_count ?? 0),
    0,
  );
  const hasQueryError =
    studentsError || questionsError || answersError || coachingLogsError;

  return (
    <PageShell
      actions={<Button href="/teacher" variant="quiet">목록으로</Button>}
      description="활동 진행 상태와 학생 질문 흐름을 확인해요."
      eyebrow={`Code ${activity.invite_code}`}
      title={activity.title}
      tone="teacher"
    >
      {hasQueryError ? (
        <Card>
          <p className="text-lg font-bold text-red-700">
            일부 현황을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm font-bold text-slate-500">활동 제목</p>
              <p className="mt-2 text-2xl font-bold">{activity.title}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">초대 코드</p>
              <p className="mt-2 text-3xl font-bold">{activity.invite_code}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">초대 링크</p>
            <p className="mt-2 break-all rounded-xl bg-slate-50 p-4 text-base font-bold text-slate-800">
              {inviteUrl}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-sm font-bold text-slate-500">자료 유형</p>
              <p className="mt-2 text-lg font-bold">
                {materialTypeLabels[activity.material_type]}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">제한 시간</p>
              <p className="mt-2 text-lg font-bold">
                {Math.round(activity.time_limit_sec / 60)}분
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500">활동 상태</p>
              <p className="mt-2 text-lg font-bold">
                {activity.status === "closed" ? "종료됨" : "진행 중"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">공개 중인 모드</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {openModes.map((mode) => (
                <span
                  className="rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-sky-700"
                  key={mode}
                >
                  {openModeLabels[mode]}
                </span>
              ))}
              {activity.solve_mode_open ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                  친구 질문 풀기 시작됨
                </span>
              ) : null}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">자료 내용 미리보기</p>
            {activity.material_type === "image" && activity.material_url ? (
              <div className="mt-2 grid gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="활동 이미지 자료"
                  className="max-h-[420px] w-full rounded-xl object-contain ring-1 ring-slate-200"
                  src={activity.material_url}
                />
                <p className="break-all rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
                  {activity.material_url}
                </p>
              </div>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-700">
              {getPreviewText(activity.material_text)}
            </p>
          </div>
        </Card>

        <Card className="grid content-start gap-3">
          <h2 className="text-2xl font-bold">운영</h2>
          <form action={openSolveMode}>
            <HiddenInput name="activityId" value={activity.id} />
            <Button
              className="w-full"
              disabled={activity.solve_mode_open}
              type="submit"
              variant="secondary"
            >
              {activity.solve_mode_open ? "질문 풀기 시작됨" : "질문 풀기 시작"}
            </Button>
          </form>
          <form action={closeActivity}>
            <HiddenInput name="activityId" value={activity.id} />
            <Button
              className="w-full"
              disabled={activity.status === "closed"}
              type="submit"
              variant="quiet"
            >
              {activity.status === "closed" ? "활동 종료됨" : "활동 종료"}
            </Button>
          </form>
        </Card>
      </section>

      <Card className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">AI 자료 분석</h2>
            <p className="mt-2 text-slate-600">
              학생 질문을 자료와 연결해 볼 때 참고하는 교사용 정보입니다.
            </p>
          </div>
          <AnalyzeMaterialButton activityId={activity.id} hasAnalysis={!!analysis} />
        </div>

        {analysis ? (
          <div className="grid gap-4">
            <div className="rounded-xl bg-teal-50 p-4">
              <p className="text-sm font-bold text-teal-700">자료 요약</p>
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
                <p className="font-bold">질문 가능 방향</p>
                <ListBlock items={analysis.related_scopes} />
              </div>
              <div>
                <p className="font-bold">자료 밖으로 벗어나기 쉬운 방향</p>
                <ListBlock items={analysis.unrelated_scopes} />
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-700">교사용 참고 설명</p>
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

      <section className="grid gap-4 md:grid-cols-5">
        <StatCard label="참여 학생 수" value={safeStudents.length} />
        <StatCard label="생성 질문 수" value={safeQuestions.length} />
        <StatCard label="답변 수" value={safeAnswers.length} />
        <StatCard label="탐구 힌트 사용" value={safeCoachingLogs.length} />
        <StatCard label="거절 횟수 합계" value={rejectedTotal} />
      </section>

      <Card>
        <h2 className="text-2xl font-bold">학생 목록</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-sm text-slate-500">
                <th className="px-3 py-2">학생 이름</th>
                <th className="px-3 py-2">만든 질문 수</th>
                <th className="px-3 py-2">답변 수</th>
                <th className="px-3 py-2">거절 횟수</th>
                <th className="px-3 py-2">경고 표시</th>
              </tr>
            </thead>
            <tbody>
              {safeStudents.map((student) => (
                <tr className="bg-slate-50 text-base" key={student.id}>
                  <td className="rounded-l-xl px-3 py-3 font-bold">
                    {student.display_name}
                  </td>
                  <td className="px-3 py-3">
                    {questionCountsByStudent.get(student.id) ?? 0}
                  </td>
                  <td className="px-3 py-3">
                    {answerCountsByStudent.get(student.id) ?? 0}
                  </td>
                  <td className="px-3 py-3">{student.rejected_count ?? 0}</td>
                  <td className="rounded-r-xl px-3 py-3">
                    {student.warning_shown ? "표시됨" : "없음"}
                  </td>
                </tr>
              ))}
              {!safeStudents.length ? (
                <tr>
                  <td
                    className="rounded-xl bg-slate-50 px-3 py-4 text-slate-600"
                    colSpan={5}
                  >
                    아직 참여한 학생이 없어요.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold">질문 목록</h2>
        <div className="mt-4 grid gap-3">
          {safeQuestions.map((question) => {
            const student = studentById.get(question.student_id);
            const nextStatus =
              question.status === "hidden" ? "accepted" : "hidden";

            return (
              <div
                className="grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-[1fr_auto]"
                key={question.id}
              >
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2 text-sm font-bold text-slate-500">
                    <span>{student?.display_name ?? "알 수 없는 학생"}</span>
                    <span>{question.status === "hidden" ? "숨김" : "공개"}</span>
                    <span>답변 {answerCountsByQuestion.get(question.id) ?? 0}</span>
                    <span>{formatDate(question.created_at)}</span>
                  </div>
                  <p className="text-lg leading-8 text-slate-900">
                    {question.question_text}
                  </p>
                </div>
                <form action={updateQuestionStatus} className="self-center">
                  <HiddenInput name="activityId" value={activity.id} />
                  <HiddenInput name="questionId" value={question.id} />
                  <HiddenInput name="status" value={nextStatus} />
                  <Button type="submit" variant="quiet">
                    {question.status === "hidden" ? "복구" : "숨기기"}
                  </Button>
                </form>
              </div>
            );
          })}
          {!safeQuestions.length ? (
            <p className="rounded-xl bg-slate-50 p-4 text-lg text-slate-600">
              아직 생성된 질문이 없어요.
            </p>
          ) : null}
        </div>
      </Card>
    </PageShell>
  );
}
