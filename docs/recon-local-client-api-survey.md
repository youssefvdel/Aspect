# Recon — Open-source Valorant local-client API survey (2026-09-11)

Method: cloned `techchrism/valorant-api-docs` (trunk), `liamcottle/valorant-api-nodejs`,
`techchrism/valorant-websocket-log-viewer`, `HeyM1ke/ValorantClientAPI`; read the published
site `valapidocs.techchrism.me`; then queried the **live, running** Riot Client on this machine
(lockfile `Riot Client:12476:5482:<redacted>:https`, base `https://127.0.0.1:5482`,
`curl -sk`, basic auth `riot:<pw>`).

---

## 1. The definitive local endpoint list is self-describing

Two live endpoints enumerate everything the running build exposes:

```bash
P=5482; PW=...; AUTH="Basic $(printf 'riot:%s' "$PW" | base64 -w0)"
curl -sk -H "Authorization: $AUTH" "https://127.0.0.1:$P/help"                  # 298 KB
curl -sk -H "Authorization: $AUTH" "https://127.0.0.1:$P/swagger/v3/openapi.json" # 1.4 MB
```

Observed results:
- `GET /swagger/v3/openapi.json` → HTTP 200, 1,476,580 bytes. **792 path items**
  (449 GET / 332 POST / 162 PUT / 136 DELETE / 3 PATCH). Full dump saved to
  `%LOCALAPPDATA%/Temp/valorant-survey/live-endpoints.txt`.
- `GET /help` → HTTP 200, 298,517 bytes. `{events: 61, functions: 1283, types: 4053}`.

`/swagger/v3/openapi.json` and `/help` are the only ground truth for "what does THIS build
expose" — do not hardcode endpoint lists; fetch and diff them.

Also available: `GET /swagger/v1/api-docs`, `GET /swagger/v2/swagger.json`.

---

## 2. NEW FINDING — local PUUID → identity lookup (NOT in techchrism's docs)

`/player-account/lookup/*/namesets-for-puuid*` were found **only** in the live OpenAPI spec —
they are absent from the techchrism markdown docs and from `liamcottle/valorant-api-nodejs`.
Verified live against the running client.

```bash
# WORKS — batched, arbitrary PUUIDs, incl. non-friends
curl -sk -H "Authorization: $AUTH" -H "Content-Type: application/json" \
  -X POST -d '{"puuids":["2ef28c39-c342-55f0-a159-9cd0cae55f2d"]}' \
  https://127.0.0.1:5482/player-account/lookup/v2/namesets-for-puuids
# 200 -> {"namesets":[{"alias":{"gameName":"AboHaMaDa","tagLine":"6611"},"error":"",
#        "puuid":"2ef28c39-...","xboxNameset":{...},"playstationNameset":{...},...}]}

# unknown PUUID -> same shape, explicit error string (no exception, no blank ambiguity)
# 200 -> {"namesets":[{"alias":{"gameName":"","tagLine":""},
#        "error":"Nameset V2 not found for puuid.","puuid":"11111111-..."}]}

# v1 returns "gnt" instead of "alias"
curl -sk ... -X POST -d '{"puuids":["2ef28c39-..."]}' \
  https://127.0.0.1:5482/player-account/lookup/v1/namesets-for-puuids
# 200 -> {"namesets":[{"gnt":{"gameName":"AboHaMaDa","tagLine":"6611","shadowGnt":false},...}]}
```

Request body **must** be an object `{"puuids":[...]}` — a bare JSON array returns
`400 RPC_ERROR ... "the input not a structure"`.

Reverse direction and self:

```bash
curl -sk -H "Authorization: $AUTH" \
  "https://127.0.0.1:5482/player-account/aliases/v1/lookup?gameName=AboHaMaDa&tagLine=6611"
# 200 -> [{"alias":{"game_name":"AboHaMaDa","tag_line":"6611"},"puuid":"2ef28c39-..."}]

curl -sk ... https://127.0.0.1:5482/player-account/aliases/v1/display-name
# 200 -> {"gameName":"lil ga7ed","tagLine":"zngr"}

curl -sk ... https://127.0.0.1:5482/player-account/aliases/v1/aliases
# 200 -> every historical Riot ID on the account: {"aliases":[{"game_name":"lilga7ed","tag_line":"sus",
#        "active":false,"created_datetime":1680985058000}, ...]}
```

**Why it matters:** `POST /player-account/lookup/v2/namesets-for-puuids` resolves names for
**strangers and opponents**, locally, with no entitlements token, no remote `pd.*` call, no
rate limit, and no Cloudflare exposure. It is batched (many PUUIDs per request). The explicit
`error: "Nameset V2 not found for puuid."` distinguishes "not found" from an empty name, which
the remote `PUT /name-service/v2/players` does not (it returns blank `game_name`).

Note: this is a local lookup, so whether it resolves a *currently-hidden incognito* player is
NOT established here — it was not tested during a live hidden match. Treat it as the first rung
of the reveal ladder, not as a proven incognito unmask.

---

## 3. Websocket event system

URI: `wss://riot:{lockfile password}@127.0.0.1:{port}` — self-signed cert, so
`rejectUnauthorized: false` / `curl -k`. The basic-auth credentials go in the URL.

