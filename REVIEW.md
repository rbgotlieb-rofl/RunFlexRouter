# RunFlex App Review — Product & Engineering

## What's Working Well
- **Smart route generation algorithm** — bearing-based circular loop generation with quality scoring (aspect ratio, separation, overlap detection)
- **Solid frontend architecture** — React + TanStack Query + Mapbox GL with responsive mobile/desktop layouts
- **Good map UX** — direction arrows, start/end flags, multi-route comparison, live run tracking
- **Comprehensive type system** — shared Zod schemas between client and server

---

## Prioritized Improvements

### P0 — Critical (Ship Blockers)

#### 1. No data persistence — everything is in-memory
`server/storage.ts` uses `MemStorage` with JavaScript `Map` objects. All routes, preferences, and user data vanish on server restart. Drizzle ORM + Neon PostgreSQL are configured but never connected. This must be wired up before any real usage.

#### 2. Mapbox token exposed to clients via `/api/config`
The token is sent directly to the browser. Anyone can extract it and abuse your Mapbox quota. Create a server-side proxy (e.g., `/api/directions`, `/api/geocode`) so the token never leaves the server.

#### 3. No authentication or user isolation
Passport is installed but unused. Without auth, there's no concept of "my routes" or "my preferences." Every user shares the same in-memory state.

### P1 — High Priority (Core Product Gaps)

#### 4. AI integration is declared but doesn't exist
The app is pitched as "AI-powered route generation" but uses zero AI. `OPENAI_API_KEY` is in `.env.example` but never referenced in code. The route generation is purely algorithmic (Mapbox Directions + geometry math). Either integrate AI for real (natural language route requests, personalized recommendations, terrain analysis) or stop claiming it.

#### 5. Hardcoded to London
`server/services/location-service.ts` has 59 hardcoded London locations and 100+ London postcodes. The geocoding fallback is London-specific. This needs to be generalized using Mapbox geocoding globally.

#### 6. No tests whatsoever
Zero unit, integration, or E2E tests. The route generation algorithm (`generateCircularRoute.ts`, 304 lines) has complex math that's especially fragile without tests — scoring thresholds, binary search convergence, distance tolerance bands.

#### 7. `server/routes.ts` is 1,034 lines — needs decomposition
This single file handles route generation for all modes (loop, A-to-B, duration, all), route naming, POI detection, distance validation, and API response formatting. Extract into focused services.

### P2 — Medium Priority (Quality & Reliability)

#### 8. No input validation or rate limiting on API
Query parameters are parsed without sanitization. No `express-rate-limit`. Someone could spam `/api/routes` and burn through your Mapbox quota.

#### 9. N+1 Mapbox API calls
Each generated route triggers separate reverse-geocode calls for naming. For "all" mode (10+ routes), that's 10+ sequential API calls. Batch or parallelize these.

#### 10. Duplicate code in route generation
Loop generation logic (Pass 1 and Pass 2) is nearly identical. POI detection is duplicated. Route naming logic appears twice. Extract shared functions.

#### 11. Magic numbers everywhere
`0.009 * ratio`, aspect ratio threshold `0.12` vs `0.22`, tolerance bands `±15%` to `±65%` — none documented. These are the core of the algorithm and should be named constants with comments explaining the rationale.

#### 12. Error handling is shallow
Mapbox API failures return `null` silently. The client gets generic "Error generating routes." No retry logic, no circuit breakers, no graceful degradation.

### P3 — Nice to Have (Polish)

#### 13. Sidebar navigation links are non-functional
History, Profile, Settings pages exist in the sidebar but go nowhere.

#### 14. Geolocation accuracy display is confusing
Shows "±5000m" for IP-based location (which is really ±5km). Units should be human-friendly.

#### 15. No route saving or history
Users can't save routes they like or see previously generated routes. This is a core product feature for a running app.

#### 16. Live run tracker has no persistence
If you close the browser mid-run, all tracking data is lost. No run history, no stats over time.

---

## Product Strategy Recommendation

The app tries to be everything at once (route generator, live tracker, social running app) without doing any one thing exceptionally well. Recommended approach:

1. **Nail the core loop first**: Generate great circular running routes from any location (not just London), save them, let users rate them
2. **Then add persistence**: User accounts, saved routes, run history
3. **Then add real AI**: Natural language ("find me a scenic 5k loop near a park"), learning from user preferences, smart route suggestions
4. **Then live tracking**: This is table stakes but lower priority than having routes worth running

The algorithmic route generation is the strongest part of this app — invest in making it world-class before expanding surface area.
