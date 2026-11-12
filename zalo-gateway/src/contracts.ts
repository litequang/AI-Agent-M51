export type AccountState = "disconnected" | "qr_pending" | "authenticating" | "connected" | "degraded" | "reconnecting" | "needs_relogin";
export type ThreadType = "dm" | "group";
export type EventKind = "message" | "edit" | "recall" | "attachment" | "other";
export type Direction = "inbound" | "outbound" | "self";
export interface MockQr { label: "SIMULATED"; challengeId: string; expiresAt: string }
export interface LoginState { accountId: string; state: AccountState; mock: true; qr?: MockQr }
export interface AccountView {
  id: string; label: string; state: AccountState; mock: true;
  collectorStartedAt: string | null; qr?: MockQr;
}
export interface CanonicalEvent {
  accountId: string; threadId: string; threadType: ThreadType;
  sourceMessageId: string; senderId: string; direction: Direction;
  sourceTimestamp: string; receivedAt: string; eventKind: EventKind;
  version: number; contentType: "text" | "attachment" | "other";
  content: string; sourceRef: string; traceId: string;
  threadLabel: string; muted: boolean; quoteSourceMessageId?: string;
}
export interface EventReceipt { ingestSequence: number; duplicate: boolean; persisted: true }
export interface ConnectorCapabilities {
  mock: true; realLogin: false; realSend: false; historyBackfill: false;
  newMessages: true; dm: true; groups: true; selfMessages: true;
  mutedGroups: "fixture-only-not-verified";
}
export interface ConnectorHealth { accountId: string; state: AccountState; mock: true; listenerCount: number }
export interface ManualSendInput {
  accountId: string; threadId: string; text: string; intentId: string; quoteSourceMessageId?: string;
}
export type MockSendOutcome = "sent_ack" | "failed" | "uncertain";
export interface SendReceipt { state: MockSendOutcome; sourceMessageId?: string; mock: true }
export interface Connector {
  readonly accountId: string;
  capabilities(): ConnectorCapabilities;
  beginLogin(): Promise<LoginState>;
  getLoginState(): LoginState;
  connect(challengeId: string): Promise<LoginState>;
  disconnect(reason?: string): Promise<LoginState>;
  onEvent(handler: (event: CanonicalEvent) => Promise<EventReceipt>): () => void;
  sendManual(input: ManualSendInput): Promise<SendReceipt>;
  getHealth(): ConnectorHealth;
}
export interface ThreadView {
  accountId: string; threadId: string; threadType: ThreadType;
  label: string; muted: boolean; messageCount: number; lastMessageAt: string | null;
}
export interface MessageView extends CanonicalEvent { ingestSequence: number; recalled: boolean }
export interface GapView {
  id: number; accountId: string; startedAt: string; endedAt: string | null;
  reason: string; coverage: "unknown";
}
export type OutboxState = "draft" | "user_confirmed" | "pending" | "sent_ack" | "failed" | "uncertain";
export interface OutboxView extends ManualSendInput {
  id: string; state: OutboxState; mock: true; createdAt: string; updatedAt: string;
  confirmationRequired: true; error?: string;
}
export class GatewayError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
