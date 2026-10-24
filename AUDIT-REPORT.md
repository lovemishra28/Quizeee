# Quizeee — Final project audit and pre-deployment review

Date: **2026-10-24**. Repository: `quizeee-frontend/`. Baseline: `bed4fb925245a40658494ba68c384991d6710530`.

Authorized remediation scope: **Local fixes first**, as confirmed during the audit. Database, credential-management, production-infrastructure, and history changes were not authorized.

## 1. Executive summary

### Final verdict: NOT READY FOR DEPLOYMENT

The workspace is substantially improved and its local verification is clean. The original unauthenticated static-result forgery is fixed; guest hosts are isolated; input/AI validation, failure recovery, responsive layouts, accessibility, build configuration, and image delivery were corrected.

Release-blocking work remains:

1. Revoke/rotate the **legacy shared host credential** and invalidate affected sessions. It remains in reachable history and old ignored development artifacts.
2. Verify revocation of a **historical NVIDIA API key** found in a reflog-only commit. It differs from the current local configured key; its validity and past publication are unknown.
3. Implement and verify server/database-owned **live grading, answer-key access controls, room authorization, and assessment deadlines**.
4. Verify **Supabase schema/RLS/grants/constraints, atomic persistence/idempotency, and durable deployment-wide abuse protection**.
5. Complete real **AI/email/Realtime/hosting/backup** verification and required product/privacy content.

### Final local evidence

- `npm test`: **37 passed, 0 failed**, including ten real-SDK/intercepted-transport Gemini contract tests added on continuation.
- `npm run lint`: **passed with 0 reported errors/warnings** (baseline: 60 errors, 29 warnings).
- `npm run typecheck`: **passed**.
- `npm run build`: **passed using the existing local environment**, restoring the workspace build after isolated browser testing. Compilation is not a connectivity check.
- `npm audit --json`: **0 known vulnerabilities** after targeted patches (baseline: 1 critical / 3 high package groups).
- Browser functional evidence: **44 passed / 1 failed** across the full run and focused follow-ups. The remaining failed case is late-live-join deadline synchronization.
- Final combined visual/accessibility matrix: **10 routes × 5 viewports = 50 checks**, all rendered HTTP 200; **0 measured horizontal/clipped-control overflows, 0 axe rule violations, 0 runtime exceptions** in those fixtures.
- Current production browser artifacts: **no detected private environment key values or hardcoded credentials**. Known public Supabase configuration is intentionally present.

These results use actual source and a real local production Next.js server with synthetic external services. They do not certify the unseen remote database policies or real service entitlements. The initial findings were documented in [AUDIT-INITIAL.md](./AUDIT-INITIAL.md) before application remediation.

## 2. Project architecture

### Technologies and structure

- **Next.js 16.4.3** App Router; **React/React DOM 19.2.8**; React Compiler; **TypeScript 5.9.3**.
- **Tailwind CSS 4.3.3**, Courier/Geist fonts, Lucide 1.46.0, Recharts 3.10.1.
- **Supabase JS 2.116.0** for browser authentication/database access/Realtime and server admin operations.
- `pdf-parse` 2.4.5 for Node PDF extraction; NVIDIA text completion and Gemini fallback/OCR/vision.
- Gemini now uses supported **`@google/genai` 2.31.0**. The unsupported legacy dependency was replaced on continuation; candidate selection and text/PDF/OCR interfaces are preserved.
- **Node ≥22.3.0** is now declared. Audited runtime: Node 22.20.0 / npm 11.9.0 on Windows.
- `src/app/`: ten page routes, root layout/styles, application error UI, new `/api/health` handler.
- `src/components/`: nine shared/feature components, including navigation, authentication, backgrounds/loaders, generation/review, roles, and footer.
- `src/actions/`: generation, instant host/guest creation, and static grading.
- `src/lib/server/`: server-only auth/admin clients, public error handling, bounded admission/locks.
- Shared validation/types/progress/return-path utilities and a portable Node regression suite were added.
- `public/`: existing brand/reference assets. Application assets were retained.

### Data flow and trust boundaries

1. Public topic/PDF/TXT → bounded Node extraction/generation → validated questions → isolated instant host account → live room.
2. Public live code/nickname → eligibility-checked server guest action → isolated student account → browser Supabase session and room presence.
3. Teacher dashboard → generation → human review → direct browser quiz/question writes → session/code → student responses → teacher analytics.
4. Static submission → browser supplies access token/answers → **server verifies user via Supabase Auth and derives identity** → official questions/eligibility checks → grading/write.
5. Live questions/scores still use browser reads and client-computed grading fields. This is an unresolved production trust boundary, not protected by a hidden UI control.

Inferred database tables are `profiles`, `quizzes`, `questions`, `quiz_sessions`, and `submissions`. Their physical schema, relationships, triggers, grants, and policies were not supplied. Regular signup depends on a profile-creation trigger/configuration that must be verified.

The parent `Quizeee masterdox.pdf` and `design.md` were read as specifications. The current implemented brand is peach/orange/Courier; older example indigo/dark-projector guidance was not used to redesign it.

## 3. Security audit

### Credentials and repository exposure

- **Shared host credential:** confirmed in baseline `src/actions/instantQuiz.ts:16`, host client page `:78`, reachable commit `bed4fb925245`, and the original production browser chunk. Current code no longer embeds/distributes this shared identity. Existing account/session validity and revocation are **unverified**.
- **Historical NVIDIA key:** confirmed at `src/lib/ai/config.ts:19` in reflog-only commit `b9281c3d73f40b1228c70bcd5fb6a6b8bb0a4b30`. It is **not reachable from current branch/remote-tracking refs** and **does not match the current `.env.local` NVIDIA key**. This does not prove it was revoked or never published. The old key requires revocation verification.
- Real `.env.local` credentials remain ignored. The template has empty server secrets and public placeholders only.
- The final real-environment production static scan detected **no private key values** in `.next/static/`. Public Supabase URL/anon key exposure is expected; the local JWT anon role was checked offline.
- Old ignored `.next/dev/` chunks/maps still contain historical credential material; ignored caches also contain private AI environment values. They must remain excluded from repositories, uploads, and project archives. They were not deleted during this audit.

