"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
}

export const MessageInput = ({ 
  onSendMessage, 
  onTyping,
  onStopTyping,
  disabled 
}: MessageInputProps) => {
  const [content, setContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);

    // 타이핑 시작 이벤트 처리
    if (!isTyping && e.target.value.trim().length > 0) {
      setIsTyping(true);
      onTyping();
    }

    // 기존 타이머 취소
    if (typingTimeout) clearTimeout(typingTimeout);

    // 2초 후 타이핑 중단 처리
    const timeout = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onStopTyping();
      }
    }, 2000);

    setTypingTimeout(timeout);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || disabled) return;

    // 전송 시 타이핑 상태 즉시 해제
    if (typingTimeout) clearTimeout(typingTimeout);
    setIsTyping(false);
    onStopTyping();

    onSendMessage(content);
    setContent("");
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2"
    >
      <Input
        value={content}
        onChange={handleInputChange}
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
