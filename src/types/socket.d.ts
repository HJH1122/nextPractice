import { Server as NetServer, Socket } from "net";
import { NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";

export interface Attachment {
  id: string;
  fileUrl: string;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  timestamp: string;
  type?: 'USER' | 'SYSTEM'; // 메시지 타입 추가
  user?: {
    name: string | null;
    imageUrl: string | null;
  };
  preview?: {
    title: string;
    description: string;
    image: string;
    url: string;
  };
  attachments?: Attachment[];
}

export type NextApiResponseServerIo = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};