All credential values in reports/scans are redacted. No live credential validation/revocation was performed.

### Authentication, authorization, validation

**Fixed and verified locally:**

- Static grading rejects missing/invalid authentication, teacher tokens, wrong quiz/session types, closed schedules, unknown questions, invalid choices, and sequential replays.
- A valid token controls the recorded student ID; a supplied `userId` or score cannot override grading.
- Actual unauthenticated HTTP action forgery now performs **zero writes** in the isolated backend.
- Host/detail UIs verify authenticated teacher role and ownership before loading room data. The initialization cache is user-scoped and cancels subscriptions after unmount.
- Instant host accounts/credentials are unique; guest roles are server-selected; nickname/code/question/timer bounds are checked before privileged operations.
- Generation bounds count/text/file/type/page size; strict AI parsing rejects fabricated defaults and invalid answers; public errors omit raw provider/database details.

**Unresolved:**

- Students receive answer-key fields, and live inserts still contain client-computed correctness/score/response time. Required server/database authority is not implemented.
- Database-side ownership, profile-role protection, private analytics access, guest room membership, safe question DTOs/column grants, and Realtime broadcast authorization cannot be verified from client checks.
- Per-instance locks/admission guards do not establish database uniqueness or distributed quotas.
- Browser token storage remains the existing Supabase local/session-storage architecture. Remember-me and logout work in local tests; real token expiry/refresh/revocation, cross-browser behavior, and production session settings require staging checks.

### Other application-security checks

- No raw SQL/command execution/eval/dangerous HTML sink was found in application source. Quiz IDs/choices and privileged requests are now validated; database requests use the SDK. No confirmed SQL/command injection was identified.
- An HTML-shaped nickname was tested and rendered as literal text; no injected DOM image was created. This is specific evidence, not an exhaustive XSS certification.
- A foreign `Origin` with a valid synthetic token was rejected by the actual Next.js Server Action handler before writes. Default same-origin action checking remains configured.
- Arbitrary remote image optimization was rejected without fetching the fixture service. Known Next.js/sharp advisories were patched; exploit payloads were not executed.
- CSP/frame/nosniff/referrer/permissions/HSTS headers were tested; framework identification was removed. CSP still permits inline hydration/styles. It is not a nonce-based strict XSS policy.
- Uploads are parsed in memory, not written to arbitrary filesystem paths. PDF signature/type/page checks, parser disposal, and processing timeout were added.
- Supabase CORS/allowed origins, external auth/anti-abuse settings, HTTPS ingress, and actual database policies remain unverified.

## 4. Git and repository review

### State and history

- Initial working tree/staging were clean on `main...origin/main`; current changes are unstaged workspace remediation/documentation/tests.
- HEAD and remote-tracking refs were not changed. The baseline reachable history has 20 commits. Expanding to reflogs found **21 commits / 124 unique blobs**, including the historical NVIDIA key.
- Local remote configuration uses HTTPS with **no embedded credentials detected**. Remote URL/project identifiers were redacted.
- Staged changes remain empty. No commit, push, publish, deployment, history rewrite, remote/config change, or application asset/source-file deletion was performed.
- `git diff --check` passed; Windows LF/CRLF notices reflect existing Git line-ending behavior, not a failed build/test.

Executed repository evidence commands:

- `git status --short --branch`, `git diff --stat`, `git diff --cached --stat`: baseline clean; final intended remediation is unstaged and staging remains empty.
- `node C:/Users/mishr/AppData/Local/Temp/opencode/quizeee-audit-scan.cjs <repository>`: working tree/environment metadata, artifacts and Git blobs scanned with values redacted. **Current source/production-browser checks clean; historical/dev-copy credential checks failed.** Final history scope includes reflogs.
- `node C:/Users/mishr/AppData/Local/Temp/opencode/quizeee-audit-inspect.cjs git-metadata`: no embedded local remote credential detected; identifies the additional reflog-only commit.
- `node C:/Users/mishr/AppData/Local/Temp/opencode/quizeee-audit-inspect.cjs historical-key-check`: verifies old NVIDIA token differs from current local configuration and is absent from current refs, without printing either token. Provider validity/revocation remains **not run**.
- `git diff --check`: no whitespace-error failure. Review diffs were redacted before display.

### Files suitable for an intended commit after review

- Reviewed `src/**` application changes and new server/validation/types/progress/error/health utilities.
- `package.json`, `package-lock.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`.
- `.env.example` **in its current placeholder-only form**.
- `tests/**` synthetic service fixtures and Node regression tests.
- `README.md`, `AUDIT-INITIAL.md`, `AUDIT-REPORT.md`; review whether detailed security findings should be published with the repository.
- Existing intended public brand assets. No newly added large assets are required.

### Exclude

- `.env.local`, real environment variants, private keys/certificates, local databases and logs.
- `.next/` (including old credential-containing dev/cache files), `node_modules/`, generated type/build-info files, build/coverage/test output.
- Temporary audit tools, browser output/screenshots/logs, and local editor/deployment state.

`.gitignore` now allows `.env.example` explicitly and covers local key/database/log/browser-test output patterns. Ignore rules do not remove secrets already in history. An ordinary current-branch push does not include the reflog-only NVIDIA commit, but the reachable host credential remains in branch history and revocation is still required.

### Further owner review

Legacy host account/sessions/quizzes; old NVIDIA key revocation; any past publication/forks/archives; sensitive report publication; unreferenced/reference assets; real contact/legal/social content; and the parent specification PDF (outside this Git repository).

