# Chat Service Implementation Guide (WebSocket)

이 파일은 이 프로젝트에 실시간 채팅 서비스를 구현하기 위한 단계별 가이드와 기술 표준을 정의합니다.

## 1. 기술 스택 권장 사항
- **실시간 엔진:** `Socket.io` (Next.js와 호환성이 높고 안정적임)
- **상태 관리:** `React Context` 또는 `TanStack Query` (서버 데이터 동기화)
- **데이터베이스:** `Prisma` + `PostgreSQL` (메시지 이력 저장 및 관계형 데이터 관리)
- **UI:** 기존 `src/components/ui`의 Shadcn UI 컴포넌트 활용

## 2. 구현 단계 (Roadmap)

### 1단계: 소켓 서버 환경 구축
1. **패키지 설치:** `npm install socket.io socket.io-client`
2. **서버 핸들러 작성:** Next.js API Route(또는 별도 서버)에 소켓 초기화 로직 구현.
3. **연결 테스트:** 클라이언트와 서버 간의 기본적인 `connection` 이벤트 확인.

### 2단계: 클라이언트 소켓 통합
1. **Socket Provider:** `src/components/providers/socket-provider.tsx`를 생성하여 앱 전체에서 소켓 인스턴스 공유.
2. **커스텀 훅:** `useSocket` 훅을 만들어 컴포넌트에서 쉽게 소켓 기능을 사용하도록 구현.

### 3단계: 채팅 UI 및 기본 통신
1. **컴포넌트 개발:** `ChatRoom`, `MessageList`, `MessageInput` 컴포넌트 생성.
2. **이벤트 처리:**
   - `send-message`: 메시지 전송 시 서버로 방출.
   - `receive-message`: 서버로부터 받은 메시지를 화면에 실시간 반영.

### 4단계: 데이터베이스 연동 및 이력 관리
1. **스키마 설계:** `User`, `Room`, `Message` 모델 정의.
2. **메시지 저장:** 소켓 이벤트 발생 시 DB에 메시지 영구 저장.
3. **이력 불러오기:** 채팅방 입장 시 최신 대화 내역(예: 50개) 로드 및 무한 스크롤 구현.

### 5단계: 서비스 고도화 (Advanced)
1. **채팅방(Room) 기능:** `socket.join(roomId)`를 이용한 개별 대화방 격리.
2. **입력 중 표시 (Typing Indicator):** 유저가 타이핑 중일 때 상태 공유.
3. **읽음 처리:** 상대방이 메시지를 확인했을 때 `isRead` 상태 업데이트.
4. **알림:** 브라우저 알림(Web Notification) 연동.

---
## 3. 개발 규칙
- **Type Safety:** 모든 소켓 이벤트 페이로드에 대해 TypeScript interface를 정의할 것.
- **Styling:** 기존 프로젝트의 SCSS Module 및 Tailwind CSS 컨벤션을 엄격히 준수할 것.
- **Security:** 환경 변수(`.env`)를 사용하여 소켓 서버 URL 및 보안 설정을 관리할 것.
