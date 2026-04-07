import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// PrismaClient 인스턴스를 생성합니다.
// Prisma 7에서는 datasourceUrl 옵션을 전달해야 합니다.
export const db =
  globalThis.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL, // 여기에 DATABASE_URL 전달
  });

// 개발 환경에서는 글로벌 캐싱
if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}