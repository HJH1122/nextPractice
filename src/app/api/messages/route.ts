import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return new NextResponse("Room ID missing", { status: 400 });
    }

    // 최신 메시지 50개 로드
    const messages = await db.message.findMany({
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
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 50,
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.userId,
      roomId: m.roomId,
      timestamp: m.createdAt.toISOString(),
      user: m.user,
    }));

    return NextResponse.json(formattedMessages);
  } catch (error) {
    console.error("[MESSAGES_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
