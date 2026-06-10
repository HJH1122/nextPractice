import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Message } from "@/types/socket";
import { db } from "@/lib/db";
import { getLinkPreview } from "link-preview-js";
import { getIo, NextApiResponseServerIo } from "@/lib/socket";

export const config = {
  api: {
    bodyParser: false,
  },
};

// URL 정규식 (http/https 또는 www. 로 시작하는 링크 감지)
const URL_REGEX = /((https?:\/\/[^\s]+)|(www\.[^\s]+))/g;

// 접속 중인 사용자 정보를 저장할 구조 (roomId -> Map of userId to username)
// Next.js HMR 상황에서도 상태를 유지하기 위해 전역 객체 사용
const globalForSocket = global as unknown as {
  roomUsers: Map<string, Map<string, string>>;
  socketInfo: Map<string, { userId: string; username: string; roomId: string }>;
};

if (!globalForSocket.roomUsers) {
  globalForSocket.roomUsers = new Map();
}
if (!globalForSocket.socketInfo) {
  globalForSocket.socketInfo = new Map();
}

const roomUsers = globalForSocket.roomUsers;
const socketInfo = globalForSocket.socketInfo;

const ioHandler = (req: NextApiRequest, res: NextApiResponseServerIo) => {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const io = getIo(res.socket.server as NetServer, res);

  // 사용자 제거 로직 공통화
  const handleUserLeave = (socketId: string) => {
    const info = socketInfo.get(socketId);
    if (info) {
      const { userId, username, roomId } = info;
      socketInfo.delete(socketId);
      
      // 해당 방에 동일한 유저(userId)를 사용하는 다른 소켓이 남아있는지 확인
      const otherSocketsOfUser = Array.from(socketInfo.values()).some(
        (s) => s.userId === userId && s.roomId === roomId
      );

      if (roomUsers.has(roomId)) {
        const usersMap = roomUsers.get(roomId)!;
        
        // 다른 소켓이 없을 때만 목록에서 완전히 제거 및 퇴장 메시지 발송
        if (!otherSocketsOfUser) {
          usersMap.delete(userId);
          
          const userList = Array.from(usersMap).map(([id, name]) => ({ id, name }));
          io.to(roomId).emit("online-users", userList);

          const leaveMessage: Message = {
            id: `system-leave-${Date.now()}-${socketId}`,
            content: `${username}님이 퇴장하셨습니다.`,
            senderId: "system",
            roomId: roomId,
            timestamp: new Date().toISOString(),
            type: "SYSTEM",
          };
          io.to(roomId).emit("receive-message", leaveMessage);
          console.log(`[SOCKET_IO] User ${username}(${userId}) left room ${roomId} (socket: ${socketId})`);
        }
      }
    }
  };
    
  io.on("connection", (socket) => {
    console.log(`[SOCKET_IO] New client connected: ${socket.id}`);

    // 사용자가 채팅방에 입장할 때 호출
    socket.on("join-room", ({ userId, username, roomId }: { userId: string; username: string; roomId: string }) => {
      // 기존에 다른 정보가 있었다면 정리 (혹은 같은 소켓으로 재입장 시)
      handleUserLeave(socket.id);

      socket.join(roomId);
      socketInfo.set(socket.id, { userId, username, roomId });

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      roomUsers.get(roomId)!.set(userId, username);

      console.log(`[SOCKET_IO] User ${username}(${userId}) joined room ${roomId} (socket: ${socket.id})`);
      
      // 1. 해당 방의 클라이언트들에게 현재 방 접속자 목록 전송
      const userList = Array.from(roomUsers.get(roomId)!).map(([id, name]) => ({ id, name }));
      io.to(roomId).emit("online-users", userList);

      // 2. 입장 알림 시스템 메시지 발송
      const joinMessage: Message = {
        id: `system-join-${Date.now()}-${socket.id}`,
        content: `${username}님이 입장하셨습니다.`,
        senderId: "system",
        roomId: roomId,
        timestamp: new Date().toISOString(),
        type: "SYSTEM",
      };
      io.to(roomId).emit("receive-message", joinMessage);
    });

    // 명시적인 방 퇴장 이벤트
    socket.on("leave-room", () => {
      const info = socketInfo.get(socket.id);
      if (info) {
        socket.leave(info.roomId);
        handleUserLeave(socket.id);
      }
    });

    socket.on("send-message", async (message: Message) => {
      console.log(`[SOCKET_IO] Message to room ${message.roomId}:`, message.content);
      try {
        // 데이터베이스 저장
        await db.user.upsert({
          where: { id: message.senderId },
          update: {},
          create: { 
            id: message.senderId, 
            name: message.senderId 
          },
        });

        // 방 존재 확인 (없으면 생성 - 안전장치)
        await db.room.upsert({
          where: { id: message.roomId },
          update: {},
          create: { 
            id: message.roomId, 
            name: "채팅방",
            creatorId: message.senderId
          },
        });

        // 링크 프리뷰 추출
        const urls = message.content.match(URL_REGEX);
        let previewData = null;

        if (urls && urls.length > 0) {
          let targetUrl = urls[0];
          if (!targetUrl.startsWith("http")) targetUrl = `http://${targetUrl}`;

          try {
            const data: any = await getLinkPreview(targetUrl, { timeout: 3000 });
            if (data && data.title) {
              previewData = {
                title: data.title,
                description: data.description || "",
                image: data.images ? data.images[0] : (data.favicons ? data.favicons[0] : ""),
                url: data.url
              };
            }
          } catch (err) {}
        }

        const savedMessage = await db.message.create({
          data: {
            content: message.content,
            userId: message.senderId,
            roomId: message.roomId,
            createdAt: new Date(message.timestamp),
            previewTitle: previewData?.title,
            previewDesc: previewData?.description,
            previewImage: previewData?.image,
            previewUrl: previewData?.url,
            attachments: message.attachments ? {
              create: message.attachments.map((attachment) => ({
                fileUrl: attachment.fileUrl,
                fileName: attachment.fileName,
                fileType: attachment.fileType,
                fileSize: attachment.fileSize,
              })),
            } : undefined,
            poll: message.poll ? {
              create: {
                question: message.poll.question,
                options: {
                  create: message.poll.options.map((opt) => ({
                    text: opt.text,
                  })),
                },
              },
            } : undefined,
          },
          include: {
            user: { select: { name: true, imageUrl: true } },
            attachments: true,
            poll: {
              include: {
                options: {
                  include: {
                    votes: { select: { userId: true } },
                  },
                },
              },
            }
          }
        });

        const broadcastMessage: Message = {
          id: savedMessage.id,
          content: savedMessage.content,
          senderId: savedMessage.userId,
          roomId: savedMessage.roomId,
          timestamp: savedMessage.createdAt.toISOString(),
          type: "USER",
          user: savedMessage.user,
          attachments: savedMessage.attachments,
          poll: savedMessage.poll ? {
            id: savedMessage.poll.id,
            question: savedMessage.poll.question,
            closedAt: savedMessage.poll.closedAt?.toISOString() || null,
            options: savedMessage.poll.options.map((opt) => ({
              id: opt.id,
              text: opt.text,
              votes: opt.votes,
            })),
          } : undefined,
          preview: previewData ? {
            title: savedMessage.previewTitle!,
            description: savedMessage.previewDesc!,
            image: savedMessage.previewImage!,
            url: savedMessage.previewUrl!
          } : undefined
        };

        // 특정 방에만 전송
        io.to(message.roomId).emit("receive-message", broadcastMessage);

        // 챗봇 응답
        const trimmedContent = message.content.trim();
        
        if (trimmedContent === "/도움말") {
          setTimeout(async () => {
            const botContent = `**[사용 가능한 명령어]**
- \`/도움말\`: 사용 가능한 모든 명령어 목록을 확인합니다.
- \`/방장\`: 현재 방의 방장 정보를 확인합니다.
- \`/투표\`: 새로운 설문조사를 생성할 수 있는 양식을 띄웁니다.
- \`/코드\`: 마크다운 코드 블록을 입력창에 자동으로 삽입합니다.`;
            io.to(message.roomId).emit("receive-message", {
              id: `bot-help-${Date.now()}`,
              content: botContent,
              senderId: "bot-helper",
              roomId: message.roomId,
              timestamp: new Date().toISOString(),
              type: "BOT",
              user: { name: "도움말 봇" }
            });
          }, 500);
        } else if (trimmedContent === "/방장") {
          setTimeout(async () => {
            const room = await db.room.findUnique({
              where: { id: message.roomId },
              include: { creator: { select: { name: true } } }
            });

            const creatorName = room?.creator?.name || "알 수 없음";
            const botContent = `이 방의 방장은 **${creatorName}**님입니다.`;
            
            io.to(message.roomId).emit("receive-message", {
              id: `bot-host-${Date.now()}`,
              content: botContent,
              senderId: "bot-helper",
              roomId: message.roomId,
              timestamp: new Date().toISOString(),
              type: "BOT",
              user: { name: "도움말 봇" }
            });
          }, 500);
        }
      } catch (error) {
        console.error("[SOCKET_IO_ERROR]", error);
      }
    });

    socket.on("edit-message", async ({ messageId, content, roomId }: { messageId: string, content: string, roomId: string }) => {
      try {
        // 링크 프리뷰 재추출 (수정된 내용에 링크가 있을 수 있음)
        const urls = content.match(URL_REGEX);
        let previewData = null;

        if (urls && urls.length > 0) {
          let targetUrl = urls[0];
          if (!targetUrl.startsWith("http")) targetUrl = `http://${targetUrl}`;

          try {
            const data: any = await getLinkPreview(targetUrl, { timeout: 3000 });
            if (data && data.title) {
              previewData = {
                title: data.title,
                description: data.description || "",
                image: data.images ? data.images[0] : (data.favicons ? data.favicons[0] : ""),
                url: data.url
              };
            }
          } catch (err) {}
        }

        const updatedMessage = await db.message.update({
          where: { id: messageId },
          data: {
            content,
            previewTitle: previewData?.title || null,
            previewDesc: previewData?.description || null,
            previewImage: previewData?.image || null,
            previewUrl: previewData?.url || null,
          },
          include: {
            user: { select: { name: true, imageUrl: true } },
            attachments: true,
            poll: {
              include: {
                options: {
                  include: {
                    votes: { select: { userId: true } },
                  },
                },
              },
            }
          }
        });

        const broadcastMessage: Message = {
          id: updatedMessage.id,
          content: updatedMessage.content,
          senderId: updatedMessage.userId,
          roomId: updatedMessage.roomId,
          timestamp: updatedMessage.createdAt.toISOString(),
          type: "USER",
          user: updatedMessage.user,
          attachments: updatedMessage.attachments,
          poll: updatedMessage.poll ? {
            id: updatedMessage.poll.id,
            question: updatedMessage.poll.question,
            closedAt: updatedMessage.poll.closedAt?.toISOString() || null,
            options: updatedMessage.poll.options.map((opt) => ({
              id: opt.id,
              text: opt.text,
              votes: opt.votes,
            })),
          } : undefined,
          preview: previewData ? {
            title: updatedMessage.previewTitle!,
            description: updatedMessage.previewDesc!,
            image: updatedMessage.previewImage!,
            url: updatedMessage.previewUrl!
          } : (updatedMessage.previewUrl ? {
            title: updatedMessage.previewTitle!,
            description: updatedMessage.previewDesc!,
            image: updatedMessage.previewImage!,
            url: updatedMessage.previewUrl!
          } : undefined)
        };

        io.to(roomId).emit("message-edited", broadcastMessage);
      } catch (error) {
        console.error("[SOCKET_IO_EDIT_ERROR]", error);
      }
    });

    socket.on("delete-message", async ({ messageId, roomId }: { messageId: string, roomId: string }) => {
      try {
        await db.message.delete({
          where: { id: messageId },
        });

        io.to(roomId).emit("message-deleted", { messageId });
      } catch (error) {
        console.error("[SOCKET_IO_DELETE_ERROR]", error);
      }
    });

    socket.on("transfer-host", async ({ roomId, newCreatorId, requesterId }: { roomId: string, newCreatorId: string, requesterId: string }) => {
      try {
        // 1. 요청자가 현재 방장인지 확인
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { creatorId: true, name: true }
        });

        if (!room || room.creatorId !== requesterId) {
          console.error("[SOCKET_IO_TRANSFER_ERROR] Unauthorized transfer request");
          return;
        }

        // 2. 위임받을 사용자가 DB에 존재하는지 확인 및 생성 (없을 경우 대비)
        await db.user.upsert({
          where: { id: newCreatorId },
          update: {},
          create: { 
            id: newCreatorId, 
            name: newCreatorId 
          },
        });

        // 3. 데이터베이스 업데이트
        await db.room.update({
          where: { id: roomId },
          data: { creatorId: newCreatorId }
        });

        // 4. 방의 모든 클라이언트에게 방장 변경 알림
        io.to(roomId).emit("host-transferred", { roomId, newCreatorId });

        // 5. 시스템 메시지 발송
        const systemMessage: Message = {
          id: `system-transfer-${Date.now()}`,
          content: `방장이 ${newCreatorId}님으로 변경되었습니다.`,
          senderId: "system",
          roomId: roomId,
          timestamp: new Date().toISOString(),
          type: "SYSTEM",
        };
        io.to(roomId).emit("receive-message", systemMessage);

        console.log(`[SOCKET_IO] Host of room ${roomId} transferred from ${requesterId} to ${newCreatorId}`);
      } catch (error) {
        console.error("[SOCKET_IO_TRANSFER_ERROR]", error);
      }
    });

    socket.on("kick-user", async ({ roomId, targetUserId, requesterId }: { roomId: string, targetUserId: string, requesterId: string }) => {
      try {
        // 1. 요청자가 현재 방장인지 확인
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { creatorId: true }
        });

        if (!room || room.creatorId !== requesterId) {
          console.error("[SOCKET_IO_KICK_ERROR] Unauthorized kick request");
          return;
        }

        // 2. 해당 유저의 모든 소켓 찾기 (userId 기준)
        const targetSockets = Array.from(socketInfo.entries())
          .filter(([id, info]) => info.userId === targetUserId && info.roomId === roomId)
          .map(([id, info]) => id);

        if (targetSockets.length > 0) {
          const targetUsername = socketInfo.get(targetSockets[0])?.username || "알 수 없는 유저";

          // 3. 대상 소켓들에게 강제 퇴장 알림 발송 및 소켓 연결 정리
          targetSockets.forEach((socketId) => {
            io.to(socketId).emit("user-kicked", { roomId });
            
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
              targetSocket.leave(roomId);
              handleUserLeave(socketId);
            }
          });

          // 4. 시스템 메시지 발송
          const systemMessage: Message = {
            id: `system-kick-${Date.now()}`,
            content: `${targetUsername}님이 방장에 의해 강제 퇴장당하셨습니다.`,
            senderId: "system",
            roomId: roomId,
            timestamp: new Date().toISOString(),
            type: "SYSTEM",
          };
          io.to(roomId).emit("receive-message", systemMessage);
          
          console.log(`[SOCKET_IO] User ${targetUsername}(${targetUserId}) kicked from room ${roomId} by ${requesterId}`);
        }
      } catch (error) {
        console.error("[SOCKET_IO_KICK_ERROR]", error);
      }
    });

    socket.on("update-announcement", async ({ roomId, announcement, requesterId }: { roomId: string, announcement: string, requesterId: string }) => {
      try {
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { creatorId: true }
        });

        if (!room || room.creatorId !== requesterId) {
          console.error("[SOCKET_IO_ANNOUNCEMENT_ERROR] Unauthorized request");
          return;
        }

        await db.room.update({
          where: { id: roomId },
          data: { announcement }
        });

        io.to(roomId).emit("announcement-updated", { announcement });

        const systemMessage: Message = {
          id: `system-announcement-${Date.now()}`,
          content: announcement ? "새로운 공지사항이 등록되었습니다." : "공지사항이 삭제되었습니다.",
          senderId: "system",
          roomId: roomId,
          timestamp: new Date().toISOString(),
          type: "SYSTEM",
        };
        io.to(roomId).emit("receive-message", systemMessage);
      } catch (error) {
        console.error("[SOCKET_IO_ANNOUNCEMENT_ERROR]", error);
      }
    });

    socket.on("delete-announcement", async ({ roomId, requesterId }: { roomId: string, requesterId: string }) => {
      try {
        const room = await db.room.findUnique({
          where: { id: roomId },
          select: { creatorId: true }
        });

        if (!room || room.creatorId !== requesterId) {
          console.error("[SOCKET_IO_ANNOUNCEMENT_DELETE_ERROR] Unauthorized request");
          return;
        }

        await db.room.update({
          where: { id: roomId },
          data: { announcement: null }
        });

        io.to(roomId).emit("announcement-deleted");

        const systemMessage: Message = {
          id: `system-announcement-del-${Date.now()}`,
          content: "공지사항이 삭제되었습니다.",
          senderId: "system",
          roomId: roomId,
          timestamp: new Date().toISOString(),
          type: "SYSTEM",
        };
        io.to(roomId).emit("receive-message", systemMessage);
      } catch (error) {
        console.error("[SOCKET_IO_ANNOUNCEMENT_DELETE_ERROR]", error);
      }
    });

    socket.on("vote", async ({ pollId, optionId, userId }) => {
      try {
        await db.vote.upsert({
          where: { userId_pollId: { userId, pollId } },
          update: { optionId },
          create: { userId, pollId, optionId },
        });

        const updatedPoll = await db.poll.findUnique({
          where: { id: pollId },
          include: {
            message: { select: { roomId: true } },
            options: { include: { votes: { select: { userId: true } } } },
          },
        });

        if (updatedPoll) {
          io.to(updatedPoll.message.roomId).emit("poll-update", {
            pollId: updatedPoll.id,
            options: updatedPoll.options.map((opt) => ({
              id: opt.id,
              text: opt.text,
              votes: opt.votes,
            })),
          });
        }
      } catch (error) {}
    });

    socket.on("typing", ({ roomId, username }) => {
      socket.to(roomId).emit("user-typing", { roomId, username });
    });

    socket.on("stop-typing", ({ roomId, username }) => {
      socket.to(roomId).emit("user-stop-typing", { roomId, username });
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET_IO] Client disconnected: ${socket.id}`);
      handleUserLeave(socket.id);
    });
  });

  res.end();
};

export default ioHandler;
