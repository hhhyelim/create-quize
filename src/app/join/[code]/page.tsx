import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

import { JoinActivityForm } from "./JoinActivityForm";

type JoinPageProps = {
  params: Promise<{ code: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params;
  const inviteCode = code.toUpperCase();
  const supabase = getServiceSupabaseClient();
  const { data: activity, error } = await supabase
    .from("activities")
    .select("id,title,invite_code,status")
    .eq("invite_code", inviteCode)
    .single();

  if (error || !activity) {
    return (
      <PageShell
        description="초대 코드가 맞는지 선생님께 확인해 주세요."
        eyebrow={`Join ${inviteCode}`}
        title="활동을 찾을 수 없어요"
      >
        <Card className="mx-auto grid w-full max-w-xl gap-4">
          <p className="text-lg text-slate-600">
            아직 열리지 않았거나 코드가 다를 수 있어요.
          </p>
          <Button href="/" variant="quiet">
            처음으로
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      description="이름을 쓰고 질문 여행을 시작해요."
      eyebrow={`Join ${activity.invite_code}`}
      title={activity.title}
    >
      <Card className="mx-auto w-full max-w-xl">
        <JoinActivityForm activityId={activity.id} />
      </Card>
    </PageShell>
  );
}
