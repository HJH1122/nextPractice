import { Server as NetServer, Socket } from "net";
import { NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";

export interface Message {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  timestamp: string;
  user?: {
    name: string | null;
    imageUrl: string | null;
  };
}

export type NextApiResponseServerIo = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: SocketIOServer;
    };
  };
};
