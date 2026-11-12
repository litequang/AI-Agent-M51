# Platform permission gate — Phase 01

Reviewed 2026-11-12 using primary Zalo pages only. **LIVE_PILOT = NO-GO pending a permissible connection method and later explicit owner approval. Live execution = SKIP.** Approval for source audit/mock coding does not authorize real QR login, session restoration, history access or sending.

## Personal-account restriction

Zalo's current [Terms of Use](https://zalo.vn/dieukhoan/), §4.7, prohibit login/use through third-party software or systems that Zalo has not developed, licensed or approved. §§4.1/4.4 address unauthorized derivative/reverse-engineering activity; §3.1 limits accounts/devices; §14.2 provides violation responses including restrictions. The official [terms update notice](https://help.zalo.me/huong-dan/chuyen-muc/quan-ly-tai-khoan-zalo/tai-khoan/thong-bao-ve-dieu-khoan-su-dung-moi-nhat-cua-zalo/) dated 2026-08-28 links directly to that full text. This is an explicit approval requirement, not merely an automation-rate question.

Audit inference: no evidence supplied or found establishes Zalo approval for these pinned personal-account connectors. Account-owner consent, a successful QR scan, MIT licensing and a paid vendor's similar UX do not establish that approval. Keeping operation read-only or choosing a secondary account does not resolve §4.7. Do not bypass device checks, anti-abuse measures or account restrictions. This is a project gate decision, not a claim about inevitable enforcement or an account-ban probability.

Source identity: zalo-agent `4346f295e9dbd787a427993ddf3b083ebb57cf15`, `src/zalo/zalo-client.ts:17-25,86-110`; zca-js `2a7e360257dfe98e2eb48dc46bbf389834be7e0b`, `package.json:4`, `src/apis/loginQR.ts:78-100,136-151`; MCP `e91ecfe0c17d29bb50fa2adc22759407604c9b92`, `src/zalo-client.ts:40-55`. Those paths implement a personal-session mechanism; they do not carry platform permission. [reuse-audit.md](reuse-audit.md) documents code/security reasons to keep them disabled.

## Official alternatives

| Route | Primary evidence | Product consequence |
|---|---|---|
| Official Account OpenAPI | [Zalo Developers catalog](https://developers.zalo.me/docs/); [app creation and permission grants](https://oa.zalo.me/home/documents/guides/Khoi-tao-ung-dung-va-cap-quyen_117071366476220195) | Documented application/OA grants and OA interaction webhooks. Evaluate an OA-specific inbox as a separate connector/product scope |
| OA conversations and groups | [OA messaging overview](https://oa.zalo.me/home/documents/guides/tong-quan-cac-loai-tin-nhan-tren-zalo-official-account-_3651713298729094511?tab=library); [interaction policy](https://oa.zalo.me/home/documents/vie/policy/tuong-tac-cua-oa-voi-nguoi-dung) | OA-to-user conversations and OA GMF groups have purpose, interaction and messaging constraints; arbitrary personal DM/group parity is not demonstrated by these docs |
| Zalo Bot Platform | [Introduction](https://bot.zapps.me/docs), [getUpdates](https://bot.zapps.me/docs/apis/getUpdates/), [platform terms](https://bot.zapps.me/docs/terms/) | Official automated bot identity with update polling/webhook APIs. It is a bot interaction stream; the reviewed docs do not grant access to an existing personal inbox |

Bot terms sections III, V and VIII require developer/end-user responsibilities and use of permitted functionality. An official Bot or OA route still needs its own permissions/security review. Do not generalize Bot permission to personal-client automation. Polling may be worth evaluating for phone-only operation; no public webhook, new tailnet port or live Bot registration is authorized here.

## Gate evidence needed before reconsideration

1. Establish a documented permissible connector scope: platform approval applicable to the proposed personal client, or an accepted OA/Bot product scope using documented APIs. Archive the exact applicable policy version and grant evidence privately; retain only sanitized references publicly.
2. Obtain explicit later owner authorization for the particular secondary account/official identity, consented test peers, new-message-only collection window and permitted read operations. Sending remains a separate gate. Do not request cookies, QR images, tokens or session data in chat.
3. Resolve dependency/source provenance and relevant advisory findings, ensure strict account isolation and protected session storage, and test the gateway's durable journal, storage-failure behavior, self events and no-real-send controls with mocks first.
4. Agree retention/deletion/access scope for counterparties and groups; expose coverage gaps and avoid completeness claims. Muted-group delivery, self-event behavior and listener contention require authorized measurement, not inference from source code.

Until all applicable conditions pass, keep real connector dependency installation/imports and network login paths disabled. Permit only synthetic fixtures and mock manual outbox confirmation bound to exact account/thread/payload. No autonomous replies, background seen/delivered writes, historical backfill, bulk actions or retries of uncertain sends. No persistent service enablement, AI runtime change or additional tailnet exposure belongs to this audit.

| Result | Assessment |
|---|---|
| PASS | Primary Zalo terms and official OA/Bot documentation were retrieved and reviewed |
| FAIL / NO-GO | Permission to use the proposed personal-session clients is not established; owner approval for a live pilot is absent |
| SKIP | Real QR/session, receive/send/coverage tests and device/runtime changes; enforcement probability and personal-inbox parity unverified |

## Narrow code inheritance does not activate a connector

The coding snapshot extracts only MCP `safeEqual` and pure envelope/quote shaping under MIT, adapts the agent account/thread schema and WAL pattern using FULL in a worker, and treats zca-js DTO/ThreadType as protocol reference. Zero runtime npm dependencies and the absent real SDK reduce implementation exposure; they do not supply platform approval. The exact dev pins are @types/node 24.19.2 and TypeScript 6.0.3. Full upstream MIT notices were observed; no whole-product fork or live activation is claimed. The focused sidecar in [reuse-audit.md](reuse-audit.md) records remaining architecture concerns without changing this NO-GO gate.
