"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { Message } from "@/types/socket";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const ChatRoom = () => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  // 입력한 username을 ID로 사용합니다 (테스트용)
  const currentUserId = username;
  const roomId = "general-room";

  // 이전 메시지 내역 불러오기
  useEffect(() => {
    if (!isJoined) return;

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
  }, [roomId, isJoined]);

  useEffect(() => {
    if (!socket || !isJoined) return;

    socket.on("receive-message", (message: Message) => {
      console.log("[CLIENT] Received message from server:", message);
      setMessages((prev) => {
        const messageExists = prev.find((m) => m.id === message.id);
        if (messageExists) return prev;
        return [...prev, message];
      });
    });

    // 다른 사용자가 입력 중일 때
    socket.on("user-typing", ({ roomId: incomingRoomId, username: typingUser }) => {
      if (incomingRoomId === roomId && typingUser !== username) {
        setTypingUsers((prev) => {
          if (prev.includes(typingUser)) return prev;
          return [...prev, typingUser];
        });
      }
    });

    // 다른 사용자가 입력을 멈췄을 때
    socket.on("user-stop-typing", ({ roomId: incomingRoomId, username: typingUser }) => {
      if (incomingRoomId === roomId) {
        setTypingUsers((prev) => prev.filter((u) => u !== typingUser));
      }
    });

    return () => {
      socket.off("receive-message");
      socket.off("user-typing");
      socket.off("user-stop-typing");
    };
  }, [socket, isJoined, roomId, username]);

  const onSendMessage = useCallback(
    (content: string) => {
      if (!socket || !isConnected) {
        console.warn("[CLIENT] Socket not connected. Cannot send message.");
        return;
      }

      const newMessage: Message = {
        id: crypto.randomUUID(),
        content,
        senderId: currentUserId,
        roomId: roomId,
        timestamp: new Date().toISOString(),
      };

      console.log("[CLIENT] Emitting 'send-message' event:", newMessage);
      socket.emit("send-message", newMessage);
    },
    [socket, isConnected, currentUserId, roomId]
  );

  const onTyping = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("typing", { roomId, username });
    }
  }, [socket, isConnected, roomId, username]);

  const onStopTyping = useCallback(() => {
    if (socket && isConnected) {
      socket.emit("stop-typing", { roomId, username });
    }
  }, [socket, isConnected, roomId, username]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsJoined(true);
    }
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col h-[500px] items-center justify-center border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 shadow-sm p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h2 className="text-2xl font-bold">채팅방 입장</h2>
          <p className="text-sm text-zinc-500">사용하실 닉네임을 입력해주세요.</p>
          <form onSubmit={handleJoin} className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="닉네임 입력..."
              className="text-center"
              autoFocus
            />
            <Button type="submit" className="w-full" disabled={!username.trim()}>
              입장하기
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 shadow-sm overflow-hidden relative">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">실시간 채팅</h2>
          <p className="text-xs text-blue-600 font-medium">내 닉네임: {username}</p>
        </div>
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
      
      {/* 입력 중 표시 */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-zinc-500 italic animate-pulse bg-zinc-50/50 dark:bg-zinc-900/50">
          {typingUsers.join(", ")}님이 입력 중입니다...
        </div>
      )}
      
      <MessageInput 
        onSendMessage={onSendMessage} 
        onTyping={onTyping}
        onStopTyping={onStopTyping}
        disabled={!isConnected} 
      />
    </div>
  );
};
