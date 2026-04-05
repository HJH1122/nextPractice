"use client";

import { ChatRoom } from "@/components/chat/chat-room";

export default function ChatPage() {
  return (
    <main className="flex-1 p-4 md:p-8 h-[calc(100vh-64px)] max-w-4xl mx-auto">
      <div className="flex flex-col h-full space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">메시지</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            Socket.io를 이용한 실시간 채팅 테스트 페이지입니다.
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <ChatRoom />
        </div>
      </div>
    </main>
  );
}
