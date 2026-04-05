"use client";

import { Message } from "@/types/socket";
import { useEffect, useRef } from "react";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
}

export const MessageList = ({ messages, currentUserId }: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 && (
        <p className="text-center text-zinc-500 text-sm">대화를 시작해보세요!</p>
      )}
      {messages.map((message) => {
        const isMyMessage = message.senderId === currentUserId;
        return (
          <div
            key={message.id}
            className={`flex ${isMyMessage ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                isMyMessage
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className={`text-[10px] mt-1 ${isMyMessage ? "text-blue-100" : "text-zinc-500"}`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
