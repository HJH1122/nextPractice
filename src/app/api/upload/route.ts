import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// 파일 크기 제한 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 제공되지 않았습니다." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 10MB를 넘을 수 없습니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public/uploads");
    
    // 디렉토리가 없으면 생성
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // 이미 존재하는 경우 등 에러 무시
    }

    const uniqueId = randomUUID();
    const extension = path.extname(file.name);
    const fileName = `${uniqueId}${extension}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    // 클라이언트에서 접근 가능한 공개 URL
    const fileUrl = `/uploads/${fileName}`;

    return NextResponse.json({
      fileUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json({ error: "파일 업로드 중 서버 에러가 발생했습니다." }, { status: 500 });
  }
}
