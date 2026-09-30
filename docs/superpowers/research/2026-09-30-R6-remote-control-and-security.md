# R6 — Secure remote control of a local orchestrator from a phone

Status: research draft, 2026-09-30. All claims below were checked online on 2026-09-30 unless marked **[unverified]**. Maturity tags: **[stable]**, **[beta]**, **[experimental]**.

## 1. Summary of findings

1. **Every serious product converged on the same shape**: a local daemon makes an *outbound-only* connection to a relay; the phone is a thin client; pairing is a QR code carrying the daemon's public key. Anthropic's Remote Control and OpenAI's Codex Remote use this shape but are **not** end-to-end encrypted (Anthropic: "All traffic travels through the Anthropic API over TLS"; OpenAI: only "a secure relay layer"). Happy, Paseo and Remodex *are* E2EE and are open source (MIT / Apache-2.0 / Apache-2.0), so Workbox can copy their protocols rather than invent one. Both Anthropic and OpenAI gate the feature behind subscriptions/accounts (Claude: Pro/Max/Team/Enterprise, "API keys are not supported").
2. **Paseo's daemon security model is the closest template**: NaCl `box` (Curve25519 + XSalsa20-Poly1305), a persistent daemon keypair, QR code as the trust anchor, no command accepted before the handshake, relay sees "only IP addresses, timing, message sizes, and session IDs". Its relay is a separate Apache-2.0 Elixir service. Remodex adds Ed25519 identities, ephemeral X25519, HKDF-SHA256 → AES-256-GCM directional keys and monotonic counters (replay protection).
3. **Transport**: plain WebSocket through a Cloudflare Durable Object with the WebSocket Hibernation API is the cheapest workable relay in 2026 (free plan: 100k DO requests/day, 13,000 GB-s/day; incoming WS messages billed 20:1; idle hibernating objects cost nothing). WebTransport became Baseline in March 2026 (Safari/iOS 26.4) but there is no serverless host that terminates it for user code and Node needs a native libquiche addon — not worth it for v1. Vercel shipped native WebSockets only as a **public beta on 2026-06-22**, pinned to one instance with a 300 s cap on Hobby (800 s Pro), which forces a reconnect every 5 minutes — usable but clumsy.
4. **Crypto in TypeScript is finally native**: WebCrypto X25519 (Chrome 133+, Firefox 130+, Safari 17+) and Ed25519 (Chrome 137+, Firefox 129+, Safari 17+) cover ~88% of users; `@noble/curves` v2 (Trail of Bits audit Aug 2026) is the audited pure-TS fallback. MLS is overkill for one owner with 1–3 devices; pairwise sessions are enough.
5. **Push on iPhone**: Web Push works only for Home-Screen web apps (iOS 16.4+), needs a user gesture, has no silent push; since iOS 26 every site added to the Home Screen opens as a web app by default, and Declarative Web Push (iOS 18.4+) delivers without a service worker. The daemon can send VAPID pushes *directly* to the push endpoint with RFC 8291 payload encryption, so notifications never touch the relay.
6. **Mobile UI**: for a solo maintainer an **installable PWA** is the recommendation; Expo (SDK 57, RN 0.86) if an App Store presence or richer notifications become necessary; Tauri 2 mobile is supported (notification plugin lists iOS "Full") but the project itself never declared mobile DX on par with desktop.

## 2. Tables

### 2.1 Prior art

