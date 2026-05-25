"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { Message, Attachment } from "@/types/socket";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, X, ChevronUp, ChevronDown, Loader2, ArrowLeft, Trash2, Crown } from "lucide-react";

interface ChatRoomProps {
  username: string;
  roomId: string;
  roomName: string;
  creatorId: string;
  onLeave: () => void;
  onHostTransfer?: (newCreatorId: string) => void;
}

export const ChatRoom = ({ username, roomId, roomName, creatorId, onLeave, onHostTransfer }: ChatRoomProps) => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [currentCreatorId, setCurrentCreatorId] = useState(creatorId);

  // creatorId prop이 변경되면 currentCreatorId 상태도 동기화합니다.
  useEffect(() => {
    setCurrentCreatorId(creatorId);
  }, [creatorId]);
  
  // 검색 관련 상태
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchIndex, setSearchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const lastSearchQuery = useRef("");
  
  // 파일 업로드 관련 상태
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const currentUserId = username;

  const handleDeleteRoom = async () => {
    if (!window.confirm("정말로 이 채팅방을 삭제하시겠습니까? 모든 대화 내용이 삭제됩니다.")) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: username }),
      });

      if (!response.ok) {
        throw new Error("삭제 실패");
      }
      // 삭제 성공 시 소켓 이벤트(room-deleted)가 발생하여 handleLeave가 호출될 것임
    } catch (error) {
      alert("채팅방 삭제에 실패했습니다.");
      setIsDeleting(false);
    }
  };

  // 검색 로직
  const handleSearch = async (e?: React.FormEvent, direction: "next" | "prev" = "next") => {
    if (e) e.preventDefault();
    if (!searchQuery || searchQuery.length < 2) return;

    if (searchResults.length === 0 || searchQuery !== lastSearchQuery.current) {
      try {
        setIsSearching(true);
        const response = await fetch(`/api/messages/search?roomId=${roomId}&q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
          lastSearchQuery.current = searchQuery;
          if (data.length > 0) {
            setSearchIndex(0);
            navigateToResult(data[0].id);
          } else {
            setSearchIndex(-1);
            alert("검색 결과가 없습니다.");
          }
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    } else {
      let nextIndex = searchIndex;
      if (direction === "next") {
        nextIndex = (searchIndex + 1) % searchResults.length;
      } else {
        nextIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
      }
      setSearchIndex(nextIndex);
      navigateToResult(searchResults[nextIndex].id);
    }
  };

  const navigateToResult = (id: string) => {
    const exists = messages.find(m => m.id === id);
    if (!exists) {
      alert("해당 메시지가 현재 목록에 없습니다. 상단으로 스크롤하여 더 많은 메시지를 불러온 후 다시 시도해주세요.");
      return;
    }
    setScrollToId(id);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchIndex(-1);
    lastSearchQuery.current = "";
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return;
    const file = files[0];
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
      if (!response.ok) throw new Error("업로드 실패");
      const data = await response.json();
      const newAttachment: Attachment = {
        id: Math.random().toString(36).substring(7),
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
      };
      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      alert("파일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
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
  }, [roomId]);

  const fetchNextPage = useCallback(async () => {
    if (!nextCursor || isFetchingNextPage) return;
    try {
      setIsFetchingNextPage(true);
      const response = await fetch(`/api/messages?roomId=${roomId}&cursor=${nextCursor}`);
      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...data.items, ...prev]);
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      console.error("Failed to fetch more messages:", error);
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [roomId, nextCursor, isFetchingNextPage]);

  useEffect(() => {
    if (!socket) return;

    socket.on("receive-message", (message: Message) => {
      if (message.roomId !== roomId) return;
      setMessages((prev) => {
        const exists = prev.find((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    });

    socket.on("message-edited", (message: Message) => {
      if (message.roomId !== roomId) return;
      setMessages((prev) => 
        prev.map((msg) => (msg.id === message.id ? message : msg))
      );
    });

    socket.on("message-deleted", ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    socket.on("user-typing", (data: { roomId: string; username: string }) => {
      if (data.roomId === roomId && data.username !== username) {
        setTypingUsers((prev) => prev.includes(data.username) ? prev : [...prev, data.username]);
      }
    });

    socket.on("user-stop-typing", (data: { roomId: string; username: string }) => {
      if (data.roomId === roomId) {
        setTypingUsers((prev) => prev.filter((u) => u !== data.username));
      }
    });

    socket.on("online-users", (users: string[]) => {
      setOnlineUsers(users);
    });

    socket.on("poll-update", ({ pollId, options }: { pollId: string; options: any[] }) => {
      setMessages((prev) => 
        prev.map((msg) => (msg.poll?.id === pollId ? { ...msg, poll: { ...msg.poll, options } } : msg))
      );
    });

    socket.on("room-deleted", ({ roomId: deletedRoomId }: { roomId: string }) => {
      if (deletedRoomId === roomId) {
        alert("채팅방이 방장에 의해 삭제되었습니다.");
        onLeave();
      }
    });

    socket.on("host-transferred", ({ roomId: targetRoomId, newCreatorId }: { roomId: string; newCreatorId: string }) => {
      if (targetRoomId === roomId) {
        console.log(`[SOCKET] Host transferred to ${newCreatorId}`);
        setCurrentCreatorId(newCreatorId);
        if (onHostTransfer) {
          onHostTransfer(newCreatorId);
        }
      }
    });

    socket.on("user-kicked", ({ roomId: kickedRoomId }: { roomId: string }) => {
      if (kickedRoomId === roomId) {
        alert("방장에 의해 강제 퇴장당하셨습니다.");
        onLeave();
      }
    });

    socket.emit("join-room", { username, roomId });

    return () => {
      socket.emit("leave-room");
      socket.off("receive-message");
      socket.off("user-typing");
      socket.off("user-stop-typing");
      socket.off("online-users");
      socket.off("poll-update");
      socket.off("room-deleted");
      socket.off("host-transferred");
      socket.off("user-kicked");
    };
  }, [socket, roomId, username, onLeave, onHostTransfer]);

  const onSendMessage = useCallback(
    (content: string, attachments?: Attachment[], poll?: any) => {
      if (!socket || !isConnected) return;
      const newMessage: Message = {
        id: window.crypto.randomUUID(),
        content,
        senderId: currentUserId,
        roomId: roomId,
        timestamp: new Date().toISOString(),
        attachments,
        poll,
      };
      socket.emit("send-message", newMessage);
    },
    [socket, isConnected, currentUserId, roomId]
  );

  const onTransferHost = useCallback(
    (newCreatorId: string) => {
      if (!socket || !isConnected) return;
      if (newCreatorId === username) return;
      
      if (!window.confirm(`${newCreatorId}님에게 방장 권한을 위임하시겠습니까?`)) return;
      
      socket.emit("transfer-host", { 
        roomId, 
        newCreatorId, 
        requesterId: username 
      });
    },
    [socket, isConnected, roomId, username]
  );

  const onKickUser = useCallback(
    (targetUsername: string) => {
      if (!socket || !isConnected) return;
      if (targetUsername === username) return;

      if (!window.confirm(`${targetUsername}님을 정말로 강제 퇴장시키겠습니까?`)) return;

      socket.emit("kick-user", {
        roomId,
        targetUsername,
        requesterId: username
      });
    },
    [socket, isConnected, roomId, username]
  );

  const onTyping = useCallback(() => {
    if (socket && isConnected) socket.emit("typing", { roomId, username });
  }, [socket, isConnected, roomId, username]);

  const onStopTyping = useCallback(() => {
    if (socket && isConnected) socket.emit("stop-typing", { roomId, username });
  }, [socket, isConnected, roomId, username]);

  const onEditMessage = useCallback(
    (messageId: string, content: string) => {
      if (!socket || !isConnected) return;
      socket.emit("edit-message", { messageId, content, roomId });
    },
    [socket, isConnected, roomId]
  );

  const onDeleteMessage = useCallback(
    (messageId: string) => {
      if (!socket || !isConnected) return;
      if (!window.confirm("정말로 이 메시지를 삭제하시겠습니까?")) return;
      socket.emit("delete-message", { messageId, roomId });
    },
    [socket, isConnected, roomId]
  );

  return (
    <div className="flex flex-col h-full border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 shadow-sm overflow-hidden relative">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon" onClick={onLeave} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {!showSearch ? (
            <>
              <div>
                <h2 className="font-semibold text-sm">{roomName}</h2>
                <p className="text-xs text-blue-600 font-medium">@{username}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2 text-xs"
                onClick={() => setShowOnlineUsers(!showOnlineUsers)}
              >
                <Users className="w-4 h-4" />
                접속자 ({onlineUsers.length})
              </Button>
            </>
          ) : (
            <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 justify-end">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="대화 내용 검색..."
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>
              {searchResults.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded-md">
                  <span>{searchIndex + 1} / {searchResults.length}</span>
                  <div className="flex items-center border-l border-zinc-300 dark:border-zinc-700 ml-1 pl-1">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSearch(undefined, "next")}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSearch(undefined, "prev")}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {isSearching && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
              <Button type="button" variant="ghost" size="icon" onClick={closeSearch} className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            </form>
          )}
        </div>
        {!showSearch && (
          <div className="flex items-center gap-4">
            {username === currentCreatorId && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDeleteRoom} 
                disabled={isDeleting}
                className="text-zinc-500 hover:text-red-500 flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="text-xs font-medium">채팅방삭제</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)} className="h-8 w-8 text-zinc-500">
              <Search className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-xs text-zinc-500">{isConnected ? "연결됨" : "연결 중..."}</span>
            </div>
          </div>
        )}
      </div>
      
      {showOnlineUsers && (
        <div className="absolute top-[73px] left-4 z-50 w-64 max-h-[300px] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg p-2">
          <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-500">접속 중인 사용자</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowOnlineUsers(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {onlineUsers.length === 0 ? (
              <p className="text-xs text-zinc-500 p-2 text-center">접속자가 없습니다.</p>
            ) : (
              onlineUsers.map((user) => (
                <div key={user} className="flex items-center justify-between group px-2 py-1.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {user === currentCreatorId ? (
                      <Crown className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    )}
                    <span className={`truncate ${user === currentCreatorId ? "font-bold text-blue-600" : user === username ? "font-bold text-blue-600" : ""}`}>
                      {user}
                      {user === username && " (나)"}
                    </span>
                  </div>
                  {username === currentCreatorId && user !== username && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onTransferHost(user)}
                        className="h-6 px-2 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        방장위임
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onKickUser(user)}
                        className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        강제퇴장
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">메시지를 불러오는 중...</div>
      ) : (
        <MessageList 
          messages={messages} 
          currentUserId={currentUserId} 
          loadMore={fetchNextPage}
          shouldLoadMore={!!nextCursor && !isFetchingNextPage}
          onUploadFiles={uploadFiles}
          isUploading={isUploading}
          scrollToMessageId={scrollToId}
          onScrollComplete={() => setScrollToId(null)}
          searchResults={searchResults}
          searchIndex={searchIndex}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
        />
      )}
      
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
        attachments={attachments}
        setAttachments={setAttachments}
        isUploading={isUploading}
        uploadFiles={uploadFiles}
        fileInputRef={fileInputRef}
      />
    </div>
  );
};
