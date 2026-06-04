import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSafeIo } from "@/lib/socket";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { creatorId, isLocked } = await req.json();
    const { roomId } = await params;

    if (!creatorId) {
      return new NextResponse("Creator ID is required", { status: 400 });
    }

    const room = await db.room.findUnique({
      where: {
        id: roomId,
      },
    });

    if (!room) {
      return new NextResponse("Room not found", { status: 404 });
    }

    if (room.creatorId !== creatorId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const updatedRoom = await db.room.update({
      where: {
        id: roomId,
      },
      data: {
        isLocked,
      },
    });

    // Notify all clients that the room lock status has changed
    const io = getSafeIo();
    if (io) {
      io.emit("room-lock-status-changed", { roomId, isLocked });
      
      // Also send a system message to the room
      const systemMessage = {
        id: `system-lock-${Date.now()}`,
        content: isLocked ? "방장에 의해 방이 잠겼습니다. 새로운 참가자가 들어올 수 없습니다." : "방의 잠금이 해제되었습니다. 이제 누구나 참여할 수 있습니다.",
        senderId: "system",
        roomId: roomId,
        timestamp: new Date().toISOString(),
        type: "SYSTEM",
      };
      io.to(roomId).emit("receive-message", systemMessage);
    }

    return NextResponse.json(updatedRoom);
  } catch (error) {
    console.error("[ROOM_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { creatorId } = await req.json();
    const { roomId } = await params;

    if (!creatorId) {
      return new NextResponse("Creator ID is required", { status: 400 });
    }

    const room = await db.room.findUnique({
      where: {
        id: roomId,
      },
    });

    if (!room) {
      return new NextResponse("Room not found", { status: 404 });
    }

    if (room.creatorId !== creatorId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Delete the room. Cascading delete is configured in Prisma,
    // so messages, polls, etc., will be deleted automatically.
    await db.room.delete({
      where: {
        id: roomId,
      },
    });

    // Notify all clients in the room that the room has been deleted
    const io = getSafeIo();
    if (io) {
      io.to(roomId).emit("room-deleted", { roomId });
      console.log(`[ROOM_DELETE] Room ${roomId} deleted. Broadcasted to clients.`);
    } else {
      console.warn(`[ROOM_DELETE] Room ${roomId} deleted, but Socket.IO was not initialized to broadcast.`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ROOM_DELETE_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
