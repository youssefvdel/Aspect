# Recon — PUUID → Riot ID endpoint probe (LIVE, 2026-09-11)

Riot Client lockfile: `C:/Users/Administrator/AppData/Local/Riot Games/Riot Client/Config/lockfile`
`Riot Client:12476:5482:<redacted>:https` → base `https://127.0.0.1:5482`, basic auth `riot:<pw>`, `curl -k`.
VALORANT-Win64-Shipping.exe (PID 18016) was running and logged in as `29bf3c62-9f92-5b55-8188-a4e88f04b8ec`.

Only ONE Riot local API port exists: **5482** (PID 12476 RiotClientServices). Other 127.0.0.1 listeners are python(24533), Discord(6463), Spotify(7768).

## RESULTS

| # | Endpoint | Method | Body | HTTP | Observed response (exact, trimmed) | Name? |
|---|----------|--------|------|------|--------------------------------------|-------|
| 1 | `https://127.0.0.1:5482/name-service/v2/players` | PUT | `[...puuids]` | 404 | `{"errorCode":"RESOURCE_NOT_FOUND","httpStatus":404,"message":"Invalid URI format"}` | NO |
| 2 | `/chat/v4/presences` | GET | – | 200 | `{"presences":[{"pid":"29bf3c62-9f92-5b55-8188-a4e88f04b8ec@eu1.pvp.net","game_name":"lil ga7ed","game_tag":"zngr",...,"packedData":"<b64>","private":"<b64>"}]}` — 8 presences | **YES** |
| 3 | `/chat/v5/participants` | GET | – | 200 | `{"participants":[{"puuid":"29bf3c62-...","game_name":"lil ga7ed","game_tag":"zngr","cid":"...@eu1.pvp.net","region":"eu1"}]}` — 6 entries | **YES** |
| 4 | `/chat/v6/conversations` | GET | – | 200 | `{"conversations":[{"cid":"2ef28c39-...@eu1.pvp.net","type":"chat","mid":"..."}]}` — no names | NO |
| 5 | `/chat/v3/presences` `/chat/v2/presences` `/chat/v3/participants` `/chat/v4/participants` `/chat/v4/conversations` `/chat/v6/participants` `/chat/v7/participants` | GET | – | 404 | `Invalid URI format` | NO |
| 6 | `/parties/v1/parties` | GET | – | 404 | `Invalid URI format` | NO |
| 7 | `/parties/v1/players` | GET | – | 404 | `Invalid URI format` | NO |
| 8 | `/parties/v1/players/{puuid}` | GET | – | 404 | `Invalid URI format` | NO |
| 9 | `/core-game/v1/matches` | GET | – | 404 | `Invalid URI format` | NO |
| 10 | `/core-game/v1/players/{puuid}` | GET | – | 404 | `Invalid URI format` | NO |
| 11 | `/core-game/v1/match-details/` | GET | – | 404 | `Invalid URI format` | NO |
| 12 | `/pregame/v1/matches` | GET | – | 404 | `Invalid URI format` | NO |
| 13 | `/pregame/v1/players/{puuid}` | GET | – | 404 | `Invalid URI format` | NO |
| 14 | `/match-history/v1/history/{puuid}` (local) | GET | – | 404 | `Invalid URI format` | NO |
| 15 | `/riotclient/region-locale`, `/riotclient/get_region_locale` | GET | – | 200 | `{"locale":"en_US","region":"NA",...}` | NO |
| 16 | `/riotclient/auth-token` | GET | – | 200 | `"xKHxbw0HgOjaMygDuDLrzg"` | NO |
| 17 | `/riotclient/affinity` | GET | – | 200 | `{"currentAffinity":null}` | NO |
| 18 | `/riotclient/command-line-args` | GET | – | 200 | `[]` | NO |
| 19 | `/riotclient/ux-state`, `/riotclient/services`, `/riotclient/eula`, `/riotclient/session`, `/riotclient/build-info`, `/riotclient/processes`, `/riotclient/riotclient_session`, `/riotclient/v1/riotclient_session` | GET | – | 404 | `Invalid URI format` | NO |
| 20 | `/rso-auth/v1/authorization/userinfo` | GET | – | 200 | `{"userInfo":"{\"sub\":\"29bf3c62-...\",\"acct\":{\"game_name\":\"lil ga7ed\",\"tag_line\":\"zngr\"},\"preferred_username\":\"lilmos3ad\",...}"}` | **YES (self only)** |
| 21 | `/rso-auth/v2/authorizations` | GET | – | 405 | `{"errorCode":"WRONG_METHOD","httpStatus":405,...}` | NO |
| 22 | `/rso-auth/v1/session/info`, `/riotclient/authorization/userinfo` | GET | – | 404 | `Invalid URI format` | NO |
| 23 | `/entitlements/v1/token` | GET | – | 200 | `{"accessToken":"<jwt>","subject":"29bf3c62-...","token":"<entitlements jwt>"}` | NO (subject only) |
| 24 | `/social/v1/friends` | GET | – | 200 | `{"friends":[{"puuid":"02fd4779-...","gameName":"AhmedElMaghawry","gameTag":"7258"},...]}` — 12 friends | **YES (friends)** |
| 25 | `/social/v2/friends` | GET | – | 200 | same shape as above | **YES (friends)** |
| 26 | `/social/v1/friends/requests`, `/social/v1/parties` | GET | – | 404 | `Invalid URI format` | NO |
| 27 | `/player-account/v1/accounts/me`, `/lol-summoner/v1/current-summoner`, `/lol-chat/v1/me`, `/chat/...` variants | GET | – | 404 | `Invalid URI format` | NO |
| R1 | `https://pd.eu.a.pvp.net/name-service/v2/players` | PUT | `["29bf3c62-...","5006c54f-...","b4c9958a-...","2ef28c39-..."]` | 200 | `[{"DisplayName":"","Subject":"29bf3c62-...","GameName":"lil ga7ed","TagLine":"zngr"},{"Subject":"5006c54f-...","GameName":"Mist","TagLine":"acen"},{"Subject":"b4c9958a-...","GameName":"Rift","TagLine":"x11"},{"Subject":"2ef28c39-...","GameName":"AboHaMaDa","TagLine":"6611"}]` | **YES** |
| R2 | `pd.{eu,na,ap}.a.pvp.net/name-service/v3/players` | PUT / POST | array or `{"subjects":[...]}` | 401 | `{"httpStatus":401,"errorCode":"UNAUTHORIZED","message":"This request requires valid authentication"}` | NO |
| R3 | `pd.eu.a.pvp.net/match-details/v1/matches/{matchId}` | GET | – | 200 | 182,991 bytes; **all 10 `players[].gameName` and `.tagLine` are `""`** | NO |
| R4 | `pd.eu.a.pvp.net/match-history/v1/history/{puuid}?startIndex=0&endIndex=5` | GET | – | 200 | `{"Subject":"29bf3c62-...","Total":66,"History":[{"MatchID":"9b55efb3-...","QueueID":"swiftplay"},...]}` — MatchID/queue only | NO |
| L1 | `%LOCALAPPDATA%/VALORANT/Saved/Logs/ShooterGame.log` | grep | – | – | `URL: 185.40.64.1:7132/Game/Maps/Bonsai/Bonsai?Name=lil ga7ed ?SubjectBase64=MjliZjNjNjItOWY5Mi01YjU1LTgxODgtYTRlODhmMDRiOGVj#zngr` — **only the LOCAL user's** name; 1 unique pair | **YES (self only)** |
| L2 | Riot Client Logs dir | grep | – | – | no `gameName`/PUUID pairs found | NO |

