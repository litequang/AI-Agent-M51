// Extracted from minhkhoa0502/zalo-personal-mcp src/session.ts at
// e91ecfe0c17d29bb50fa2adc22759407604c9b92. MIT (c) 2026 Khoa Tran.
// License: ../../third-party/zalo-personal-mcp.LICENSE.
import { timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
