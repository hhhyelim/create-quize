import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";

export default function Home() {
  return (
    <PageShell
      description="질문을 만들고, 생각을 키우고, 친구와 나눠요."
      eyebrow="Question Coach"
      title="AI 질문 코치"
    >
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="grid gap-4">
          <h2 className="text-2xl font-bold">선생님</h2>
          <p className="text-lg leading-8 text-slate-600">
            활동을 만들고 학생 질문을 확인해요.
          </p>
          <Button href="/teacher" variant="secondary">
            교사용으로 가기
          </Button>
        </Card>
        <Card className="grid gap-4">
          <h2 className="text-2xl font-bold">학생</h2>
          <p className="text-lg leading-8 text-slate-600">
            참여 코드로 들어가 질문을 써요.
          </p>
          <Button href="/join/STAR24">학생으로 시작</Button>
        </Card>
      </section>
    </PageShell>
  );
}
