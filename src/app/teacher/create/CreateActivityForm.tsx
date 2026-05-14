"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";

import { createActivityAction } from "./actions";

type MaterialType = "text" | "image" | "txt";

const MAX_TXT_SIZE = 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const imageTypes = ["image/png", "image/jpeg", "image/webp"];

type UploadResponse = {
  error?: string;
  materialUrl?: string;
  ok?: boolean;
};

function isTxtFile(file: File) {
  return file.name.toLowerCase().endsWith(".txt");
}

export function CreateActivityForm() {
  const [state, formAction, isPending] = useActionState(createActivityAction, {});
  const [clientError, setClientError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType>("text");
  const [txtContent, setTxtContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const txtInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isPending || isPreparing;
  const materialHelp = useMemo(() => {
    if (materialType === "text") {
      return "학생들이 읽고 질문을 만들 짧은 글을 넣어 주세요.";
    }

    if (materialType === "txt") {
      return "UTF-8 txt 파일을 올리면 글 내용을 읽어 저장해요.";
    }

    return "이미지는 업로드하고, 필요하면 교사용 설명을 함께 적어 주세요.";
  }, [materialType]);

  async function handleTxtFile(file: File | undefined) {
    setClientError("");
    setTxtContent("");

    if (!file) {
      return;
    }

    if (!isTxtFile(file)) {
      setClientError(".txt 파일만 업로드할 수 있어요.");
      txtInputRef.current!.value = "";
      return;
    }

    if (file.size > MAX_TXT_SIZE) {
      setClientError("TXT 파일은 1MB 이하로 올려 주세요.");
      txtInputRef.current!.value = "";
      return;
    }

    try {
      setTxtContent(await file.text());
    } catch {
      setClientError("TXT 파일을 UTF-8 텍스트로 읽지 못했어요.");
      txtInputRef.current!.value = "";
    }
  }

  async function uploadImageIfNeeded() {
    const file = imageInputRef.current?.files?.[0];

    if (imageUrl) {
      return imageUrl;
    }

    if (!file) {
      throw new Error("이미지를 업로드해 주세요.");
    }

    if (!imageTypes.includes(file.type)) {
      throw new Error("png, jpg, jpeg, webp 이미지만 업로드할 수 있어요.");
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error("이미지는 5MB 이하로 올려 주세요.");
    }

    const uploadForm = new FormData();
    uploadForm.append("file", file);

    const response = await fetch("/api/materials/upload", {
      body: uploadForm,
      method: "POST",
    });
    const result = (await response.json()) as UploadResponse;

    if (!response.ok || !result.ok || !result.materialUrl) {
      throw new Error(result.error ?? "이미지 업로드에 실패했어요.");
    }

    setImageUrl(result.materialUrl);
    return result.materialUrl;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError("");
    setIsPreparing(true);

    try {
      const formData = new FormData(event.currentTarget);

      if (materialType === "txt") {
        if (!txtContent.trim()) {
          throw new Error("TXT 파일을 업로드해 주세요.");
        }

        formData.set("content", txtContent);
      }

      if (materialType === "image") {
        formData.set("materialUrl", await uploadImageIfNeeded());
      }

      startTransition(() => {
        formAction(formData);
      });
    } catch (error) {
      setClientError(
        error instanceof Error
          ? error.message
          : "활동 생성 준비 중 문제가 생겼어요.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  function changeMaterialType(value: MaterialType) {
    setMaterialType(value);
    setClientError("");
    setImageUrl("");
    setTxtContent("");

    if (txtInputRef.current) {
      txtInputRef.current.value = "";
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      {state.error || clientError ? (
        <p className="rounded-xl bg-red-50 p-4 text-base font-bold text-red-700">
          {clientError || state.error}
        </p>
      ) : null}

      <label className="grid gap-2">
        <span className="text-base font-bold">활동 제목</span>
        <Input name="title" placeholder="예: 좋은 질문 만들기" required />
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-base font-bold">자료 유형</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["text", "직접 입력"],
            ["txt", "TXT 파일"],
            ["image", "이미지"],
          ].map(([value, label]) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-base font-bold"
              key={value}
            >
              <input
                checked={materialType === value}
                name="materialType"
                onChange={() => changeMaterialType(value as MaterialType)}
                type="radio"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-sm font-bold text-slate-500">{materialHelp}</p>
      </fieldset>

      {materialType === "text" ? (
        <label className="grid gap-2">
          <span className="text-base font-bold">자료 내용</span>
          <Textarea
            name="content"
            placeholder="학생들이 읽고 질문을 만들 짧은 글을 넣어 주세요."
            required
          />
        </label>
      ) : null}

      {materialType === "txt" ? (
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-base font-bold">TXT 파일</span>
            <Input
              accept=".txt,text/plain"
              onChange={(event) => handleTxtFile(event.target.files?.[0])}
              ref={txtInputRef}
              required
              type="file"
            />
          </label>
          <input name="content" type="hidden" value={txtContent} />
          {txtContent ? (
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-700">
              {txtContent}
            </p>
          ) : null}
        </div>
      ) : null}

      {materialType === "image" ? (
        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="text-base font-bold">이미지 파일</span>
            <Input
              accept="image/png,image/jpeg,image/webp"
              onChange={() => {
                setClientError("");
                setImageUrl("");
              }}
              ref={imageInputRef}
              required
              type="file"
            />
          </label>
          <input name="materialUrl" type="hidden" value={imageUrl} />
          <label className="grid gap-2">
            <span className="text-base font-bold">교사 보충 설명</span>
            <Textarea
              name="content"
              placeholder="이미지에서 학생들이 주목하면 좋을 내용을 짧게 적어 주세요."
            />
          </label>
        </div>
      ) : null}

      <label className="grid gap-2">
        <span className="text-base font-bold">제한 시간(분)</span>
        <Input
          defaultValue="15"
          max={180}
          min={1}
          name="timeLimitMinutes"
          required
          type="number"
        />
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-base font-bold">공개 모드</legend>
        <div className="grid gap-3">
          {[
            ["quick_question", "질문 놀이"],
            ["inquiry_question", "탐구 질문 만들기"],
            ["solve_friend_question", "친구의 질문 풀기"],
          ].map(([value, label]) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-base font-bold"
              key={value}
            >
              <input defaultChecked name="openModes" type="checkbox" value={value} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button disabled={isBusy} type="submit">
          {isBusy ? "만드는 중..." : "활동 생성"}
        </Button>
        <Button href="/teacher" variant="quiet">
          돌아가기
        </Button>
      </div>
    </form>
  );
}
