import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getServiceSupabaseClient } from "@/lib/supabase/server";

const BUCKET_NAME = "activity-materials";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "업로드 요청 형식이 올바르지 않아요.", ok: false },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "업로드할 이미지 파일을 선택해 주세요.", ok: false },
      { status: 400 },
    );
  }

  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    return NextResponse.json(
      { error: "png, jpg, jpeg, webp 이미지만 업로드할 수 있어요.", ok: false },
      { status: 400 },
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: "이미지는 5MB 이하로 올려 주세요.", ok: false },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabaseClient();
  const filePath = `materials/${randomUUID()}.${extension}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      {
        error:
          "이미지 업로드에 실패했어요. activity-materials 버킷이 있는지 확인해 주세요.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

  return NextResponse.json({
    materialUrl: data.publicUrl,
    ok: true,
    path: filePath,
  });
}
