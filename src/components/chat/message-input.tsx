"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2, X, Image as ImageIcon, BarChart3, Smile, Code } from "lucide-react";
import { Attachment } from "@/types/socket";
import { PollForm } from "./poll-form";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";

interface MessageInputProps {
  onSendMessage: (content: string, attachments?: Attachment[], poll?: any) => void;
  onTyping: () => void;
  onStopTyping: () => void;
  disabled?: boolean;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  isUploading: boolean;
  uploadFiles: (files: FileList | File[]) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const MessageInput = ({ 
  onSendMessage, 
  onTyping,
  onStopTyping,
  disabled,
  attachments,
  setAttachments,
  isUploading,
  uploadFiles,
  fileInputRef
}: MessageInputProps) => {
  const [content, setContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const insertCodeBlock = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    const before = content.substring(0, start);
    const after = content.substring(end);
    
    // 선택된 텍스트가 있으면 그것을 감싸고, 없으면 빈 코드 블록 생성
    const newContent = `${before}\n\`\`\`\n${selectedText}\n\`\`\`\n${after}`;
    setContent(newContent);
    
    // 입력창에 포커스 주고 커서 위치 조정
    setTimeout(() => {
      textarea.focus();
      const newPos = start + 5; // "\n```\n" 이후
      textarea.setSelectionRange(newPos, newPos + selectedText.length);
    }, 0);
  };

  // 입력창 높이 자동 조절
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "inherit";
      const computed = window.getComputedStyle(textarea);
      const height = textarea.scrollHeight + parseInt(computed.borderTopWidth) + parseInt(computed.borderBottomWidth);
      textarea.style.height = `${Math.min(height, 200)}px`; // 최대 200px
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  // 이모지 피커 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      await uploadFiles(files);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setContent((prev) => prev + emojiData.emoji);
    // 선택 후 입력창에 포커스 유지
    textareaRef.current?.focus();
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!content.trim() && attachments.length === 0) || disabled || isUploading) return;

    // 전송 시 타이핑 상태 즉시 해제
    if (typingTimeout) clearTimeout(typingTimeout);
    setIsTyping(false);
    onStopTyping();
    setShowEmojiPicker(false);

    onSendMessage(content, attachments.length > 0 ? attachments : undefined);
    setContent("");
    setAttachments([]);
    
    // 높이 초기화
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
    }
  };

  const handlePollSubmit = (question: string, options: string[]) => {
    onSendMessage(`[Poll] ${question}`, undefined, {
      question,
      options: options.map(opt => ({ text: opt }))
    });
    setShowPollForm(false);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  return (
    <div 
      className="flex flex-col border-t border-zinc-200 dark:border-zinc-800 transition-colors relative"
    >
      {/* 설문조사 작성 폼 팝업 */}
      {showPollForm && (
        <div className="absolute bottom-full left-4 mb-2 z-50 animate-in slide-in-from-bottom-2 duration-200">
          <PollForm 
            onClose={() => setShowPollForm(false)} 
            onSubmit={handlePollSubmit}
          />
        </div>
      )}

      {/* 이모지 피커 팝업 */}
      {showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className="absolute bottom-full left-4 mb-2 z-50 shadow-xl border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
        >
          <EmojiPicker 
            onEmojiClick={onEmojiClick}
            autoFocusSearch={false}
            theme={Theme.AUTO}
            width={350}
            height={400}
            searchPlaceHolder="이모지 검색..."
          />
        </div>
      )}

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
        className="p-4 flex gap-1 items-center"
      >
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf, .png, .jpg, .jpeg"
          className="hidden"
        />
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleFileClick}
            disabled={disabled || isUploading}
            className="text-zinc-500 h-9 w-9"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowPollForm(false); // 다른 폼 닫기
            }}
            disabled={disabled || isUploading}
            className={`h-9 w-9 ${showEmojiPicker ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" : "text-zinc-500"}`}
          >
            <Smile className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowPollForm(!showPollForm);
              setShowEmojiPicker(false); // 다른 폼 닫기
            }}
            disabled={disabled || isUploading}
            className={`h-9 w-9 ${showPollForm ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "text-zinc-500"}`}
          >
            <BarChart3 className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={insertCodeBlock}
            disabled={disabled || isUploading}
            className="text-zinc-500 h-9 w-9"
            title="코드 블록 삽입"
          >
            <Code className="w-5 h-5" />
          </Button>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isUploading ? "파일 업로드 중..." : "메시지를 입력하세요..."}
          disabled={disabled || isUploading}
          className="flex-1 ml-1 bg-zinc-100 dark:bg-zinc-800 border-none focus:ring-0 resize-none rounded-md px-3 py-2 text-sm min-h-[40px] max-h-[200px] overflow-y-auto"
          rows={1}
        />
        <Button type="submit" disabled={disabled || (!content.trim() && attachments.length === 0) || isUploading} className="ml-1">
          전송
        </Button>
      </form>
    </div>
  );
};
