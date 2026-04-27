"use client";

import { Message } from "@/types/socket";
import { useEffect, useRef, useState } from "react";
import { Loader2, FileIcon, Download, Image as ImageIcon, Paperclip } from "lucide-react";
import { PollDisplay } from "./poll-display";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  loadMore: () => void;
  shouldLoadMore: boolean;
  onUploadFiles: (files: FileList | File[]) => Promise<void>;
  isUploading: boolean;
  scrollToMessageId?: string | null;
  onScrollComplete?: () => void;
  searchResults?: Message[];
  searchIndex?: number;
}

export const MessageList = ({ 
  messages, 
  currentUserId, 
  loadMore, 
  shouldLoadMore,
  onUploadFiles,
  isUploading,
  scrollToMessageId,
  onScrollComplete,
  searchResults = [],
  searchIndex = -1
}: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [prevMessageCount, setPrevMessageCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // 특정 메시지로 스크롤 로직
  useEffect(() => {
    if (scrollToMessageId) {
      const element = document.getElementById(`message-${scrollToMessageId}`);
      if (element) {
        // 메시지가 로드되어 있다면 스크롤
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(scrollToMessageId);
        
        // 스크롤 완료 알림
        if (onScrollComplete) {
          onScrollComplete();
        }

        // 강조는 검색 결과가 아닐 때만 자동으로 제거 (검색 결과는 계속 강조 유지)
        const isSearchResult = searchResults.some(m => m.id === scrollToMessageId);
        if (!isSearchResult) {
          const timer = setTimeout(() => {
            setHighlightedId(null);
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [scrollToMessageId, messages, onScrollComplete, searchResults]);

  // 검색 결과 변경 시 강조 업데이트
  useEffect(() => {
    if (searchIndex !== -1 && searchResults[searchIndex]) {
      setHighlightedId(searchResults[searchIndex].id);
    } else if (searchResults.length === 0) {
      setHighlightedId(null);
    }
  }, [searchIndex, searchResults]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await onUploadFiles(files);
    }
  };

  // 무한 스크롤 감지 (Intersection Observer)
  useEffect(() => {
    const topElement = topRef.current;
    if (!topElement || !shouldLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(topElement);
    return () => observer.disconnect();
  }, [loadMore, shouldLoadMore]);

  // 초기 로딩 및 메시지 추가 시 스크롤 제어
  useEffect(() => {
    if (messages.length === 0) return;

    // 1. 초기 렌더링 시 하단으로 이동
    if (!hasInitialized.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
      hasInitialized.current = true;
      setPrevMessageCount(messages.length);
      return;
    }

    // 2. 새로운 메시지가 하단에 추가됨 (실시간 채팅)
    // 마지막 메시지가 내 메시지거나, 스크롤이 이미 하단 근처에 있다면 아래로 스크롤
    const isNewMessageAtBottom = messages.length > prevMessageCount;
    if (isNewMessageAtBottom) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.senderId === currentUserId) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }

    setPrevMessageCount(messages.length);
  }, [messages, currentUserId, prevMessageCount]);

  return (
    <div 
      ref={scrollRef}
      className={`flex-1 overflow-y-auto p-4 space-y-4 relative transition-colors ${
        isDragging ? "bg-blue-50/50 dark:bg-blue-900/20" : ""
      }`}
      style={{ overflowAnchor: "none" }} // 수동 제어 모드
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 드래그 앤 드롭 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg pointer-events-none m-2">
          <div className="flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400">
            <Paperclip className="w-10 h-10 animate-bounce" />
            <p className="text-base font-semibold">파일을 여기에 놓으세요</p>
          </div>
        </div>
      )}

      {/* 상단 감지 포인트 및 로딩 표시 */}
      <div ref={topRef} className="h-1" />
      {shouldLoadMore && (
        <div className="flex justify-center p-2">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
        </div>
      )}

      {messages.length === 0 && (
        <p className="text-center text-zinc-500 text-sm">대화를 시작해보세요!</p>
      )}

      {messages.map((message, index) => {
        const isMyMessage = message.senderId === currentUserId;
        const isSystemMessage = message.type === "SYSTEM";
        const isBotMessage = message.type === "BOT";
        
        // 검색 결과 강조 로직
        const isSearchResult = searchResults.some(m => m.id === message.id);
        const isActiveSearchResult = searchIndex !== -1 && searchResults[searchIndex]?.id === message.id;
        const isHighlighted = highlightedId === message.id || isActiveSearchResult;
        
        // 상단에 메시지가 추가될 때, 기존의 가장 첫 번째였던 메시지에 앵커를 걸어 스크롤 위치를 유지합니다.
        const isAnchor = index === messages.length - prevMessageCount;

        if (isSystemMessage) {
          return (
            <div 
              key={message.id} 
              id={`message-${message.id}`}
              className={`flex justify-center my-2 transition-colors duration-500 ${isHighlighted ? "bg-yellow-100/50 dark:bg-yellow-900/30 rounded-lg" : ""}`}
              style={isAnchor ? { overflowAnchor: "auto" } : { overflowAnchor: "none" }}
            >
              <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-full px-4 py-1">
                <p className="text-[11px] text-zinc-500 font-medium">
                  {message.content}
                </p>
              </div>
            </div>
          );
        }

        return (
          <div
            key={message.id}
            id={`message-${message.id}`}
            className={`flex flex-col ${isMyMessage ? "items-end" : "items-start"} transition-all duration-500 ${
              isActiveSearchResult 
                ? "scale-[1.02] bg-orange-100/50 dark:bg-orange-900/30 rounded-lg p-2 ring-2 ring-orange-400 dark:ring-orange-600 z-10" 
                : isSearchResult
                ? "bg-yellow-50/80 dark:bg-yellow-900/20 rounded-lg p-2 ring-1 ring-yellow-200 dark:ring-yellow-800"
                : isHighlighted
                ? "scale-[1.02] bg-yellow-50/50 dark:bg-yellow-900/20 rounded-lg p-2 ring-1 ring-yellow-200 dark:ring-yellow-800"
                : ""
            }`}
            style={isAnchor ? { overflowAnchor: "auto" } : { overflowAnchor: "none" }}
          >
            <div className="flex items-center gap-1 mb-1 px-1">
              <span className="text-xs text-zinc-500">
                {isMyMessage ? "나" : (message.user?.name || message.senderId)}
              </span>
              {isBotMessage && (
                <span className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  Bot
                </span>
              )}
            </div>
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                isMyMessage
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : isBotMessage
                  ? "bg-purple-50 text-purple-900 dark:bg-purple-900/20 dark:text-purple-100 border border-purple-100 dark:border-purple-800 rounded-tl-none"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-tl-none"
              }`}
            >
              {message.content && <p className="text-sm leading-relaxed">{message.content}</p>}
              
              {/* 설문조사 렌더링 */}
              {message.poll && (
                <PollDisplay 
                  poll={message.poll} 
                  currentUserId={currentUserId} 
                  isMyMessage={isMyMessage} 
                />
              )}

              {/* 첨부 파일 렌더링 */}
              {message.attachments && message.attachments.length > 0 && (
                <div className={`mt-2 space-y-2 ${message.content ? "pt-2 border-t border-white/10" : ""}`}>
                  {message.attachments.map((attachment) => {
                    const isImage = attachment.fileType?.startsWith("image/");
                    
                    if (isImage) {
                      return (
                        <div key={attachment.id} className="relative group rounded-lg overflow-hidden border border-white/10">
                          <img 
                            src={attachment.fileUrl} 
                            alt={attachment.fileName || "image"} 
                            className="max-h-60 w-auto object-contain cursor-pointer"
                            onClick={() => window.open(attachment.fileUrl, "_blank")}
                          />
                          <a 
                            href={attachment.fileUrl} 
                            download={attachment.fileName}
                            className="absolute bottom-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                      );
                    }

                    return (
                      <a
                        key={attachment.id}
                        href={attachment.fileUrl}
                        download={attachment.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isMyMessage 
                            ? "bg-white/10 border-white/20 hover:bg-white/20 text-white" 
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <div className={`p-2 rounded-md ${isMyMessage ? "bg-white/20" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                          <FileIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{attachment.fileName}</p>
                          <p className={`text-[10px] ${isMyMessage ? "text-blue-100" : "text-zinc-500"}`}>
                            {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(1)} KB` : "파일"}
                          </p>
                        </div>
                        <Download className={`w-4 h-4 ${isMyMessage ? "text-white" : "text-zinc-400"}`} />
                      </a>
                    );
                  })}
                </div>
              )}

              {/* 링크 프리뷰 카드 추가 */}
              {message.preview && (
                <a 
                  href={message.preview.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`block mt-2 rounded-lg overflow-hidden border ${
                    isMyMessage ? "bg-white/10 border-white/20" : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {message.preview.image && (
                    <div className="relative h-32 w-full">
                      <img 
                        src={message.preview.image} 
                        alt={message.preview.title}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                  <div className="p-2 space-y-1">
                    <h4 className={`text-xs font-bold line-clamp-1 ${isMyMessage ? "text-white" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {message.preview.title}
                    </h4>
                    <p className={`text-[10px] line-clamp-2 ${isMyMessage ? "text-blue-100" : "text-zinc-500"}`}>
                      {message.preview.description}
                    </p>
                    <p className={`text-[9px] uppercase tracking-wider ${isMyMessage ? "text-blue-200" : "text-zinc-400"}`}>
                      {(() => {
                        try {
                          return new URL(message.preview.url).hostname;
                        } catch {
                          return message.preview.url;
                        }
                      })()}
                    </p>
                  </div>
                </a>
              )}

              <p className={`text-[10px] mt-1 text-right ${isMyMessage ? "text-blue-100" : "text-zinc-500"}`}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