| Product | License / repo | Transport & relay | E2EE? | Pairing | Reusable pieces |
|---|---|---|---|---|---|
| Claude Code Remote Control (Feb 2026) | proprietary | Daemon "makes outbound HTTPS requests only", registers with Anthropic API and polls; server routes messages over a streaming connection; server mode `claude remote-control`, default `--capacity 32` | **No** — TLS to Anthropic; "multiple short-lived credentials, each scoped to a single purpose" | QR or pick session in app | Ideas: push toggles "Push when Claude decides / when actions required"; 5-min `dialogExpiry`; Trusted Devices (passkey/biometric step-up after 18 h); presence file suppresses push while you're at the keyboard |
| Codex Remote (preview 2026-05-14, GA 2026-06-25 per OpenAI dev docs) | proprietary | "A secure relay layer keeps trusted machines reachable … without exposing them directly to the public internet"; Mac + Windows hosts | Not claimed officially; X25519/Ed25519/AES-GCM stack reported only by third parties **[unverified]** | QR from desktop app, same ChatGPT account | Pattern only |
| Happy (happy.engineering) | MIT, github.com/slopus/happy (24k★) | Happy CLI ↔ Happy Server (default `api.cluster-fluster.com`) ↔ Expo app/web; self-host: `happy server` (embedded PGlite, no Redis/S3) | **Yes** — libsodium `crypto_box_easy` / `crypto_secretbox_easy`, AES-GCM via `rn-encryption`, HMAC-SHA512 hierarchical key derivation from a master seed (BIP32-like paths) | master secret / QR | `packages/happy-wire` (encrypted envelope `{t:'encrypted', c}`), key-derivation code, self-host server |
| Paseo (paseo.sh) | Apache-2.0, github.com/getpaseo/paseo (19.1k★); relay: getpaseo/paseo-relay (Elixir, Apache-2.0) | Daemon (Node) connects outbound to relay over WebSocket; also SSH tunnel or Tailscale | **Yes** — NaCl box, Curve25519 + XSalsa20-Poly1305; keypair in `$PASEO_HOME/daemon-keypair.json` | QR/link contains daemon public key ("the trust anchor"); daemon accepts no command before handshake | Security doc is a ready-made threat model; `packages/relay` transport layer |
| Remodex (Codex bridge) | Apache-2.0 (marks excluded), 3.3k★, "very early" | Node bridge ↔ configurable WebSocket relay ↔ SwiftUI iOS app; Tailscale self-host path | **Yes** — Ed25519 identity, ephemeral X25519, HKDF-SHA256 → directional AES-256-GCM, monotonic counters | QR with bridge pubkey, session ID, expiry | Handshake transcript design |
| Omnara | Apache-2.0, Go + React + Postgres, self-hostable | Cloud or self-hosted backend; agents durable in Postgres | No E2EE claim found | account | Little |
| Conductor (Melty Labs) | proprietary Mac app | No official remote; community `conductor-remote` = Node relay reading Conductor's SQLite + React PWA over Tailscale Serve/Funnel with a shared token | n/a (Tailscale) | token | Shows Tailscale-only path works |
| Vibe Kanban Remote Access (Feb 2026) | Apache-2.0; **company shut down 2026-04-10**, remote services kept 30 days then "fully local" | Host bound to one browser session; "every action … is signed locally in the browser and then verified by the host" | signing yes, details undisclosed | pairing code | Cautionary tale: relay tied to a company |

### 2.2 Transports

| Option | Browser support (Sept 2026) | Server side in TS | Verdict |
|---|---|---|---|
| WebSocket via relay | universal **[stable]** | `ws`, Bun, Cloudflare DO hibernation | **Recommended v1** |
| WebRTC DataChannel (P2P, STUN/TURN fallback) | universal; PeerJS MIT (Safari 15+), `simple-peer` last release 2022 (fork `@thaunknown/simple-peer` active) | Node needs `node-datachannel` (MPL-2.0, prebuilt macOS/Linux/Windows) or `werift` (pure TS, MIT, "towards 1.0"); Cloudflare TURN $0.05/GB (free with SFU; ~1,000 GB free tier reported) | Optional v2 for low-latency/large diffs; still needs relay for signalling |
| WebTransport | Baseline since March 2026: Chrome 97+, Firefox 114+, Safari/iOS 26.4+ (caniuse 91%) | Node: `@fails-components/webtransport` 1.x (libquiche addon) **[experimental]**; no serverless termination found | Not for v1 |
| SSE + fetch POST | universal **[stable]** | trivial; works on any host incl. Vercel | Fallback when WS blocked |

### 2.3 Relay hosts (prices as of 2026-09-30)

