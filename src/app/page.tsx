"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./page.module.scss";

interface Message {
  id: number;
  text: string;
  isMe: boolean;
}

function Home() {
  const router = useRouter();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now(),
      text: inputValue,
      isMe: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
  };

  if (!isChatOpen) {
    return (
      <div className={styles.container}>
        <div className={styles.container__onBoarding}>
          <span className={styles.container__onBoarding__title}>채팅</span>
          <Button
            onClick={() => router.push("/chat")}
            variant={"outline"}
            className="w-full bg-transparent text-orange-500 border-orange-400 hover:bg-orange-50 hover:text-orange-500"
          >
            채팅 시작하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.container__chat}>
        <div className={styles.container__chat__messages}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.container__chat__messages__message} ${
                msg.isMe
                  ? styles["container__chat__messages__message--sent"]
                  : styles["container__chat__messages__message--received"]
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <div className={styles.container__chat__inputArea}>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="메시지를 입력하세요..."
            className="flex-1"
          />
          <Button onClick={handleSendMessage} className="bg-orange-500 hover:bg-orange-600 text-white">
            전송
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={() => setIsChatOpen(false)}
          className="mt-4 text-gray-500"
        >
          나가기
        </Button>
      </div>
    </div>
  );
}

export default Home;
