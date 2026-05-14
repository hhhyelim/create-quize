import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

import { QuickQuestionForm } from "./QuickQuestionForm";

type QuickPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId?: string }>;
};

function getPreviewText(summary: string | null, materialText: string | null) {
  if (summary?.trim()) {
    return summary;
  }

  const text = materialText?.trim();

  if (!text) {
    return "선생님이 자료를 준비하고 있어요.";
  }

  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function ErrorView({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <PageShell description={description} eyebrow="질문 놀이" title={title}>
      <Card className="grid gap-4">
        <p className="text-lg text-slate-600">{description}</p>
        <Button href="/" variant="quiet">
          처음으로
        </Button>
      </Card>
    </PageShell>
  );
}

export default async function QuickPage({ params, searchParams }: QuickPageProps) {
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
    { data: questions, error: questionsError },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("id,title,material_text,material_summary,time_limit_sec")
      .eq("id", id)
      .single(),
    supabase
      .from("students")
      .select("id,display_name,activity_id,rejected_count,warning_shown")
      .eq("id", studentId)
      .single(),
    supabase
      .from("questions")
      .select("id,question_text")
      .eq("activity_id", id)
      .eq("student_id", studentId)
      .eq("status", "accepted")
      .order("created_at", { ascending: false }),
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

  const initialWarningRequired = student.rejected_count >= 3;

  if (initialWarningRequired && !student.warning_shown) {
    await supabase
      .from("students")
      .update({ warning_shown: true })
      .eq("id", student.id);
  }

  return (
    <PageShell
      description={`${student.display_name}님, 궁금한 점을 써 보세요.`}
      eyebrow={activity.title}
      title="질문 놀이"
    >
      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="grid content-start gap-4">
          <div>
            <p className="text-sm font-bold text-sky-700">자료 미리보기</p>
            <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-slate-700">
              {getPreviewText(activity.material_summary, activity.material_text)}
            </p>
          </div>
          <Button
            href={`/student/activity/${activity.id}?studentId=${student.id}`}
            variant="quiet"
          >
            활동으로 돌아가기
          </Button>
        </Card>

        <Card>
          {questionsError ? (
            <p className="mb-4 rounded-xl bg-red-50 p-4 text-base font-bold text-red-700">
              질문 목록을 불러오지 못했어요.
            </p>
          ) : null}
          <QuickQuestionForm
            activityId={activity.id}
            initialWarningRequired={initialWarningRequired}
            initialQuestions={questions ?? []}
            studentId={student.id}
            timeLimitSec={activity.time_limit_sec}
          />
        </Card>
      </section>
    </PageShell>
  );
}