## 5. UI/UX, theming, responsiveness, accessibility

Every main route was rendered at **375×812, 768×1024, 1024×768, 1366×900, and 1920×1080**. Final results combine the full run with focused reruns of changed views. Full-page landing screenshots include instant forms, role cards, feature ticker, and footer; active/result/review and a real Chrome calendar popup were also inspected.

- **Landing:** retained hero/circuit identity; optimized images; heading/main structure; role CTAs; accessible ticker pause/reduced-motion behavior; below-fold cards tested at all sizes; mobile nav no longer squeezes the brand or strands signup.
- **Auth:** mobile form is visible without the large desktop illustration; labels/password reveal/role states/feedback are accessible; confirmation/recovery/reset/return paths work with local API fixtures. Desktop split branding is retained.
- **Teacher dashboard/creator:** mobile date/schedule/mode controls wrap; quiz links work by keyboard; review fields/radios are named; empty/invalid save is rejected; save failure is visible; creation feedback and cleanup are tested.
- **Student dashboard:** digit input/loading/error feedback, history/review, readable count badge, and bounded/truncated titles. The final badge contrast fix was rechecked.
- **Teacher quiz details:** role/owner gating, heading hierarchy, keyboard-focusable question/performance scroll regions, retained answer/performance panels.
- **Analytics index:** title containers/badges fit mobile; distinct same-title quizzes remain listed by ID; failure feedback is explicit.
- **Analytics detail:** chart has its own bounded flex area; no card-bottom overflow; accessible accuracy text accompanies the chart; semantic color/font consistency is retained.
- **Host:** code card fits mobile, projector/laptop title/code hierarchy remains strong, presence/start/state/error/read-only behavior tested, and late async subscriptions cancel.
- **Live student:** named nickname controls, waiting/feedback/result states, answer-in-flight/failure handling, zero-time state, keyboard controls and responsive header; grading/timing integrity remains a backend blocker.
- **Static:** intro/teacher refusal/answer selection/previous-next/submission/review/zero-question/error/refresh progress tested. Local deadline persistence improves UX, not anti-tampering security.

Final main-route matrix: **0 measured overflow/clipped controls, 0 broken requested images, 0 axe violations, 0 runtime exceptions**. Baseline had three mobile overflows and 100 page/viewport violations across eight axe rule IDs. The first post-fix run caught one remaining title overflow/four badge contrast violations; targeted reruns resolved them.

Zero automated violations is not a complete WCAG certification. Manual screen-reader review, all conditional-state contrast, additional browsers, and real-device behavior remain unverified. Native Chrome calendar opening and Escape were observed; other platform-native picker UIs were not tested.

## 6. Functional testing report and evidence

### Browser checks — latest combined outcome: 44 passed / 1 failed

**Passed with executed browser/HTTP evidence:**

- Student signup default; invalid-login feedback; login return path; reveal/conceal password; remember-me persistence, refresh, logout.
- Confirmation-required signup; recovery form; local recovery email request; authenticated local reset API and session/URL cleanup.
- Six-digit instant validation; static/competitive code routing; instant creation and guest join; literal nickname rendering; guest return-home/signup.
- Static browser schedule refusal; anonymous protected-route handling; student host refusal; teacher static refusal.
- Real valid PDF extraction/local AI generation → review/edit/add/delete → save; invalid-window/preset/duration controls; native calendar trigger.
- Failed question-save cleanup/visible error; zero-question-save refusal.
- Static select/previous-next/server grade/completion; unauthenticated direct action refusal; foreign-Origin refusal; refresh progress; mobile navigation; zero-question fallback; failed zero-time auto-submit without a retry loop; session-scoped review.
- Two-question host/student presence/broadcast/answer/final leaderboard flow; live insert failure feedback.
- Actual keyboard quiz-link activation; analytics chart containment; distinct same-title session listing; network-failure feedback.
- Nested HTTP 404; health/header checks; private repository/source paths return 404; arbitrary remote image optimization rejected.
- Below-fold/image loading and five-size screenshots; reduced motion and keyboard ticker pause; local paint/resource observations.

**Failed / release-blocking — late-live-join deadline:**

- Reproduce: start/mark a live session active at question 0, then join in a fresh student browser with no saved question end-time.
- Expected: student receives the host's existing remaining time.
- Actual: the client creates a fresh local deadline from its join time. In the executed three-second fixture, a new approximately two-second remaining countdown was recorded after page loading.
- Cause: start/end time is not persisted/consumed authoritatively; current database update only supplies state/index and host time is transient broadcast/local storage.
- Required fix: server-owned persisted timestamps and grading enforcement, then multi-client/late-join/refresh/clock-edit/reconnect testing in staging.

### Commands and result provenance

Temporary tool directory: `C:/Users/mishr/AppData/Local/Temp/opencode/quizeee-audit-tools/`.

- `node <tools>/check.cjs build`: passed production compilation with isolated local Supabase/AI configuration.
- `node <tools>/browser-audit.cjs baseline`: executed 40 initial route/viewport checks.
- `node <tools>/browser-audit.cjs baseline-verified functional`: 13 passed / 19 failed, after correcting a test race and incomplete synthetic Realtime payload. Harness errors were excluded from findings.
- `node <tools>/browser-audit.cjs post-fix`: 41 passed / 1 failed; 50 render/axe checks; remaining visual issues subsequently fixed.
- `node <tools>/browser-audit.cjs final-targeted targeted`: 5 passed, 20 affected render/axe checks, 0 violations/overflows/exceptions.
- `node <tools>/browser-audit.cjs controls-verification controls`: 3 passed (teacher refusal, scheduling/validation, real native calendar trigger).
- `node <tools>/browser-audit.cjs navigation-verification navigation`: 2 final mobile renders/axe checks, 0 violations/overflows/exceptions.
- `node <tools>/merge-evidence.cjs`: merged latest per-test and route/viewport evidence; **not an additional test run**.
- `node <tools>/server-probes.cjs baseline`: 20 targeted boundary requirements exposed missing baseline controls.
- `node <tools>/server-probes.cjs phase-a`: 20 passed after initial security remediation; the permanent suite at that phase verified 27 cases including positive paths (current suite: 37 after continuation).

