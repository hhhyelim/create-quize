import type { MaterialAnalysis } from "@/lib/ai/gemini";

export function buildMaterialAnalysisPrompt(materialText: string) {
  return `너는 초등학교 수업에서 사용할 질문 활동 자료 분석 도우미입니다.
교사가 제공한 자료를 읽고, 학생 질문이 자료와 관련 있는지 판단할 기준을 만듭니다.

해야 할 일:
1. 자료의 핵심 내용을 2~3문장으로 요약
2. 핵심 키워드 5~10개를 뽑습니다.
3. 자료와 관련된 질문 범위를 제시
4. 자료와 무관하다고 볼 수 있는 범위를 제시
5. 초등학생 질문 활동에 적합한 쉬운 표현을 사용

출력은 반드시 JSON으로 합니다.
{
  "summary": "자료 요약",
  "keywords": ["키워드1", "키워드2"],
  "main_elements": ["등장 요소1", "등장 요소2"],
  "related_scopes": ["원인", "영향", "해결 방법"],
  "unrelated_scopes": ["급식", "게임", "개인정보"],
  "teacher_note": "교사용 짧은 참고 설명"
}

자료:
${materialText}`;
}

export function buildQuestionFilterPrompt(input: {
  analysis: MaterialAnalysis;
  questionText: string;
}) {
  return `너는 초등학생 질문 활동의 안전 필터입니다.
학생이 교사가 제공한 자료를 보고 만든 질문을 검사합니다.
질문의 수준을 평가하지 말고, 최소 조건만 확인합니다.

입력으로는 자료 분석 결과와 학생 질문이 주어집니다.
자료 분석 결과의 summary, keywords, main_elements, related_scopes를 참고하여
학생 질문이 자료와 어느 정도 관련 있는지 판단합니다.

검사 기준:
1. 자료와 어느 정도 관련이 있는가?
2. 뜻이 있는 문장인가?
3. 질문 형태인가?
4. 욕설, 선정성, 폭력성, 혐오, 개인정보 요구, 친구 공격이 없는가?

출력은 반드시 JSON으로 합니다.
{
  "accepted": true 또는 false,
  "reason": "accepted | unrelated | unclear | not_question | harmful | personal_info | attack",
  "student_message": "학생에게 보여줄 짧은 안내 문장"
}

자료 분석 결과:
${JSON.stringify({
  keywords: input.analysis.keywords,
  main_elements: input.analysis.main_elements,
  related_scopes: input.analysis.related_scopes,
  summary: input.analysis.summary,
})}

학생 질문:
${input.questionText}`;
}