| Host | Free tier | Paid | Long-lived WS | Notes |
|---|---|---|---|---|
| Cloudflare Workers + Durable Objects | Workers 100k req/day; DO 100k req/day, 13,000 GB-s/day, 5 GB SQLite | Workers Paid $5/mo min; DO 1M req + 400k GB-s incl., then $0.15/M req, $12.50/M GB-s | Hibernation API: no duration billing while idle; 20:1 message billing; auto pong; 16 KB attachment; deploy drops sockets | **Recommended** (PartyServer from Cloudflare wraps it) |
| Vercel Functions WebSockets | Hobby free, 300 s max duration | Pro 800 s (1800 s **[beta]**) | Pinned to one instance, no cross-instance broadcast | **[beta]** since 2026-06-22 |
| Fly.io | none for new orgs (third-party reports; official page lists no free allowance) **[partly unverified]** | shared-cpu-1x 256 MB ≈ $1.94–2.02/mo | yes, it's a VM | simplest if you want a plain Node relay |
| Deno Deploy | 1M req/mo, 20 GiB egress, 10 h CPU | Pro $20/mo | WebSocket support on new platform **[unverified]**; Deploy Classic shuts down 2026-07-20 | |
| Supabase Realtime | 200 concurrent, 2M msgs/mo; project pauses after 1 week idle | Pro $25/mo, 500 concurrent | pub/sub only, relay logic elsewhere | idle pause is a deal-breaker |
| Tailscale (no relay) | Personal: 6 users, unlimited devices, Funnel incl. | Standard $8/user | Funnel ports 443/8443/10000, TLS only, "non-configurable bandwidth limits"; `tailscale serve` = tailnet-only | Zero-code alternative; `tsnet`/`libtailscale` have no Node bindings |
| Headscale | self-hosted; v0.29.4 (Sept 2026), min client 1.80 | — | — | for the paranoid |
| Cloudflare Tunnel + Access | Tunnel outbound-only, Zero Trust Free plan exists (card required, not charged); 50-user limit widely reported **[unverified on official page]** | ~$7/user | yes | good for browser-only clients |
| ngrok | 3 endpoints, 1 GB/mo, 20k HTTP req/mo, interstitial page, no custom domain; docs say endpoints have no timeout | Personal $8/mo | yes | dev-only |

### 2.4 Crypto libraries for TypeScript

| Need | Pick | Status |
|---|---|---|
| X25519 / Ed25519 | WebCrypto native (Safari 17+, Chrome 133/137+, Firefox 130+); fallback `@noble/curves` v2 (MIT, ESM-only, Node 20.19+; audits: ToB Aug 2026, Cure53 Sept 2024) | **[stable]** |
| AEAD | WebCrypto AES-256-GCM, or `@noble/ciphers` (XChaCha20-Poly1305, AES-GCM-SIV; Cure53 audit Sept 2024) | **[stable]** |
| libsodium | `libsodium-wrappers` 0.8.4 (npm, 2026) — what Happy/Paseo use; WASM, bigger bundle | **[stable]** |
| Handshake | Noise IK/XX: `noise-handshake` (Holepunch, Apache-2.0, tiny community) or `@chainsafe/libp2p-noise` (XX, updated June 2026); or hand-roll 3-DH with noble per the Noise spec | **[stable but niche]** |
| HPKE (RFC 9180) | `@hpke/core` + `@hpke/dhkem-x25519` (MIT, WebCrypto-based, Node/Deno/Bun/Workers; ML-KEM/X-Wing **[experimental]**) | **[stable]** |
| MLS (RFC 9420) | `ts-mls` (MIT, passes all interop vectors, "has not undergone a formal security audit"); `mls-ts` = OpenMLS via WASM | **[experimental]**; not needed |
| age | `age-encryption` (typage, BSD-3, noble-based, passkey recipients) | for encrypting logs/backups |
| Passkeys | `@simplewebauthn/server` 14.x (Node 22+, Deno 2.4+) + `/browser` | **[stable]** |
| Web Push | `web-push` (aes128gcm/RFC 8291) | **[stable]** |

### 2.5 Push options

| Channel | iPhone reality | Cost |
|---|---|---|
| Web Push (VAPID) | Home-Screen web app only (iOS 16.4+); permission needs a tap; no silent push; Declarative Web Push iOS 18.4+ (JSON `"web_push": 8030`, `title`, `navigate`), Badging API works | free |
| ntfy | Apache-2.0/GPLv2; open-source iOS app; self-hosted server must set `upstream-base-url` so ntfy.sh sends a content-free wake-up (only message ID + SHA-256 of topic URL leave your server) | free / self-host |
| Pushover | $4.99 one-time per platform; 10,000 msgs/month per account (per-account since 2026-05-01); emergency priority with acknowledgement | cheap, proprietary |
| Expo push (if Expo app) | free, 600 notifications/s/project; Expo Go no longer supports push (SDK 53+) | free |
| Desktop | Tauri `plugin-notification` (all platforms "Full"; actions mobile-only; Windows only for installed apps; no APNs/FCM push) or Web Notifications API; sounds supported | free |

## 3. Recommended architecture