Continuation verification: `node --test tests/gemini.test.cjs` passed **10/10** actual-SDK/intercepted-fetch tests; the subsequent `npm test` passed **37/37**. Cases cover text JSON/response.text, exact inline PDF bytes, plain OCR, Developer-API selection, timeout/auth-header/abort settings, one-attempt fallback, malformed output, deduplication/sanitized errors, disabled automatic continuation, missing credentials, and short OCR fallback. Real Google services were not called. The earlier 27-case result remains valid baseline evidence; 37 is the current suite size.

Evidence JSON (each test includes expected/actual/status), screenshots, contact sheets, and redacted server logs are in the named run directories. Final merged source is `final-combined-browser/results.json`. Screenshots use synthetic data. Chrome: **156.0.8078.47**, Windows headless, production Next.js. Temporary tools are not production dependencies.

**Blocked/not run:** real Supabase Auth/RLS/constraints/concurrency, real AI/model entitlement/semantic quality/scanned-PDF generation, real SMTP/recovery/expiry/refresh/revocation, inactive Google OAuth, production hosting/HTTPS/origins/backups, non-Chrome/mobile-browser/screen-reader checks. No production data was used for destructive testing.

## 7. API, backend and data-flow review

- Server Actions remain the backend entry points; UI route checks are not their authorization boundary.
- Static action (`src/actions/submitStaticQuiz.ts:15`) now verifies tokens through server `requireUser` (`src/lib/server/supabase.ts:25`), reads the student's stored role, validates quiz/session/window/questions/choices, derives `student_id`, and calculates official grade.
- Guest create/join are public by intended product design. They now use crypto-generated unique identities/credentials, validation, eligible competitive sessions, checked profile creation, masked errors, and admission guards.
- Text/PDF ingestion handles advertised TXT files, validates PDFs, caps processing, disposes workers, validates model structures, and omits raw content from logs. Provider retries/models are deduplicated/bounded; external contracts were verified only through doubles.
- Current live student question fetch (`:79–83`) and grading (`:369` onward) still require answer-key fields and client score/timing. Static page question fetch (`:152`) also receives keys. Safe DTO/column grants/after-submission review must be coordinated with actual backend schema.
- Session/index writes and public room broadcasts must be authorized and made authoritative. Account creation alone does not prove room membership or private analytics access.
- Existing check-then-insert/in-process locks and compensating quiz cleanup require database transactions/uniqueness and uncertain-network reconciliation before production.
- Analytics currently aggregates stored submissions. Missing-answer denominators, zero-response participants, large result pagination/caps, and legacy duplicate attempts require representative staging data and the agreed attempt/cohort model.
- CORS, actual schema relationships/default timers, Auth profile trigger, Realtime publication/filter/private policy, migrations, and deployment credentials were not remotely verified.

## 8. Performance review

### Measured improvement: logo delivery

Fresh local homepage observation, 1366×900, headless Chrome, unthrottled network/CPU, single run:

- Baseline eagerly loaded hero/nav/footer logos: **1,619,425 encoded bytes**.
- Post-fix hero: **35,288 bytes**; nav: **2,006 bytes**; footer deferred outside the initial viewport.
- Initial observed logo transfer: **37,294 bytes**, approximately **97.7% lower**, including the benefit of footer deferral. Hero/nav payloads themselves are approximately 93.5%/99.6% lower.
- Baseline observed LCP/FCP: 208/196 ms; post-fix: 140/140 ms; observed CLS: 0 in both. These are local single-run observations, not production/field Core Web Vitals or an INP certification.

Responsive `next/image` delivery/intrinsic dimensions/lazy loading were applied; original brand assets retained. Unused Geist Mono loading and unused direct clsx/tailwind-merge declarations were removed (clsx remains if required transitively).

### Other work and outstanding profiling

- PDF workers are disposed with processing bounds; Supabase/AI requests have timeouts; host cleanup and generation concurrency are bounded.
- Analytics duplicate filtering uses a linear quiz-ID set instead of nested title comparisons.
- Current largest production JS chunk: approximately **364,286 bytes / 104,529 gzip bytes**; main shared chunks remain framework/library sized. Route splitting is present; no unsupported bundle-size reduction claim is made.
- Student live rooms still poll every two seconds as a fallback and can duplicate event-driven reads. Review high-volume request/load and subscription behavior in staging before tuning recovery reliability.
- Animated SVG/blur/backdrop performance, large histories/pagination, memory/load profiling, mobile CPU/INP, caching policies, and production vitals were not comprehensively profiled. No fabricated load/latency metric is reported.

## 9. Build and dependency report

### Executed final checks

- `npm run lint`: **PASS**, no reported warnings/errors.
- `npm run typecheck`: **PASS** (`tsc --noEmit --incremental false`).
- `npm test`: **PASS**, 37 tests, no skipped/cancelled/failing cases.
- `npm run build`: **PASS**, Next.js 16.4.3, ten pages plus `/api/health`, with existing `.env.local` restored. Latest warm build compilation 3.6 s / TypeScript 7.4 s after the Gemini migration; warm cache time is not a clean-CI benchmark.
- `npm audit --json`: **PASS**, 0 advisory package groups at scan time. Initial production-only audit had three groups; all four full-audit groups were patched.
- `npm ls next sharp source-map-js brace-expansion @types/node`: **PASS**, confirms patched resolved versions.
- `git diff --check`: **PASS**, only existing LF/CRLF notices.
- Canvas SDK TypeScript check: **PASS** for the accompanying audit board.

