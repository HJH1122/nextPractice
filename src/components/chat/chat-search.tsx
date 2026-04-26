"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X, Loader2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Message } from "@/types/socket";

interface ChatSearchProps {
  roomId: string;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
}

export const ChatSearch = ({ roomId, onClose, onSelectMessage }: ChatSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query || query.length < 2) return;

    try {
      setIsLoading(true);
      setHasSearched(true);
      const response = await fetch(`/api/messages/search?roomId=${roomId}&q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [query, roomId]);

  return (
    <div className="absolute inset-y-0 right-0 w-80 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 z-[60] flex flex-col shadow-xl animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-zinc-500" />
          <h3 className="text-sm font-semibold">대화 내용 검색</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색어 입력 (2자 이상)..."
            className="h-9 text-sm"
            autoFocus
          />
          <Button 
            type="submit"
            size="sm" 
            disabled={isLoading || query.length < 2}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
          </Button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!hasSearched ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-8 text-center">
            <Search className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-xs">채팅방 내에서 키워드로<br />과거 대화를 찾아보세요.</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center p-8 text-zinc-500">
            <p className="text-xs">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-zinc-400 px-2 uppercase tracking-wider mb-2">
              검색 결과 {results.length}건
            </p>
            {results.map((message) => (
              <div
                key={message.id}
                onClick={() => onSelectMessage(message.id)}
                className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-600 truncate">
                    {message.user?.name || message.senderId}
                  </span>
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(message.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2 break-all">
                  {message.content}
                </p>
                <div className="mt-2 text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
