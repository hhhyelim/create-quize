import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";
import { Textarea } from "@/components/Textarea";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type InquiryPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ studentId?: string }>;
};

export default async function InquiryPage({
  params,
  searchParams,
}: InquiryPageProps) {
  const { id } = await params;
  const { studentId } = await searchParams;
  const supabase = getServiceSupabaseClient();
  const { data: activity } = await supabase
    .from("activities")
    .select("id,title")
    .eq("id", id)
    .single();
  const activityId = activity?.id ?? id;
  const studentQuery = studentId ? `?studentId=${studentId}` : "";

  return (
    <PageShell
      description="이유와 증거를 생각하며 질문을 다듬어요."
      eyebrow={activity?.title ?? "질문 활동"}
      title="탐구 질문 만들기"
    >
      <Card className="mx-auto grid w-full max-w-2xl gap-5">
        <div className="grid gap-3">
          <p className="rounded-xl bg-sky-100 p-4 text-xl font-bold">
            왜 그렇게 생각했나요?
          </p>
          <p className="rounded-xl bg-teal-50 p-4 text-xl font-bold">
            더 알아보면 좋은 것은 무엇인가요?
          </p>
        </div>
        <Textarea placeholder="내 탐구 질문을 써 보세요." />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary">저장하기</Button>
          <Button href={`/student/activity/${activityId}${studentQuery}`} variant="quiet">
            돌아가기
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
