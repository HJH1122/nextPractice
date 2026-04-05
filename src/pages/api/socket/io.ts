import { Server as NetServer } from "http";
import { NextApiRequest } from "next";
import { Server as ServerIO } from "socket.io";
import { Message, NextApiResponseServerIo } from "@/types/socket";

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

      socket.on("send-message", (message: Message) => {
        console.log(`[SOCKET_IO] Message received: ${message.content}`);
        io.emit("receive-message", message);
      });

      socket.on("disconnect", () => {
        console.log("[SOCKET_IO] Client disconnected");
      });
    });
  }

  res.end();
};

export default ioHandler;