Subscribe protocol (LCU-style), from `techchrism/valorant-websocket-logger/index.js`:
```js
ws.send(JSON.stringify([5, 'OnJsonApiEvent_chat_v4_presences']))
```
Message envelope is a 3-element array: `[<code>, "<eventName>", <eventData>]`, and
`eventData.data` mirrors the REST response body of the matching endpoint.

`/help` → `events` is the live subscription dictionary. **It is dynamic per build AND per
loaded plugin.** Observed on this machine: 61 events and **zero `chat_*` events**, because
VALORANT.exe was not running (chat plugin not registered). An older captured dump
(`floxay/ValorantRichPresence/help.json`, 130 KB) has **169 events including 30+ `chat_*`**.
`valorant-websocket-logger` retries `/help` in a loop until
`OnJsonApiEvent_chat_v4_presences` appears before subscribing — that is the correct pattern.

Events that carry names / identifiers:
- `OnJsonApiEvent_chat_v4_presences` — **carries `game_name`, `game_tag`, `puuid`** for every
  presence, plus base64 `private` with `partyId`. This is the documented live party-ID source
  (`docs/common-components.md`).
- `OnJsonApiEvent_riot-messaging-service_v1_message` — pushes RMS messages; docs say the
  pregame/core-game match ID arrives on the URI
  `/riot-messaging-service/v1/message/ares-core-game/core-game/v1/matches/...`.
- Older/other builds also list `OnJsonApiEvent_chat_v5_participants`,
  `OnJsonApiEvent_chat_v6_conversations`, `OnJsonApiEvent_chat_v6_messages`,
  `OnJsonApiEvent_player-account_aliases_v1`, `OnJsonApiEvent_entitlements_v1_token`.

Envelope/decoding confirmed in `techchrism/valorant-websocket-log-viewer/src/store/index.js`:
`JSON.parse(text)` → `[, eventName, eventData]`, then `event.data.data.presences` is the
presences array, and each `presence.private` is
`JSON.parse(private.startsWith('{') ? private : atob(private))`.

REST alternative to the websocket: RMS buffer reads via
`GET /riot-messaging-service/v1/message/{a}/{b}/...` (up to 6 path segments). Probe results
here 404 (`Invalid function` / `Not found`) for guessed paths with no live match, so the exact
segment shape is unverified in this session. `GET /riot-messaging-service/v1/state` → `"Connected"`,
`/v1/session` → `{state, token}`, `/v1/user` → own puuid (all verified 200).

---

## 4. Other local endpoints live on this machine (verified this session)

| Endpoint | Result |
|---|---|
| `GET /chat/v1/session` | 200 — `game_name`, `game_tag`, `puuid`, `region`, `state:"connected"` |
| `GET /chat/v5/participants` | 200 — participants across ALL conversations with `game_name`/`game_tag`/`puuid` |
| `GET /chat/v6/conversations` | 200 — list of CIDs (`...@eu1.pvp.net`) |
| `GET /chat/v7/conversations` | 200 — same shape (v7 exists) |
| `GET /chat/v6/conversations/ares-parties` | 200 `{"conversations":[]}` (empty; party chat lives on remote `ares-parties`) |
| `GET /chat/v6/friendrequests/full` | 200 — pending friend requests with `gameName`/`tagLine`/`puuid` |
| `GET /social/v1/friends` | 200 — friend list with `gameName`/`gameTag`/`puuid` |
| `GET /social/v1/presences/multigame` | 200 — richer presence objects incl. `party`, `crossPlayPermissions` |
| `GET /player-account/aliases/v1/active` | 200 — own `game_name`/`tag_line` |
| `GET /riotclient/region-locale` | 200 — `{"locale":"en_US","region":"NA","webRegion":"NA"}` |
| `GET /product-session/v1/external-sessions` | 200 — launch args incl. `-ares-deployment=eu`, `-remoting-auth-token` |
| `GET /entitlements/v1/token` | 200 — accessToken + entitlements JWT + subject |
| `GET /chat/v4/presences` | documented; friend presences only |

`GET /presences/v1/friends` → 503 `Plugin not initialized` on this build.

---

## 5. Sources

- `techchrism/valorant-api-docs` (trunk), 593★ — `docs/readme.md`, `docs/common-components.md`,
  `docs/Useful Local/*`, `docs/Local Chat/*`, `docs/Party/*`, `docs/Pre-Game/*`,
  `docs/Current Game/*`, `docs/Session/*`, `docs/Other Local/*`,
  `valorant-api-types/src/endpoints.ts`, `.../pvp/NameService.ts`, `.../local/Presence.ts`,
  `web/src/types/AugmentedValorantEndpoint.ts`, `web/src/pages/insomnia.json.ts`
- Published: `https://valapidocs.techchrism.me`, `https://techchrism.github.io/valorant-api-docs`
- `liamcottle/valorant-api-nodejs` — `docs/RiotClientServices.md`, `src/LocalRiotClientAPI.js`
- `techchrism/valorant-websocket-logger` — `index.js` (subscribe protocol, /help polling)
- `techchrism/valorant-websocket-log-viewer` — `src/store/index.js` (envelope + presence decode)
- `floxay/ValorantRichPresence` — `help.json` (169-event `/help` dump)
- `HeyM1ke/ValorantClientAPI` — `Docs/PlayerID.md`, `docsv2/player/GetUserfromID.md` (remote name-service)
- `giorgi-o/CrossPlatformPlaying` wiki — XMPP presence path
- Gist `techchrism/7e7afc87d72adb76a212da03c9cd28f5` — 56-event `/help` snapshot
