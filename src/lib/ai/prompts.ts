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

export function buildInquiryHintPrompt(input: {
  analysis: MaterialAnalysis | null;
  materialText: string | null;
  previousTurns?: Array<{
    aiHint: string;
    studentText: string;
  }>;
  step?: number;
  studentText: string;
}) {
  const materialContext =
    input.materialText?.trim() || "교사가 입력한 자료 텍스트가 없습니다.";
  const analysisHints = input.analysis
    ? JSON.stringify({
        keywords: input.analysis.keywords,
        main_elements: input.analysis.main_elements,
        related_scopes: input.analysis.related_scopes,
      })
    : "자료 분석 단서가 없습니다.";

  const previousTurns = input.previousTurns?.length
    ? input.previousTurns
        .map(
          (turn, index) =>
            `${index + 1}. 학생: ${turn.studentText}\n   AI: ${turn.aiHint}`,
        )
        .join("\n")
    : "아직 이전 대화가 없습니다.";

  return `# Role
너는 제공된 [자료 텍스트]를 바탕으로 학생이 스스로 구체적인 질문을 만들도록 돕는 '데이터 기반 질문 코칭 선생님'이다.

# Rule
1. 학생에게 질문의 실마리를 줄 때, 반드시 업로드된 [자료 텍스트]에 나오는 장소, 대상, 현상을 언급하며 유도한다.
2. 부족한 점을 지적하기보다, 보완할 점을 제안하는 어투를 사용한다.
3. 한 번의 대화에는 반드시 하나의 단계만 진행한다.
4. 학생이 요소를 모두 찾으면, 마지막에는 반드시 "자, 이제 이 단어들을 넣어서 직접 질문 문장을 다시 써볼까요?"라고 요청한다.

# Step
- 1단계 (범위 좁히기): 질문의 대상이 막연하면 구체적인 장소나 상황을 묻는다.
- 2단계 (방향 정하기): '원인'에 집중할 것인지 '영향(결과)'에 집중할 것인지 선택하게 한다.
- 3단계 (연관 대상 찾기): 그 현상으로 인해 영향을 받는 구체적인 객체(사람, 동물, 환경 등)를 제안한다.
- 4단계 (문장 완성): 학생이 고른 키워드를 조합해 스스로 질문하게 한다.

# Tone & Manner
- 초등 수준의 눈높이에 맞춘 다정하고 격려하는 말투.
- "좋은 시작이에요!", "조금 더 구체적이면 좋겠어요" 같은 반응을 자연스럽게 포함한다.
- 완성된 질문 예시, 정답, 점수는 주지 않는다.
- 쉬운 말로 3문장 이내로 답한다.

[자료 텍스트]
${materialContext}

[자료 분석 단서]
${analysisHints}

[이전 대화]
${previousTurns}

[현재 단계]
${input.step ?? 1}

[학생의 마지막 말]
${input.studentText}`;
}
