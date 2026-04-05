"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export const MessageInput = ({ onSendMessage, disabled }: MessageInputProps) => {
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;

    onSendMessage(content);
    setContent("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2"
    >
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="메시지를 입력하세요..."
        disabled={disabled}
        className="flex-1"
      />
      <Button type="submit" disabled={disabled || !content.trim()}>
        전송
      </Button>
    </form>
  );
};
