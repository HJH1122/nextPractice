"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2, X, Image as ImageIcon } from "lucide-react";
import { Attachment } from "@/types/socket";

interface MessageInputProps {
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
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
  
  // 파일 업로드 관련 상태
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("파일 크기는 10MB를 넘을 수 없습니다.");
      return;
    }

    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "업로드 실패");
      }

      const data = await response.json();
      
      const newAttachment: Attachment = {
        id: Math.random().toString(36).substring(7), // 임시 ID
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
      };

      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      console.error("Upload error:", error);
      alert("파일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && attachments.length === 0) || disabled || isUploading) return;

    // 전송 시 타이핑 상태 즉시 해제
    if (typingTimeout) clearTimeout(typingTimeout);
    setIsTyping(false);
    onStopTyping();

    onSendMessage(content, attachments.length > 0 ? attachments : undefined);
    setContent("");
    setAttachments([]);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  return (
    <div className="flex flex-col border-t border-zinc-200 dark:border-zinc-800">
      {/* 업로드된 파일 미리보기 목록 */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/50">
          {attachments.map((attachment) => (
            <div 
              key={attachment.id}
              className="relative group bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-2 pr-8 text-xs flex items-center gap-2 max-w-[200px]"
            >
              {attachment.fileType?.startsWith("image/") ? (
                <ImageIcon className="w-3 h-3 text-blue-500" />
              ) : (
                <Paperclip className="w-3 h-3 text-zinc-500" />
              )}
              <span className="truncate">{attachment.fileName}</span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-4 flex gap-2 items-center"
      >
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleFileClick}
          disabled={disabled || isUploading}
          className="text-zinc-500"
        >
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </Button>
        <Input
          value={content}
          onChange={handleInputChange}
          placeholder={isUploading ? "파일 업로드 중..." : "메시지를 입력하세요..."}
          disabled={disabled || isUploading}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || (!content.trim() && attachments.length === 0) || isUploading}>
          전송
        </Button>
      </form>
    </div>
  );
};
