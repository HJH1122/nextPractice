import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
import { Message, NextApiResponseServerIo } from "@/types/socket";
import { db } from "@/lib/db";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (!res.socket.server.io) {
    const path = "/api/socket/io";
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: path,
      addTrailingSlash: false,
    });
    res.socket.server.io = io;

    io.on("connection", (socket) => {
      console.log(`[SOCKET_IO] Client connected: ${socket.id}`);

      socket.on("send-message", async (message: Message) => {
        try {
          // 1. DB에 메시지 저장
          const savedMessage = await db.message.create({
            data: {
              content: message.content,
              userId: message.senderId,
              roomId: message.roomId,
              createdAt: new Date(message.timestamp),
            },
            include: {
              user: {
                select: {
                  name: true,
                  imageUrl: true,
                }
              }
            }
          });

          console.log(`[SOCKET_IO] Message saved and broadcasting: ${savedMessage.content}`);

          // 2. 저장된 메시지를 해당 방의 유저들에게 브로드캐스트
          // (여기서는 단순하게 전체 emit 하지만, roomId가 있을 경우 io.to(message.roomId).emit 등을 활용)
          const broadcastMessage: Message = {
            id: savedMessage.id,
            content: savedMessage.content,
            senderId: savedMessage.userId,
            roomId: savedMessage.roomId,
            timestamp: savedMessage.createdAt.toISOString(),
            user: savedMessage.user,
          };

          io.emit("receive-message", broadcastMessage);
        } catch (error) {
          console.error("[SOCKET_IO_ERROR]", error);
        }
      });

      socket.on("disconnect", () => {
        console.log("[SOCKET_IO] Client disconnected");
      });
    });
  }

  res.end();
};

export default ioHandler;
