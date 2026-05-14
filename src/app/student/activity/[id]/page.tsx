import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";
import {
  openModeLabels,
  toEnabledModes,
  type OpenMode,
} from "@/lib/activity-labels";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type StudentActivityPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId?: string }>;
};

type ModeCardProps = {
  description: string;
  enabled: boolean;
  href: string;
  mode: OpenMode;
};

function formatMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))}분`;
}

function getPreviewText(summary: string | null, materialText: string | null) {
  if (summary?.trim()) {
    return summary;
  }

  const text = materialText?.trim();

  if (!text) {
    return "선생님이 자료를 준비하고 있어요.";
  }

  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function getKeywords(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function ModeCard({ description, enabled, href, mode }: ModeCardProps) {
  if (!enabled) {
    return (
      <Card className="grid gap-4 bg-slate-50 opacity-80">
        <h2 className="text-2xl font-bold text-slate-500">
          {openModeLabels[mode]}
        </h2>
        <p className="text-lg text-slate-500">선생님이 아직 열지 않았어요.</p>
      </Card>
    );
  }

  return (
    <Card className="grid gap-4">
      <h2 className="text-2xl font-bold">{openModeLabels[mode]}</h2>
      <p className="text-lg text-slate-600">{description}</p>
      <Button href={href}>시작하기</Button>
    </Card>
  );
}

function ErrorView({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <PageShell description={description} eyebrow="질문 코치" title={title}>
      <Card className="grid gap-4">
        <p className="text-lg text-slate-600">{description}</p>
        <Button href="/" variant="quiet">
          처음으로
        </Button>
      </Card>
    </PageShell>
  );
}

export default async function StudentActivityPage({
  params,
  searchParams,
}: StudentActivityPageProps) {
  const { id } = await params;
  const { studentId } = await searchParams;

  if (!studentId) {
    return (
      <ErrorView
        description="초대 링크에서 이름을 쓰고 다시 들어와 주세요."
        title="참여 정보가 없어요"
      />
    );
  }

  const supabase = getServiceSupabaseClient();
  const [
    { data: activity, error: activityError },
    { data: student, error: studentError },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select(
        "id,title,material_text,material_summary,material_keywords,time_limit_sec,enabled_modes,solve_mode_open",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("students")
      .select("id,display_name,activity_id")
      .eq("id", studentId)
      .single(),
  ]);

  if (activityError || !activity) {
    return (
      <ErrorView
        description={
          activityError?.message
            ? `활동을 불러오지 못했어요: ${activityError.message}`
            : "활동 주소가 맞는지 선생님께 확인해 주세요."
        }
        title="활동을 찾을 수 없어요"
      />
    );
  }

  if (studentError || !student || student.activity_id !== activity.id) {
    return (
      <ErrorView
        description={
          studentError?.message
            ? `학생 정보를 불러오지 못했어요: ${studentError.message}`
            : "이 활동에 참여한 학생 정보가 아니에요."
        }
        title="학생 정보를 확인해 주세요"
      />
    );
  }

  const [
    { count: questionCount, error: questionCountError },
    { count: answerCount, error: answerCountError },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("activity_id", activity.id)
      .eq("student_id", student.id),
    supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student.id),
  ]);

  const enabledModes = toEnabledModes(activity.enabled_modes);
  const solveEnabled =
    enabledModes.solve_friend_question || activity.solve_mode_open;
  const studentQuery = `?studentId=${student.id}`;
  const previewText = getPreviewText(
    activity.material_summary,
    activity.material_text,
  );
  const keywords = getKeywords(activity.material_keywords);

  return (
    <PageShell
      description={`${student.display_name}님, 하고 싶은 활동을 골라요.`}
      eyebrow="질문 코치"
      title={activity.title}
    >
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <p className="text-sm font-bold text-sky-700">자료 미리보기</p>
          <h2 className="mt-2 text-2xl font-bold">{activity.title}</h2>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-slate-700">
            {previewText}
          </p>
          {keywords.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span
                  className="rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-sky-700"
                  key={keyword}
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        <Card className="grid content-start gap-4">
          <div>
            <p className="text-sm font-bold text-slate-500">내 이름</p>
            <p className="mt-1 text-2xl font-bold">{student.display_name}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">제한 시간</p>
            <p className="mt-1 text-2xl font-bold">
              {formatMinutes(activity.time_limit_sec)}
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ModeCard
          description="떠오른 질문을 바로 써요."
          enabled={enabledModes.quick_question}
          href={`/student/quick/${activity.id}${studentQuery}`}
          mode="quick_question"
        />
        <ModeCard
          description="왜 그런지 깊게 물어봐요."
          enabled={enabledModes.inquiry_question}
          href={`/student/inquiry/${activity.id}${studentQuery}`}
          mode="inquiry_question"
        />
        <ModeCard
          description="친구의 질문을 읽고 답해요."
          enabled={solveEnabled}
          href={`/student/solve/${activity.id}${studentQuery}`}
          mode="solve_friend_question"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm font-bold text-slate-500">내가 만든 질문 수</p>
          <p className="mt-2 text-4xl font-bold">{questionCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-slate-500">내가 푼 답변 수</p>
          <p className="mt-2 text-4xl font-bold">{answerCount ?? 0}</p>
        </Card>
      </section>

      {questionCountError || answerCountError ? (
        <Card>
          <p className="text-lg font-bold text-red-700">
            기록을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
          </p>
        </Card>
      ) : null}
    </PageShell>
  );
}
