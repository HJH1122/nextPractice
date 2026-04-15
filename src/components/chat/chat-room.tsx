"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { Message } from "@/types/socket";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export const ChatRoom = () => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  
  // 입력한 username을 ID로 사용합니다 (테스트용)
  const currentUserId = username;
  const roomId = "general-room";

  // 이전 메시지 내역 불러오기 (초기 로드)
  useEffect(() => {
    if (!isJoined) return;

    const fetchInitialMessages = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/messages?roomId=${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.items);
          setNextCursor(data.nextCursor);
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialMessages();
  }, [roomId, isJoined]);

  // 추가 메시지 불러오기 (무한 스크롤용)
  const fetchNextPage = useCallback(async () => {
    if (!nextCursor || isFetchingNextPage) return;

    try {
      setIsFetchingNextPage(true);
      const response = await fetch(`/api/messages?roomId=${roomId}&cursor=${nextCursor}`);
      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...data.items, ...prev]); // 과거 메시지를 앞에 추가
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      console.error("Failed to fetch more messages:", error);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [roomId, nextCursor, isFetchingNextPage]);

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

    // ... (typing indicator 로직 생략하지 않고 유지)
    socket.on("user-typing", ({ roomId: incomingRoomId, username: typingUser }) => {
      if (incomingRoomId === roomId && typingUser !== username) {
        setTypingUsers((prev) => {
          if (prev.includes(typingUser)) return prev;
          return [...prev, typingUser];
        });
      }
    });

    socket.on("user-stop-typing", ({ roomId: incomingRoomId, username: typingUser }) => {
      if (incomingRoomId === roomId) {
        setTypingUsers((prev) => prev.filter((u) => u !== typingUser));
      }
    });

    socket.on("online-users", (users: string[]) => {
      console.log("[CLIENT] Online users updated:", users);
      setOnlineUsers(users);
    });

    // 방에 입장했음을 알림
    socket.emit("join", username);

    return () => {
      socket.off("receive-message");
      socket.off("user-typing");
      socket.off("user-stop-typing");
      socket.off("online-users");
    };
  }, [socket, isJoined, roomId, username]);

  // ... (onSendMessage, onTyping, onStopTyping, handleJoin 로직 유지)

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
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-semibold text-sm">실시간 채팅</h2>
            <p className="text-xs text-blue-600 font-medium">내 닉네임: {username}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2 text-xs"
            onClick={() => setShowOnlineUsers(!showOnlineUsers)}
          >
            <Users className="w-4 h-4" />
            접속 중인 사람 보기 ({onlineUsers.length})
          </Button>
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
      
      {/* 접속 중인 사용자 목록 오버레이 */}
      {showOnlineUsers && (
        <div className="absolute top-[73px] left-4 z-50 w-64 max-h-[300px] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">접속 중인 사용자</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowOnlineUsers(false)}>
              <span className="sr-only">닫기</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
          <div className="space-y-1">
            {onlineUsers.length === 0 ? (
              <p className="text-xs text-zinc-500 px-2 py-4 text-center">접속자가 없습니다.</p>
            ) : (
              onlineUsers.map((user) => (
                <div key={user} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className={user === username ? "font-bold text-blue-600" : ""}>
                    {user} {user === username && "(나)"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
          메시지를 불러오는 중...
        </div>
      ) : (
        <MessageList 
          messages={messages} 
          currentUserId={currentUserId} 
          loadMore={fetchNextPage}
          shouldLoadMore={!!nextCursor && !isFetchingNextPage}
        />
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
