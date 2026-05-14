export const materialTypeLabels = {
  text: "직접 입력",
  image: "이미지",
  txt: "TXT 파일",
} as const;

export const openModeLabels = {
  quick_question: "질문 놀이",
  inquiry_question: "탐구 질문 만들기",
  solve_friend_question: "친구의 질문 풀기",
} as const;

export type OpenMode = keyof typeof openModeLabels;

const openModeKeys = [
  "quick_question",
  "inquiry_question",
  "solve_friend_question",
] as const;

export type EnabledModes = Record<OpenMode, boolean>;

function isOpenMode(value: unknown): value is OpenMode {
  return (
    value === "quick_question" ||
    value === "inquiry_question" ||
    value === "solve_friend_question"
  );
}

export function toEnabledModes(value: unknown): EnabledModes {
  const enabledModes: EnabledModes = {
    quick_question: false,
    inquiry_question: false,
    solve_friend_question: false,
  };

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (isOpenMode(item)) {
        enabledModes[item] = true;
      }
    });

    return enabledModes;
  }

  if (value && typeof value === "object") {
    const modeRecord = value as Record<string, unknown>;

    openModeKeys.forEach((mode) => {
      enabledModes[mode] = modeRecord[mode] === true;
    });
  }

  return enabledModes;
}

export function toOpenModes(value: unknown): OpenMode[] {
  const enabledModes = toEnabledModes(value);

  return openModeKeys.filter((mode) => enabledModes[mode]);
}
