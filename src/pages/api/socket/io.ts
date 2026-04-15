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
    console.log("[SOCKET_IO] Initializing new Socket.io server...");
    const path = "/api/socket/io";
    const httpServer: NetServer = res.socket.server as any;
    const io = new ServerIO(httpServer, {
      path: path,
    });
    
    // 접속 중인 사용자 정보를 저장할 맵 (socket.id -> username)
    const onlineUsers = new Map<string, string>();

    io.on("connection", (socket) => {
      console.log(`[SOCKET_IO] New client connected: ${socket.id}`);

      // 사용자가 채팅방에 입장할 때 호출
      socket.on("join", (username: string) => {
        onlineUsers.set(socket.id, username);
        console.log(`[SOCKET_IO] User joined: ${username} (${socket.id})`);
        
        // 전체 클라이언트에게 현재 접속자 목록 전송
        const userList = Array.from(new Set(onlineUsers.values()));
        io.emit("online-users", userList);
      });

      socket.on("send-message", async (message: Message) => {
        console.log("[SOCKET_IO] Received message event:", message.content);
        try {
          // 데이터베이스 저장
          await db.user.upsert({
            where: { id: message.senderId },
            update: {},
            create: { 
              id: message.senderId, 
              name: message.senderId // ID(사용자가 입력한 닉네임)를 이름으로 사용
            },
          });

          await db.room.upsert({
            where: { id: message.roomId },
            update: {},
            create: { id: message.roomId, name: "자유 게시판" },
          });

          const savedMessage = await db.message.create({
            data: {
              content: message.content,
              userId: message.senderId,
              roomId: message.roomId,
              createdAt: new Date(message.timestamp),
            },
            include: {
              user: { select: { name: true, imageUrl: true } }
            }
          });

          const broadcastMessage: Message = {
            id: savedMessage.id,
            content: savedMessage.content,
            senderId: savedMessage.userId,
            roomId: savedMessage.roomId,
            timestamp: savedMessage.createdAt.toISOString(),
            user: savedMessage.user,
          };

          console.log("[SOCKET_IO] Broadcasting to all clients...");
          io.emit("receive-message", broadcastMessage);
        } catch (error) {
          console.error("[SOCKET_IO_ERROR]", error);
        }
      });

      // 타이핑 시작 이벤트 처리
      socket.on("typing", ({ roomId, username }) => {
        // 본인을 제외한 다른 클라이언트들에게 전송
        socket.broadcast.emit("user-typing", { roomId, username });
      });

      // 타이핑 중단 이벤트 처리
      socket.on("stop-typing", ({ roomId, username }) => {
        socket.broadcast.emit("user-stop-typing", { roomId, username });
      });

      socket.on("disconnect", () => {
        console.log(`[SOCKET_IO] Client disconnected: ${socket.id}`);
        const username = onlineUsers.get(socket.id);
        if (username) {
          onlineUsers.delete(socket.id);
          console.log(`[SOCKET_IO] User left: ${username}`);
          
          // 업데이트된 접속자 목록 전송
          const userList = Array.from(new Set(onlineUsers.values()));
          io.emit("online-users", userList);
        }
      });
    });

    res.socket.server.io = io;
  } else {
    // 이미 서버가 존재하면 로그만 찍습니다.
    // console.log("[SOCKET_IO] Socket.io server already running");
  }

  res.end();
};

export default ioHandler;