```
 owner's computer                     dumb relay (Cloudflare Worker + DO)              phone
+------------------------+   wss     +--------------------------------------+   wss   +-----------------+
| Workbox daemon (TS)    |<--------->| DO "mailbox" per daemon-id           |<------->| PWA (Home Screen)|
|  agents, sessions      | outbound  |  - auth: bearer relay-token (hashed) |         |  WebCrypto keys  |
|  Ed25519 id + X25519   |  only     |  - forwards opaque ciphertext        |         |  Ed25519/X25519  |
|  per-device sessions   |           |  - queues ≤N msgs w/ TTL if offline  |         |  Web Push sub    |
|  web-push (VAPID) -----+---------->|  (never sees plaintext or keys)      |         +--------+--------+
+------------------------+  HTTPS    +--------------------------------------+                  ^
        direct to APNs/FCM push endpoint, payload encrypted per RFC 8291 -----------------------+
```

Protocol sketch (copy Paseo/Remodex): (1) `workbox pair` prints a QR: `{relayUrl, daemonId, daemonPubKey(Ed25519), oneTimeToken, expiry}`. (2) Phone opens the PWA, scans, connects to the relay with the one-time token, runs a Noise-IK-style handshake (phone ephemeral X25519 → daemon static; both sign the transcript with Ed25519), derives directional keys with HKDF-SHA256. (3) The daemon shows a Matrix-style short authentication string (7 emoji or 3×4 digits derived from the handshake hash) that the owner confirms on the desktop — this authenticates the *phone* to the daemon. (4) Daemon stores the device's public key + a per-device relay token; the relay stores only `sha256(token)` → `daemonId`. (5) All frames are `{counter, nonce, ciphertext}` with monotonic counters per direction; "asking" dialogs are typed messages that require an explicit signed reply. (6) Finish/attention events trigger a VAPID push (Declarative Web Push JSON) with a generic title; the ciphertext with details waits in the DO mailbox or is fetched when the PWA foregrounds.

Threat model:

| Adversary | Can | Cannot |
|---|---|---|
| Relay operator / compromised relay | See daemon IDs, IPs, timing, sizes; drop, delay or duplicate frames; exhaust quota | Read prompts/diffs, forge or replay accepted commands (signatures + counters), learn keys |
| Network attacker | Same as relay minus IDs (TLS) | Anything about content; MITM of pairing (QR is out-of-band, SAS confirms) |
| Stolen unlocked phone | Act as that device until revoked | Reach other devices' sessions; survive `workbox devices revoke <id>` (daemon drops its key, relay token rotated); should still face WebAuthn user-verification before approving destructive actions |
| Stolen relay token only | Connect to the mailbox, receive ciphertext, spam it | Decrypt, impersonate a device, pair a new device (needs daemon-signed handshake + SAS) |
| Stolen daemon key file | Impersonate the daemon to paired phones | — Mitigation: file mode 0600, optional macOS Keychain, re-pair on rotation |

Concrete stack: daemon in TypeScript on Node 22/Bun with `ws`, `@noble/curves` + `@noble/ciphers` + `@noble/hashes` (or WebCrypto where available), `web-push`; relay = Cloudflare Worker + Durable Object (optionally `partyserver`), one file, no database beyond DO storage; client = PWA (Vite + service worker, WebCrypto, `navigator.storage.persist()`); optional `@simplewebauthn/*` for a passkey-protected web dashboard; ntfy or Pushover as a second alert path for people who refuse Home-Screen web apps.

## 4. Open questions for the owner

1. Is "phone" iPhone-only? If Android matters, Web Push is unrestricted there and the PWA case gets stronger.
2. Should the relay queue ciphertext for offline phones (useful for missed "asking" dialogs) or stay purely live? Queuing means the relay holds encrypted blobs with a TTL.
3. One owner, many devices: are pairwise sessions per device acceptable, or is a shared device group (MLS) desired later?
4. Do you want a hosted default relay (you pay Cloudflare, users trust your metadata handling) or "bring your own relay" only, like Remodex?
5. Will Workbox wrap Claude Code's own Remote Control / Codex Remote as an alternative path, or always use its own channel?
6. Acceptable dependency risk: audited noble stack vs. libsodium WASM vs. tiny Noise libraries.

## 5. Sources (accessed 2026-09-30)

