import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const cursor = searchParams.get("cursor"); // 다음 페이지를 위한 커서

    if (!roomId) {
      return new NextResponse("Room ID missing", { status: 400 });
    }

    const MESSAGES_BATCH = 15;

    // Prisma 쿼리 공통 옵션
    const queryOptions = {
      take: MESSAGES_BATCH,
      where: {
        roomId,
      },
      include: {
        user: {
          select: {
            name: true,
            imageUrl: true,
          },
        },
        attachments: true,
      },
      orderBy: {
        createdAt: "desc" as const, // 최신순으로 가져와야 '이전' 데이터를 찾기 쉬움
      },
    };

    // 커서가 있는 경우 (이전 메시지 추가 로드)
    const messages = cursor 
      ? await db.message.findMany({
          ...queryOptions,
          skip: 1,
          cursor: {
            id: cursor,
          },
        })
      : await db.message.findMany(queryOptions);

    let nextCursor = null;

    if (messages.length === MESSAGES_BATCH) {
      nextCursor = messages[MESSAGES_BATCH - 1].id;
    }

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.userId,
      roomId: m.roomId,
      timestamp: m.createdAt.toISOString(),
      user: m.user,
      attachments: m.attachments,
      preview: m.previewTitle ? {
        title: m.previewTitle,
        description: m.previewDesc || "",
        image: m.previewImage || "",
        url: m.previewUrl || ""
      } : undefined
    })).reverse(); // UI에서는 시간순(asc)으로 보여줘야 하므로 다시 뒤집음

    return NextResponse.json({
      items: formattedMessages,
      nextCursor,
    });
  } catch (error) {
    console.error("[MESSAGES_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