### Targeted version changes

- Next.js / eslint-config-next: **16.3.5 → 16.4.3**.
- sharp: **0.35.4 → 0.35.5**.
- source-map-js: **1.2.1 → 1.2.2**.
- brace-expansion: **1.1.18 → 1.1.21** and **5.0.9 → 5.0.12**.
- Node types: **20 → 22.20.5**; declared Node engine ≥22.3.
- Unused direct clsx/tailwind-merge declarations removed; lock synchronized.
- Unsupported `@google/generative-ai` 0.24.1 replaced with **`@google/genai` 2.31.0** after checking official versioned SDK documentation and Node compatibility. Explicit Developer API, 60-second abort/timeout, single HTTP attempt per model and disabled automatic continuation preserve the existing bounded behavior.
- An additional **dev-only Zod** advisory appeared during continuation (`GHSA-mrhx-c7xc-m3w5`); resolved **4.6.5 → 4.6.7** within its existing compatible 4.x range. Final npm audit is again zero.

React/Supabase/icons/TypeScript were not blindly upgraded. The old Google SDK's end of support was confirmed from its README, then resolved by a focused supported-SDK replacement. Its real model entitlements and generated text/OCR/vision quality remain unverified. The new SDK's optional MCP peer is not installed or used. A `node-domexception` deprecation notice is inherited through its Google-auth/node-fetch dependency chain; no advisory is reported for that helper, and an unreviewed transitive breaking override was not introduced.

After the new SDK build, the targeted real-environment client scan checked **38 production static files against four known private credential values**, finding **zero matches**. Existing history/reflog revocation gates are unchanged.

One Windows npm cleanup EPERM notice occurred for an ignored old native SWC directory. Subsequent dependency resolution, builds, tests, lint and type checks passed; no application file/history was removed to work around it. A clean Linux-host install/runtime and production resource settings remain deployment verification tasks.

## 10. Deployment readiness checklist

**Verified locally:**

- [x] Source/route/config/dependency inventory and major flow traces.
- [x] Current committable source/template redacting scan; real private values not detected in current production browser assets.
- [x] Placeholder-only env template and practical ignores.
- [x] Compatible Node declaration and successful production compilation.
- [x] Lint/type/unit/browser regression checks with recorded limits.
- [x] Main-route responsive/axe verification, native calendar observation, functional error/progress handling.
- [x] Basic process/configuration probe and tested hardening headers.

**Required before launch:**

- [ ] Legacy host credential/session revocation; old NVIDIA key revocation verification.
- [ ] Sanitized schema/migrations/RLS/grants/constraints/Auth triggers versioned and staging-tested.
- [ ] Safe student question/review access; authoritative live grading; host/room/Realtime membership/broadcast controls.
- [ ] Persisted server deadlines and tamper/late-join/refresh/reconnect/multi-client verification.
- [ ] Atomic saves/submissions, unique room/attempt keys, parallel idempotency/retry and legacy-data reconciliation.
- [ ] Durable quotas/rate limits and trusted ingress headers, appropriate school/NAT/instance capacity.
- [x] Supported Gemini SDK migration and bounded text/PDF/OCR SDK contracts verified with intercepted transport.
- [ ] Real AI text/visual model access/output and provider quotas/timeouts/billing limits.
- [ ] Real signup/profile creation, confirmation/recovery email, callback allowlists and session lifecycle checks.
- [ ] HTTPS/public-host forwarding, actual Supabase origins/CORS/Realtime configuration and hosting resource limits.
- [ ] Monitored upstream health/errors, backups and a successful isolated restore, rollback/runbook.
- [ ] Privacy/terms/about/contact/social content and an agreed launch scope for missing BYOK/advanced diagnostic features.
- [ ] Additional-browser/device/manual accessibility and production/load performance checks appropriate to launch risk.

`/api/health` 200 means process/configuration checks passed; it does not mark these upstream requirements complete. No deployment or production infrastructure action occurred.

## 11. Prioritized issue register — final disposition

Status definitions: **Fixed locally** = source change and relevant local evidence resolve the original local defect; **Partial** = local improvement with a release gate remaining; **Open** = unresolved implementation/revocation; **Verification required** = unseen remote control, not a fabricated confirmed exploit. Baseline exact steps/locations are preserved in `AUDIT-INITIAL.md`; current evidence and release effect follow.

### Critical

**QZ-001 — Shared host credential/history exposure · P0 · Security/repository · PARTIAL · BLOCKS.** Affected baseline action/client/history and old dev artifacts (`instantQuiz.ts:16`, host page `:78`, commit `bed4fb925245`). Original guest creations returned one reusable identity and browsers embedded its password. Impact: shared teacher access/legacy data compromise if valid. Fix: unique crypto guest hosts and owner checks; tests verify different accounts/credentials. Current production scan finds none. **Owner must revoke/rotate the legacy credential and sessions; history/dev copies remain.** No live validity test was made.

**QZ-033 — Historical NVIDIA API key · P0 · Secrets/repository · OPEN · BLOCKS REVOCATION VERIFICATION.** Affected `src/lib/ai/config.ts:19 @ b9281c3d73f4`, recovered only via reflog. Evidence: expanded 21-commit/124-blob scan identifies an NVIDIA key; offline comparison differs from current configured key; no current ref contains that commit. Impact: possible historical provider use/quota/billing exposure while valid. Required fix: verify/revoke the **old** key, review past publication/archives, and authorize any history remediation separately. Current-key difference is not revocation proof; provider validity/past exposure were not tested.