- Claude Code docs: https://code.claude.com/docs/en/remote-control ; https://code.claude.com/docs/en/mobile
- Happy: https://github.com/slopus/happy ; https://github.com/slopus/happy/tree/main/packages/happy-app/sources/encryption ; https://github.com/slopus/happy/tree/main/packages/happy-server-self-host ; https://github.com/slopus/happy-cli (archived 2026-02-14)
- Paseo: https://paseo.sh/docs/security ; https://paseo.sh/docs/connectivity ; https://github.com/getpaseo/paseo ; https://github.com/getpaseo/paseo-relay
- Codex: https://openai.com/index/work-with-codex-from-anywhere/ ; https://learn.chatgpt.com/docs/remote-connections ; https://learn.chatgpt.com/docs/remote ; third-party analysis https://codex.danielvaughan.com/2026/05/15/codex-mobile-chatgpt-app-relay-architecture-remote-agent-control/
- Remodex: https://github.com/Emanuele-web04/remodex
- Omnara: https://github.com/omnara-ai/omnara ; Conductor community remote: https://github.com/hyldmo/conductor-remote
- Vibe Kanban: https://www.vibekanban.com/blog/remote-access (2026-02-28) ; https://www.vibekanban.com/blog/shutdown (2026-04-10) ; https://github.com/BloopAI/vibe-kanban
- WebTransport: https://caniuse.com/mdn-api_webtransport ; https://developer.mozilla.org/en-US/docs/Web/API/WebTransport ; https://webrtc.ventures/2026/04/webtransport-is-now-baseline-what-it-means-for-real-time-media/ ; https://github.com/fails-components/webtransport
- WebRTC libs: https://github.com/peers/peerjs ; https://github.com/murat-dogan/node-datachannel ; https://github.com/shinyoshiaki/werift-webrtc ; https://developers.cloudflare.com/realtime/turn/
- Cloudflare: https://developers.cloudflare.com/durable-objects/platform/pricing/ (updated 2026-09-30) ; https://developers.cloudflare.com/durable-objects/best-practices/websockets/ ; https://developers.cloudflare.com/workers/platform/pricing/ (2026-08-28) ; https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/cloudflare-one/setup/ ; https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/ ; PartyKit: https://github.com/cloudflare/partykit
- Vercel: https://vercel.com/docs/functions/websockets (2026-08-10) ; https://vercel.com/docs/functions/limitations (2026-08-24) ; https://vercel.com/changelog/websocket-support-is-now-in-public-beta (2026-06-22)
- Fly.io: https://docs.fly.io/about/pricing/ ; Deno: https://deno.com/deploy/pricing ; https://docs.deno.com/deploy/ ; Supabase: https://supabase.com/docs/guides/realtime/limits ; https://supabase.com/pricing
- Tailscale: https://tailscale.com/pricing ; https://tailscale.com/kb/1223/funnel ; https://tailscale.com/kb/1312/serve ; https://tailscale.com/kb/1244/tsnet ; https://github.com/tailscale/libtailscale ; Headscale: https://github.com/juanfont/headscale/releases ; ngrok: https://ngrok.com/docs/pricing-limits/free-plan-limits
- WebCrypto: https://caniuse.com/mdn-api_subtlecrypto_importkey_x25519 ; https://blogs.igalia.com/jfernandez/2025/08/25/ed25519-support-lands-in-chrome-what-it-means-for-developers-and-the-web/
- Crypto libs: https://github.com/paulmillr/noble-curves ; https://github.com/paulmillr/noble-ciphers ; https://www.npmjs.com/package/libsodium-wrappers ; https://github.com/holepunchto/noise-handshake ; https://github.com/ChainSafe/js-libp2p-noise ; https://github.com/dajiaji/hpke-js ; https://github.com/LukaJCB/ts-mls ; https://github.com/FiloSottile/typage ; https://simplewebauthn.dev/docs/packages/server ; https://github.com/web-push-libs/web-push ; SAS pattern: https://spec.matrix.org/latest/client-server-api/#short-authentication-string-sas-verification
- Push / PWA on iOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ ; https://webkit.org/blog/16535/meet-declarative-web-push/ ; https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ (2025-09-15) ; https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ (2026-09-17) ; https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria ; ntfy: https://docs.ntfy.sh/config/ ; https://github.com/binwiederhier/ntfy ; Pushover: https://pushover.net/api ; https://blog.pushover.net/posts/2026/4/app-limits
- Mobile frameworks: https://expo.dev/changelog/sdk-57 (2026-06-30) ; https://docs.expo.dev/push-notifications/faq/ ; https://v2.tauri.app/plugin/notification/ ; https://v2.tauri.app/blog/tauri-20/ (2024-10-02) ; https://github.com/tauri-apps/tauri/releases (v2.12.0, Sept 2026 — year inferred, GitHub page showed relative dates)
