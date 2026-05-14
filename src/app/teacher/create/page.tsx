import { Card } from "@/components/Card";
import { PageShell } from "@/components/PageShell";

import { CreateActivityForm } from "./CreateActivityForm";

export default function TeacherCreatePage() {
  return (
    <PageShell
      description="학생들이 쉽게 질문할 수 있는 활동을 준비해요."
      eyebrow="New Activity"
      title="질문 활동 만들기"
      tone="teacher"
    >
      <Card className="max-w-3xl">
        <CreateActivityForm />
      </Card>
    </PageShell>
  );
}