**QZ-002 — Unauthenticated static identity/grade forgery · P0 · Authorization · FIXED LOCALLY.** Affected `src/actions/submitStaticQuiz.ts:15`, new server auth helper `:25`. Baseline direct HTTP action wrote two other-student results; now zero writes without a token. Verified token controls identity/official grade; role/type/session/window/choice validation added. Native/HTTP tests pass. Impact was unauthorized results/data corruption. Remaining database-wide authorization is QZ-006, not claimed solved by UI.

### High

**QZ-003 — Browser answer keys/live score authority · P1 · Assessment security · OPEN · BLOCKS.** Affected live student `:79–83, :369` onward and static question fetch `:152`. Source/fixtures require correct indexes and submit client correctness/score/time. Impact: cheating/forged leaderboard and grade integrity. Required fix: authenticated authoritative grading, safe DTO/column/review access, denied client grading writes, tested RLS/RPC policy. Database authorization is required; hiding an input does not resolve it.

**QZ-004 — Client-owned/non-durable assessment time · P1 · Integrity/functionality · PARTIAL · BLOCKS.** Affected static progress/timer and live host/student end-time handling. Baseline refresh reset static answers/time; now scoped local progress/absolute countdown and guarded timeout retry pass browser tests. Late-live-join still creates a fresh countdown; browser clock/storage remain editable. Impact: unequal/tampered timing and missed results. Required fix: server-owned persisted attempt/question deadlines and grading enforcement, then late-join/reconnect/clock-edit tests.

**QZ-005 — Unbounded public expensive/privileged admission · P1 · Abuse/resource protection · PARTIAL · BLOCKS.** Affected generation action `:10, :35`, instant actions `:38/:81`, config and server rate helper. Baseline probe accepted 100,000 questions; no size/quota/time limits. Input/body/page/text/model/request/concurrency and per-instance address guards now exist and are tested. Impact: resource/account/provider abuse. Required fix: durable deployment-wide quotas, trusted forwarded headers, account lifecycle and capacity verification. Local counters reset and can be bypassed across instances/untrusted ingress.

**QZ-006 — Database/RLS/grants/Realtime/trigger controls unseen · P1 · Deployment-security gate · VERIFICATION REQUIRED · BLOCKS.** Affected all browser/admin data flows; no supplied SQL/migrations. Impact if misconfigured: foreign-owner/private analytics/answer-key access, role or grading writes, forged broadcasts. Evidence is absent policy artifacts and source reliance, not an asserted remote exploit. Required fix: sanitized export, authorized staging migrations/tests for anonymous/student/teacher/foreign-owner and guest membership/private broadcasts; version the proven controls.

**QZ-007 — Known package advisories · P1 · Dependencies · FIXED LOCALLY.** Affected old Next/sharp/source-map/brace versions. Evidence: executed npm advisory scans and reviewed applicable Next Server Action DoS/Linux SVG conditions. Targeted compatible patches resolve all known package groups; npm audit 0 and builds/checks pass. Impact was published security exposure; no destructive exploit ran. Reference advisories and original ranges are in the initial report.

**QZ-008 — Orphaned save/hidden error/atomicity · P1 · Data integrity · PARTIAL · BLOCKS DATABASE ATOMICITY.** Affected `QuizCreator.tsx` and instant creation sequence. Baseline failed child insert left a parent and invisible review error. Validation, visible status, in-flight/success guards and compensating cleanup are tested; instant session failure also cleans newly created quiz/questions. Impact: unusable/duplicate/orphan data. Required fix: verified transactions/RPCs/uncertain-network reconciliation and guest-account lifecycle; compensating cleanup is not a cross-service transaction.

**QZ-009 — Fabricated/malformed quiz data · P1 · Validation/assessment quality · FIXED LOCALLY.** Affected AI parser, shared validator, review/instant create. Baseline accepted empty/fractional/missing answer data and empty saved quizzes. Now strict count/text/four-distinct-options/index validation rejects malformed output/content before writes; native and browser cases pass. Impact: incorrect/unusable assessments. Real model factual quality still requires human review and production-service verification.

**QZ-010 — Failed live answer appears accepted · P1 · Core functionality · FIXED LOCALLY.** Affected live student submission handler. Baseline set feedback first and ignored insert error. In-flight guard, verified-current-user check, checked write/feedback, error/deadline state and stale-question guard added; simulated write failure and normal game pass. Impact: lost responses/false success. Authoritative scores/deadlines remain QZ-003/004.

**QZ-011 — Confirmation-required signup falsely navigates · P1 · Authentication · FIXED LOCALLY.** Affected AuthForm signup. Baseline user-without-session cached/redirected without instructions. Session-aware navigation/confirmation feedback now passes executed simulated signup. Impact: broken registration. Real SMTP/profile trigger/callback/session delivery remains the production-service gate.

**QZ-012 — Replay/idempotency model absent · P1 · Data integrity · PARTIAL · BLOCKS DATABASE UNIQUENESS.** Affected static action and analytics/history. Baseline sequential replay inserted duplicates/new sessions. Eligibility/session reuse, prior-result check and in-instance lock pass sequential tests. Impact: duplicate/overcounted grades. Required fix: atomic database attempt/uniqueness/idempotency/collision rules and concurrent/legacy-data verification; check-then-insert is not sufficient across instances.

### Medium

**QZ-013 — Incomplete teacher/host access UI · P2 · Access UX/defense in depth · FIXED LOCALLY.** Affected detail/host initializers. Baseline anonymous detail and student-host views rendered with permissive fixture data. Authenticated teacher/owner checks and user-scoped initialization now reject these browser cases. Impact: misleading/inappropriate access and unsafe flow. Actual backend authorization remains QZ-006.

**QZ-014 — Role/return-path ignored · P2 · Routing · FIXED LOCALLY.** Affected Auth page/form and live login links. Baseline Student CTA selected Teacher and login lost room. Valid role defaults/internal return allowlist now work; unit tests reject external, encoded/backslash, auth-loop destinations. Impact: wrong-role registration/user friction; no remaining local blocker.

