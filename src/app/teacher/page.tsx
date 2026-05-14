import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";
import { materialTypeLabels } from "@/lib/activity-labels";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

import { DeleteActivityForm } from "./DeleteActivityForm";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const supabase = getServiceSupabaseClient();
  const { data: activities, error } = await supabase
    .from("activities")
    .select("id,title,status,invite_code,material_type,time_limit_sec")
    .eq("teacher_id", "demo-teacher")
    .order("created_at", { ascending: false });

  return (
    <PageShell
      actions={<Button href="/teacher/create">활동 만들기</Button>}
      description="질문 활동을 만들고 초대 링크를 확인해요."
      eyebrow="Teacher Dashboard"
      title="교사용 대시보드"
      tone="teacher"
    >
      {error ? (
        <Card>
          <p className="text-lg font-bold text-red-700">
            활동 목록을 불러오지 못했어요: {error.message}
          </p>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-bold text-slate-500">활동 수</p>
          <p className="mt-2 text-4xl font-bold">{activities?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-slate-500">선생님 ID</p>
          <p className="mt-3 text-2xl font-bold">demo-teacher</p>
        </Card>
        <Card>
          <p className="text-sm font-bold text-slate-500">다음 단계</p>
          <p className="mt-3 text-xl font-bold">학생 초대</p>
        </Card>
      </section>

      <section className="grid gap-4">
        {activities?.length ? (
          activities.map((activity) => (
            <Card
              className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center"
              key={activity.id}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold">{activity.title}</h2>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-teal-700">
                    {activity.status}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-500">
                  코드 {activity.invite_code} ·{" "}
                  {materialTypeLabels[activity.material_type]} ·{" "}
                  {Math.round(activity.time_limit_sec / 60)}분
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button href={`/teacher/activity/${activity.id}`} variant="quiet">
                  자세히 보기
                </Button>
                <DeleteActivityForm
                  activityId={activity.id}
                  activityTitle={activity.title}
                />
              </div>
            </Card>
          ))
        ) : (
          <Card className="grid gap-4">
            <h2 className="text-2xl font-bold">아직 활동이 없어요</h2>
            <p className="text-lg text-slate-600">
              첫 질문 활동을 만들고 학생을 초대해 보세요.
            </p>
            <div>
              <Button href="/teacher/create">활동 만들기</Button>
            </div>
          </Card>
        )}
      </section>
    </PageShell>
  );
}
