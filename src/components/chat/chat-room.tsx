"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { Message } from "@/types/socket";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";

export const ChatRoom = () => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  // 실제 앱에서는 인증 시스템의 유저 ID를 사용합니다.
  const currentUserId = "user-123";

  useEffect(() => {
    if (!socket) return;

    socket.on("receive-message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.off("receive-message");
    };
  }, [socket]);

  const onSendMessage = useCallback(
    (content: string) => {
      if (!socket || !isConnected) return;

      const newMessage: Message = {
        id: crypto.randomUUID(),
        content,
        senderId: currentUserId,
        timestamp: new Date().toISOString(),
      };

      socket.emit("send-message", newMessage);
    },
    [socket, isConnected, currentUserId]
  );

  return (
    <div className="flex flex-col h-full border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h2 className="font-semibold">실시간 채팅</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-zinc-500">
            {isConnected ? "연결됨" : "연결 중..."}
          </span>
        </div>
      </div>
      
      <MessageList messages={messages} currentUserId={currentUserId} />
      
      <MessageInput onSendMessage={onSendMessage} disabled={!isConnected} />
    </div>
  );
};