**QZ-015 — Decorative recovery · P2 · Authentication UX · FIXED LOCALLY.** Affected old Forgot Password `#`. Request/reset forms, accessible feedback, password checks, token/user verification, API call/signout/clean URL are executed with fixtures. Impact: inability to recover accounts. Real email/link expiry/session recovery is still unverified before launch.

**QZ-016 — Review mixes sessions · P2 · Data correctness · FIXED LOCALLY.** Affected static review query. Baseline other-session rows overwrote selected attempt; query now requires/scopes requested session plus authenticated student and rejects no submitted review. Browser two-session reproduction passes. Impact: wrong displayed scores/answers; actual RLS/review-release policy remains QZ-006.

**QZ-017 — Responsive clipping/brand/navigation · P2 · UI · FIXED LOCALLY.** Affected nav/creator/date fields/cards/analytics/code/auth/role layout. Baseline 375 px views reached 423/391/426 px widths. Wrapping/shrinkable fields/adaptive code/title/card sizing and compact public nav applied; final 50-case matrix has no measured overflows/clipped controls and full-page visuals were inspected. Impact: inaccessible controls/confusing/clipped layout; additional-device testing is a limitation.

**QZ-018 — Labels/semantics/keyboard/status gaps · P2 · Accessibility · FIXED IN TESTED LOCAL SCOPE.** Affected shared forms/nav/loading/cards/headings/scroll areas. Evidence: baseline axe/keyboard failures. Native links/buttons, names/pressed/current states, main/heading structure, skip/focus/status treatment and scroll-region access now pass main-route axe/keyboard tests. Impact: assistive/keyboard exclusion. Manual screen readers/all conditional states remain unverified; no blanket WCAG certification.

**QZ-019 — Contrast failures · P2 · Accessibility/theme · FIXED IN TESTED LOCAL SCOPE.** Affected white-on-orange, orange/muted text and history badge. Baseline 3.09:1 white/orange and 2.87:1 orange/peach; accessible ink/muted aliases/dark button/badge text added while fills remain orange. Final badge rerun and route axe checks show 0 violations. Impact: unreadable labels/data. Disabled controls were not misclassified as critical security flaws.

**QZ-020 — Chart/card overlap · P2 · Visual layout · FIXED LOCALLY.** Affected analytics chart. Baseline chart extended 35 px below its card. Separate flex/min-height chart area and accessible topic text added; actual DOM card/plot bounds and visuals pass. Impact: clipped/overlapping chart; no local blocker.

**QZ-021 — Same-title quiz disappearance · P2 · Filtering/performance · FIXED LOCALLY.** Affected analytics session filtering. Baseline title comparison hid a different quiz. `quiz_id` selection/set filtering now retains distinct same-title sessions in browser tests and removes nested title scanning. Impact: inaccessible/misleading analytics; no local blocker.

**QZ-022 — Raw material/provider/database logs/errors · P2 · Privacy · FIXED LOCALLY.** Affected generation/parsing/provider/admin catches and client logs. Baseline probes logged raw prompt/model output and source propagated raw upstream bodies. Now safe validation/operational codes, masked action errors and static client failures; logging probes pass. Impact: private material/upstream leakage. Hosting log configuration and production monitoring still require owner verification.

**QZ-023 — TXT/parser/request lifecycle · P2 · Integration/resources · FIXED LOCALLY.** Affected advertised TXT path, PDF parser and provider/Supabase calls. TXT uses original text; PDF validates/disposes/caps extraction; model/Supabase calls bounded; candidate models deduplicated. Native boundary and real readable-PDF/local-AI browser flow pass. Impact: failed ingestion/resource waits/leaks. External visual-model correctness is a separate unverified integration.

**QZ-024 — Static-analysis/type/lifecycle failures · P2 · Maintainability · FIXED LOCALLY.** Affected original 60 lint errors/29 warnings. Shared typed contracts/unknown handling, hook/ref/cache/ordering/cancellation fixes and Node tests/scripts added; no global lint suppression was used (CommonJS test require is explicitly allowed only for test files). Latest lint/type/build pass. Impact: hidden runtime/maintenance problems; database-generated types still require actual schema.

**QZ-025 — Oversized eager logos · P2 · Performance · FIXED LOCALLY.** Affected raw home/nav/footer/auth/role images. Responsive optimized dimensions/lazy delivery tested; observed initial logo bytes 1,619,425→37,294 (footer deferred). Impact: bandwidth/paint cost. Local metrics are not production vitals; original assets retained.

**QZ-026 — Placeholder destinations/product gaps · P2 · Product readiness · PARTIAL · OWNER/SCOPE GATE.** Affected footer and specification promises. Analytics destination corrected; fake `#`/generic social links represented honestly as unavailable; contact remains an owner-provided-address verification task. Docs/privacy/terms/about/social content and BYOK/advanced diagnostics/drilldown/time/common-wrong-answer features are absent. Impact: misleading/broken secondary UX and incomplete launch expectations. Obtain content/agree scope before enabling those promises; no policies or features were invented.

**QZ-027 — Unsupported Gemini SDK lifecycle · P2 · Integration maintenance · FIXED LOCALLY ON CONTINUATION.** Affected old Google SDK 0.24.1 and `src/lib/ai/gemini.ts`. Baseline README states support ended 2025-08-31. Replaced with pinned supported `@google/genai` 2.31.0; request API/config/response.text adapted while preserving text/PDF/OCR signatures and model fallback. Explicit Developer API, single HTTP attempts, disabled continuation and timeout/abort bounds prevent hidden request multiplication. Ten real-SDK/intercepted-fetch cases, full 37-case suite, lint/types/build and zero-advisory scan pass. Impact was unsupported API lifecycle. Real model access/quality remains the QZ-028 service-verification gate; no live provider credential was used.

