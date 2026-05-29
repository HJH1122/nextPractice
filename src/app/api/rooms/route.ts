import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSafeIo } from "@/lib/socket";

export async function GET() {
  try {
    const io = getSafeIo();
    
    // global에 저장된 roomUsers 가져오기
    const globalForSocket = global as any;
    const roomUsers = globalForSocket.roomUsers as Map<string, Map<string, string>>;

    const rooms = await db.room.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Augment rooms with participant counts and list if available
    const roomsWithParticipants = rooms.map(room => {
      const userMap = roomUsers?.get(room.id);
      const participants = userMap ? Array.from(userMap).map(([id, name]) => ({ id, name })) : [];
      
      return {
        ...room,
        participantCount: participants.length,
        participants,
      };
    });

    return NextResponse.json(roomsWithParticipants);
  } catch (error) {
    console.error("[ROOMS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


export async function POST(req: Request) {
  try {
    const { name, creatorId } = await req.json();

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!creatorId) {
      return new NextResponse("Creator ID is required", { status: 400 });
    }

    // Ensure the creator user exists
    await db.user.upsert({
      where: { id: creatorId },
      update: {},
      create: { 
        id: creatorId, 
        name: creatorId 
      },
    });

    const room = await db.room.create({
      data: {
        name,
        creatorId,
      },
    });

    return NextResponse.json(room);
  } catch (error) {
    console.error("[ROOMS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
