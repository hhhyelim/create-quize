export const mockTeacher = {
  name: "김하늘 선생님",
  school: "별빛초 4학년",
};

export const mockActivities = [
  {
    id: "activity-1",
    code: "STAR24",
    title: "좋은 질문 만들기",
    subject: "국어",
    status: "진행 중",
    students: 24,
    questions: 68,
    shortDescription: "글을 읽고 궁금한 점을 질문으로 바꿔요.",
  },
  {
    id: "activity-2",
    code: "TREE19",
    title: "우리 동네 문제 찾기",
    subject: "사회",
    status: "준비 중",
    students: 0,
    questions: 0,
    shortDescription: "생활 속 문제를 찾아 해결 질문을 만들어요.",
  },
];

export const mockStudent = {
  name: "민준",
  team: "파란 생각팀",
};

export const mockPrompts = [
  "왜 그렇게 생각했나요?",
  "다른 방법도 있을까요?",
  "친구에게 묻고 싶은 점은 무엇인가요?",
];

export function getActivity(id: string) {
  return mockActivities.find((activity) => activity.id === id) ?? mockActivities[0];
}