**QZ-028 — Undocumented/unverified deployment operations · P2 · Operations · PARTIAL · OPERATIONAL GATE.** Affected starter docs/Node/env/health/production setup. Node/templates/runbook/check scripts/probe/headers are added and tested. Actual host/origins/resource limits/monitoring/email/AI/Realtime/backups/restore/migrations remain unverified. Impact: production startup/service/recovery failures. Follow README release gates with owner/staging evidence; health/configuration success alone is insufficient.

**QZ-030 — Continuous motion preference/pause · P2 · Accessibility · FIXED LOCALLY.** Affected backgrounds/SMIL/ticker/winner motion. Decorative reduced-motion treatment, static ticker wrapping and keyboard pause added; actual CSS/button/visual checks pass. Impact: motion discomfort/inaccessible hover-only pause; no remaining local blocker.

**QZ-031 — Async host subscription/cache lifecycle · P2 · Resources/defense in depth · FIXED LOCALLY.** Affected host cancellation and quiz-only init cache. Original cancellation flag never changed, permitting late subscriptions; cache reused across identity. Now cleanup/await checks and authenticated-user keys exist; build/lint/game/changed-view regressions pass. Original race was source-supported, not a measured production leak; runtime staging profiling remains optional follow-up.

**QZ-032 — Missing production header hardening · P2 · Defense in depth · FIXED LOCALLY.** Affected baseline `next.config.ts`/preserved header response. Missing frame/nosniff/CSP/referrer/permissions policy and framework identification were documented from baseline evidence during remediation. Headers now emitted, foreign-origin action and image-fetch/private-path checks executed. Impact: weaker browser defenses; strict nonce CSP and real HTTPS/proxy configuration need reviewed operational decisions, not an asserted current XSS exploit.

### Low

**QZ-029 — Unused assets/declarations/spec drift · P3 · Cleanup/documentation · PARTIAL · DOES NOT BLOCK.** Affected hash-identical logos, unused reference/flow/template files, old design examples, unused imports/font/direct deps. Unused direct dependencies/imports/font removed; original public reference assets retained per authorization. Candidates include `public/assets/logo.png`, `features-banner.png`, `flow-*`, `footer-brand/reference.png`, template SVGs. Impact: repository clutter, not measured runtime load for unreferenced files. Owner may approve cleanup/spec update; React DOM remains framework-required.

## 12. Remediation summary and next work

### Phase A — Security

Completed local auth/identity/guest isolation/runtime validation/dependency patch/log/header/admission controls. **Next:** owner revocation of both historical credential types; authorized schema/RLS/room/grading work; verified durable quotas. No history or external credentials were changed.

### Phase B — Functionality/deployment

Completed confirmation handling, visible save/submit failure, compensating cleanup, empty/malformed rejection, local progress/zero-time retry protection, correct review/filtering and setup/probe docs. **Next:** authoritative deadlines, atomic database attempt/saves/uniqueness, profile/Realtime/service/rollback verification.

### Phase C — UI/UX

Completed tested mobile/nav/date/card/chart layouts, labels/keyboard/focus/status/contrast/motion, recovery/role/return paths and honest secondary affordances. **Next:** real content, additional browsers/devices/manual assistive technology, remaining feature-scope decisions.

### Phase D — Performance/maintenance

Completed measured image delivery, font/direct-dependency cleanup, ID-set filtering, typed/hook/lifecycle/processing bounds, supported Gemini migration/bounded SDK contracts and meaningful regression tests. **Next:** real Gemini/model/vision service verification, representative load/vitals/pagination/analytics semantics, approved reference-asset cleanup.

Code and asset branding were preserved. The final normal build restored existing environment configuration; synthetic audit configuration is not left as the current production build. Relevant final checks were rerun after changes; unchanged flows retain their recorded full-run evidence and changed views have focused reruns.

## 13. Outstanding risks and limitations

- Real database/RLS/grants/constraints/triggers/private Realtime and parallel/legacy data behavior could not be inspected or tested. Obtain a sanitized export and isolated staging authorization; run the role/ownership/answer/deadline/idempotency matrix before release.
- Credential exposure is proven historically; validity, revocation and past publication are unverified. The old NVIDIA key differs locally but still requires provider-side revocation proof. No destructive/provider validation was run.
- Real SMTP/recovery/confirmation/expiry/refresh/OAuth and real AI/scanned PDFs/model entitlements/billing were not executed. Use dedicated staging accounts/material and approved provider quotas.
- Browser coverage is Chrome/Windows synthetic data; no manual screen readers, Safari/Firefox/mobile OS or full conditional-state certification.
- Performance is local single-run paint/resource measurement and static analysis; no field CWV/INP, comprehensive memory/load/backup/recovery or clean Linux-host runtime benchmark.
- Custom redacting secret scans cover known patterns/current env occurrences/reachable+reflog blobs/artifacts, not every possible unknown format or steganography. Current scan cleanliness is evidence, not a guarantee that no sensitive information can ever exist. Old ignored caches remain sensitive.
- Temporary browser tooling/evidence is outside Git; permanent Node regressions and this detailed report remain in the workspace. Preserve redacted evidence deliberately if needed for release records.

## 14. Final deployment verdict

**NOT READY FOR DEPLOYMENT.**

Local remediation and verification are complete within the authorized scope, including the continued Gemini migration, with 37 passing regressions, clean lint/types/build/dependency scans and tested main-route UI. Confirmed historical credentials require owner revocation verification, and high-priority assessment/database/abuse/atomicity controls remain unresolved or unverified. Production launch should wait for the listed release gates and their staging evidence.

No deployment, commit, push, publication, history rewrite, remote setting change, or production data operation was performed.
