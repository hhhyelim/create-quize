type StudentMaterialPreviewProps = {
  materialText: string | null;
  materialType?: "text" | "image" | "txt";
  materialUrl?: string | null;
};

function getMaterialText(materialText: string | null) {
  const text = materialText?.trim();

  return text || "선생님이 자료를 준비하고 있어요.";
}

export function StudentMaterialPreview({
  materialText,
  materialType = "text",
  materialUrl,
}: StudentMaterialPreviewProps) {
  const shouldShowText = materialType !== "image" || !!materialText?.trim();

  return (
    <div className="grid gap-3">
      <p className="text-sm font-bold text-sky-700">자료 미리보기</p>
      {materialType === "image" && materialUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="활동 자료"
          className="max-h-[420px] w-full rounded-xl object-contain ring-1 ring-slate-200"
          src={materialUrl}
        />
      ) : null}
      {shouldShowText ? (
        <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-lg leading-8 text-slate-700">
          {getMaterialText(materialText)}
        </p>
      ) : null}
    </div>
  );
}
