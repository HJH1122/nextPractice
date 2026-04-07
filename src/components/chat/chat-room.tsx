"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { Message } from "@/types/socket";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";

export const ChatRoom = () => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 실제 앱에서는 인증 시스템의 유저 ID를 사용합니다.
  const currentUserId = "user-123";
  const roomId = "general-room"; // 기본 방 ID

  // 이전 메시지 내역 불러오기
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/messages?roomId=${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [roomId]);

  useEffect(() => {
    if (!socket) return;

    socket.on("receive-message", (message: Message) => {
      // 본인이 보낸 메시지는 중복 방지를 위해 필터링하거나, 서버에서 broadcast 할 때 처리 방식에 맞춤
      // 현재 서버(io.ts)는 받은 메시지를 전체에 emit하므로 중복 체크가 필요할 수 있음
      setMessages((prev) => {
        const messageExists = prev.find((m) => m.id === message.id);
        if (messageExists) return prev;
        return [...prev, message];
      });
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
        roomId: roomId,
        timestamp: new Date().toISOString(),
      };

      // 낙관적 업데이트 (선택 사항)
      // setMessages((prev) => [...prev, newMessage]);

      socket.emit("send-message", newMessage);
    },
    [socket, isConnected, currentUserId, roomId]
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
      
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
          메시지를 불러오는 중...
        </div>
      ) : (
        <MessageList messages={messages} currentUserId={currentUserId} />
      )}
      
      <MessageInput onSendMessage={onSendMessage} disabled={!isConnected} />
    </div>
  );
};