## Conclusions

* **Best local PUUID→RiotID source: `/chat/v4/presences`** (any online friend/party member, keyed by `pid` = `<puuid>@<region>.pvp.net`) and **`/chat/v5/participants`** (explicit `puuid` + `game_name`/`game_tag`, includes party + DM correspondents).
* **`/social/v1/friends` (and v2)** maps friend PUUIDs → names directly with a `puuid` field.
* **`/rso-auth/v1/authorization/userinfo`** gives the *logged-in* account's name only.
* **The tactical API (`/parties`, `/pregame`, `/core-game`, `/match-history`) is NOT registered on this Riot Client build's local port** — every path returns 404 `Invalid URI format`. There is no second Riot local port.
* **`match-details` no longer exposes names** (all `gameName`/`tagLine` empty across all 10 players), confirming why `/name-service/v2/players` (remote, entitlements-authed) is still required.
* **ShooterGame.log gives the local user's own PUUID→name pair** (via `SubjectBase64`), nothing for other match players.
* The live game itself calls `PUT https://pd.eu.a.pvp.net/name-service/v2/players` (200) and `POST https://pd.eu.a.pvp.net/name-service/v3/players` (200 in-game, 401 from us).

### Recommended Recon implementation
1. Remote `PUT pd.{shard}.a.pvp.net/name-service/v2/players` with entitlement headers → canonical PUUID→RiotID for arbitrary PUUIDs (works, 200).
2. Local `GET /chat/v4/presences` + `GET /chat/v5/participants` → zero-cost enrichment for friends/party/DM participants *during and shortly after a match* (presences stay populated through MENUS and in-game states `matchPresenceData.…`).
3. Local `GET /social/v1/friends` → bulk friend mapping.
4. Do NOT rely on match-details for names.
