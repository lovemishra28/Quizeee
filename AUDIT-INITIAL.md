# Quizeee — Initial pre-deployment audit

Audit date: 2026-10-24. Baseline commit: `bed4fb925245a40658494ba68c384991d6710530`.

**Initial verdict: NOT READY FOR DEPLOYMENT.** This document records the findings before application-code remediation. Consult `AUDIT-REPORT.md` for subsequent fixes and the final verdict.

## Executive summary

The product has functioning prototype flows and a coherent peach/orange/Courier visual identity, but its security boundaries and assessment integrity are not production-ready. Two critical findings are confirmed: a shared privileged host credential is distributed to browsers and exists in reachable Git history, and an unauthenticated static-grading Server Action accepts another student's identity and writes with the Supabase service role.

Local production compilation and TypeScript checking pass. ESLint fails with 60 errors and 29 warnings. The dependency audit identifies four vulnerable package groups, including critical Next.js advisories. All ten application routes rendered at mobile, tablet, laptop, and desktop sizes with synthetic data. Corrected browser functional checks passed 13 of 32 cases and failed 19; twenty targeted server-boundary probes exposed missing controls. These negative probes deliberately exercise security/data-validation requirements rather than represent twenty independent feature failures.

No configured production Supabase records, accounts, or AI services were mutated or used for these tests. The actual backend schema, RLS policies, constraints, service settings, backups, and paid AI availability remain unverified.

## Architecture and scope

- Repository: `quizeee-frontend/`; the parent folder also contains `Quizeee masterdox.pdf`, read as a product specification.
- Next.js 16.3.5 App Router; React/React DOM 19.2.8; React Compiler; TypeScript 5.9.3; Tailwind CSS 4.3.3; Lucide; Recharts 3.10.1.
- Browser Supabase client uses a custom localStorage/sessionStorage auth adapter and cached profile. Database requests are made directly from client pages and components.
- Three Server Action files handle generation, instant host/guest account creation, and static grading. The latter two use the service role and bypass RLS.
- AI dispatcher prefers NVIDIA, falls back to Gemini, and uses Gemini OCR/vision for scanned PDFs. PDF parsing runs in Node using `pdf-parse` 2.4.5.
- Inferred tables: `profiles`, `quizzes`, `questions`, `quiz_sessions`, `submissions`. No schema or policy definition is supplied.
- All 31 text source files, all configuration/documentation files, the asset inventory, installed dependency versions, local environment metadata, generated artifacts, and reachable Git history were inspected.
- No original test suite, CI configuration, database migrations, Route Handlers, custom error boundary, or deployment-specific configuration was found.

### Route coverage

- `/`: public landing page, instant generation/join, role links, feature ticker, footer.
- `/auth`: login, signup, role selection, password reveal, remember-me, placeholder recovery.
- `/dashboard/teacher`: PDF generation/review/save, schedule/duration presets, active/completed quizzes.
- `/dashboard/student`: room-code entry, personal history, review links.
- `/dashboard/teacher/quiz/[quizId]`: questions, answers, aggregate student performance.
- `/dashboard/teacher/analytics`: session list and filtering.
- `/dashboard/teacher/analytics/[sessionId]`: class accuracy and topic chart.
- `/quiz/live/host/[quizId]`: lobby, presence, question broadcast, timer, leaderboard, completion.
- `/quiz/live/student/[roomCode]`: guest nickname/sign-in, waiting, answers, feedback, final results.
- `/quiz/static/[quizId]`: intro, timer, answer navigation, grading, completion, review.

## Verification evidence

Commands ran from the repository unless a temporary-tool path is shown. Synthetic endpoints and placeholder credentials were substituted when compiling/running browser tests; real `.env.local` values were not printed.

- `git status --short --branch`: **PASS**, initially clean `main...origin/main`, no staged/unstaged/untracked files.
- `git diff --stat` and `git diff --cached --stat`: **PASS**, empty baseline diffs.
- Reachable-history secret scan: **FAIL**, 20 commits and 123 unique blobs scanned; shared host password found in two tracked source files at baseline commit. Local `origin/main` points to the same commit.
- Working-tree/environment/artifact scan: **FAIL**, shared password in source and browser artifacts. The original `.next` contained 2,595 files / 1,340,008,616 bytes, including ignored development caches. Known private AI environment values appeared in local caches, not detected in browser static assets. Public Supabase URL/anon key exposure is expected; the decoded anon role was verified.
- `npm ls --depth=0`: **PASS with local-install observations**, declared dependencies resolve; seven extraneous optional/WASM packages were present locally.
- `npm outdated --json`: **INFORMATIONAL**, newer package versions exist; no blanket upgrade is justified.
- `npm audit --json`: **FAIL**, 1 critical and 3 high package groups: `next`, `sharp`, `brace-expansion`, `source-map-js`.
- `npm audit --omit=dev --json`: **FAIL**, 1 critical and 2 high groups: `next`, `sharp`, `source-map-js`. Audit counts are package groups, not counts of independently exploitable application vulnerabilities.
- `npm run lint`: **FAIL**, 60 errors / 29 warnings.
- `npx --no-install tsc --noEmit --incremental false`: **PASS**.
- `node <temporary-tools>/check.cjs build` (executes `npm run build` equivalent with local fixture environment): **PASS**, all ten application routes built; compile 28.5 seconds, TypeScript 6.3 seconds.
- `node <temporary-tools>/browser-audit.cjs baseline`: **EXECUTED**, 40 route/viewport renders and axe checks. Three mobile layouts overflowed; 100 page/viewport rule violations across eight unique axe rule IDs. No broken images in these renders.
- `node <temporary-tools>/browser-audit.cjs baseline-verified functional`: **EXECUTED**, 13 passed / 19 failed. This corrected an initial test race and an incomplete synthetic Realtime message; those harness errors are excluded from application findings. One application exception remained: starting a zero-question static quiz.
- `node <temporary-tools>/server-probes.cjs baseline`: **EXECUTED**, twenty isolated boundary probes failed their security/validation expectations.
- Read-only GitHub advisory retrieval: **PASS**, reviewed Next.js Server Action DoS and Linux SVG image-optimization RCE conditions/patch versions. No exploit payload or destructive dependency test was run.
- Real Supabase authorization/constraints, real SMTP/OAuth, external AI generation/model entitlement, production HTTPS/cookies, and recovery operations: **BLOCKED / NOT RUN**.

Evidence files are under `C:/Users/mishr/AppData/Local/Temp/opencode/quizeee-audit-tools/`. Browser: Chrome 156.0.8078.47, headless, Windows. Viewports: 375×812, 768×1024, 1366×900, 1920×1080. Screenshots contain synthetic accounts/content only.

## Prioritized issue register

Locations below refer to the original baseline. `Confirmed` means source inspection and/or executed local reproduction supports the finding. `Verification required` is not a claim that a remote backend has been exploited.

### QZ-001 — Shared host password exposed and all instant hosts share one identity

**P0 · Security/repository · Confirmed · Blocks deployment.**

Affected: `src/actions/instantQuiz.ts:15–16, 136–143`, `src/app/quiz/live/host/[quizId]/page.tsx:73–79`, `src/components/InstantQuizSection.tsx:104–112`; reachable commit `bed4fb925245`; production browser chunk `.next/static/chunks/2t8s8yioi6is3.js`.

The action returns reusable host credentials, and the host page embeds the same password. Two independent instant creations return the same identity. Visitors can obtain a shared teacher account; its exact current remote permissions/validity were not tested. Remove the embedded/shared identity, isolate guest hosts per room, enforce ownership, and have the owner revoke/rotate the legacy credential and invalidate sessions. Removing source alone does not resolve history/existing-account exposure. No credential values are included here.

### QZ-002 — Unauthenticated service-role static grading permits identity forgery

**P0 · Authorization/data integrity · Confirmed · Blocks deployment.**

Affected: `src/actions/submitStaticQuiz.ts:23–27, 29–34, 77–94`.

Reproduce: capture the real action ID from a normal synthetic submission, then POST the action without a session/token, supplying a different `userId`, quiz/session IDs, and answers. Expected rejection; actual HTTP 200 with `success: true` and two inserted results attributed to the other student. The action also accepts teacher identities, competitive quizzes, closed schedules, and out-of-range choices in executed probes. Verify a token on the server, derive identity, verify student role/quiz/session eligibility, and validate all fields before privileged reads/writes.

### QZ-003 — Live answer keys and scoring authority reside in the student browser

**P1 · Assessment security · Confirmed implementation; remote policy verification required · Blocks deployment.**

Affected: `src/app/quiz/live/student/[roomCode]/page.tsx:18–23, 71–85, 338–370`; static question loading at `src/app/quiz/static/[quizId]/page.tsx:130–135`.

The student fetches `questions.*`, uses `correct_option_index`, computes correctness/speed score, and inserts `is_correct`, `score_awarded`, and `response_time_ms`. Browser checks cannot protect these values. Static attempts also retrieve answer keys, and `review=1` bypasses the UI schedule check. Move answer-key access/grading behind authenticated server/database operations; return safe question DTOs; forbid client writes to grading fields. Prove applicable RLS/column grants/RPC permissions on staging. Merely hiding keys in one UI query is insufficient.

### QZ-004 — Attempt/question deadlines are not authoritative or durable

**P1 · Assessment integrity/functionality · Confirmed · Blocks deployment.**

Affected: static page `:30–76`; live student `:103–114, 211–228`; host `:165–176, 328–361`.

A static refresh returns to Begin Quiz, losing answers and resetting the entire timer. A late live join invents a new per-question deadline from join time when its local storage is empty. Live authoritative end time exists only in a transient host broadcast/local storage; the database update persists only status/index. Browser clock/storage edits can alter time budgets. Persist server-owned attempt/question start/end timestamps and enforce them in grading. Local progress persistence can improve refresh UX but cannot make the assessment tamper-resistant. Static auto-submit failure can also retrigger immediately at zero time (`active → submitting → active`).

### QZ-005 — Public expensive/privileged operations have no adequate admission limits

**P1 · Abuse protection · Confirmed · Blocks deployment.**

Affected: `next.config.ts:9` (50 MB actions), `src/actions/generateQuiz.ts:8–11`, `src/actions/instantQuiz.ts:66–74, 156–195`, `src/lib/ai/nvidia.ts:58–66`.

A server probe accepts 100,000 requested questions. File type/size/text size are unchecked, and no application rate/quota/concurrency protection exists around public AI calls or guest account creation. Bound input and processing, add timeouts and bounded per-instance admission protection, then configure and verify durable deployment-wide quotas/rate limits and trusted proxy identity. Per-process counters alone are not a distributed production quota.

### QZ-006 — Production schema, RLS, grants, constraints, and Realtime policy cannot be verified

**P1 · Deployment/security gate · Verification required · Blocks deployment.**

Affected: whole Supabase data flow; no supplied SQL/migrations/policy artifacts.

Direct browser reads/writes, public room Realtime channels, profile-role authority, private analytics, submission uniqueness, answer-key access, and quiz/session ownership rely on unseen database configuration. Service-role actions bypass it. Request a sanitized schema/policy export and isolated staging access; test anonymous/student/teacher/foreign-owner operations and forged Realtime broadcasts. Do not infer missing remote RLS solely from missing repository files. Database migrations/production changes require authorization.

### QZ-007 — Known framework and transitive dependency advisories

**P1 · Dependencies/security · Confirmed scan · Blocks deployment.**

Affected: Next.js 16.3.5, `sharp` 0.35.4, `source-map-js` 1.2.1; dev-only `brace-expansion` 1.1.18/5.0.9.

`npm audit` reports the package groups above. The published Server Action DoS advisory applies to this App Router/Server Action architecture; SVG optimization RCE is specifically relevant to glibc Linux and vulnerable sharp. Other reported Next.js features such as `next/og`/`use cache` are not implemented here; their application exploitability is not asserted. Apply compatible targeted fixes (Next.js/eslint-config-next 16.4.3, patched transitive packages) and rerun build, tests, and scans. References: GHSA-p3m5-59mp-jv5r, GHSA-2464-fhr4-w9xw, GHSA-wq5f-xc86-pv6w, GHSA-68fv-2mgg-jv7q, GHSA-qhr7-859c-m2p7.

### QZ-008 — Quiz persistence can leave orphaned data and hide save errors

**P1 · Data integrity · Confirmed · Blocks deployment.**

Affected: `src/components/QuizCreator.tsx:194–253, 255–345`; instant session creation `src/actions/instantQuiz.ts:120–134`.

Reproduce PDF generation, then simulate failure inserting child questions. Expected rollback and visible error; actual empty parent quiz remains and the review branch does not render status. Instant session creation also lacks quiz rollback on session failure. Validate first, preserve visible failure feedback, compensate failed newly-created parent writes, and use a verified transaction/RPC for production atomicity and uncertain-network outcomes.

### QZ-009 — Invalid AI/review data silently becomes a saved assessment

**P1 · Assessment quality/validation · Confirmed · Blocks deployment.**

Affected: `src/lib/ai/types.ts:13–89`, `QuizCreator.tsx:175–229`, `InstantQuizSection.tsx:88–94`, `instantQuiz.ts:72–74, 97–109`.

Executed parser probes accept empty arrays, ignore expected count, invent placeholder questions/options/answer zero, and round fractional answer indexes. Deleting all review questions still permits saving an empty quiz; privileged instant creation accepts blank text and answer index 99. Use a reusable runtime schema/validator for count, text, exactly four distinct options, answer indexes, and reviewed content. Reject malformed model responses instead of fabricating answers.

### QZ-010 — Failed live submissions are presented as successful

**P1 · Core functionality/data integrity · Confirmed · Blocks deployment.**

Affected: live student `:338–370`.

Simulate HTTP 503 on insert, then choose an option. Expected actionable failure/retry without success confirmation; actual `hasSubmitted` and feedback are set first and the insert error is ignored. Commit submission UI state after acknowledgment, handle errors explicitly, prevent duplicate in-flight clicks, and preserve deadline eligibility. Host state updates also advance locally before checking persistence success and must expose synchronization failure.

### QZ-011 — Signup without an authenticated session loses confirmation instructions

**P1 · Authentication · Confirmed with simulated confirmation-required response · Blocks signup deployment until verified.**

Affected: `AuthForm.tsx:66–87`.

When signup returns a user but no session, the form caches the profile and redirects as though login succeeded. No confirmation instructions appear. Cache/navigate only with a valid session; otherwise stay on Auth and explain email confirmation. Verify real confirmation email delivery and callback allowlists in staging.

### QZ-012 — Static submissions lack application replay/idempotency protection

**P1 · Data integrity · Confirmed application behavior; database uniqueness unverified · Blocks deployment.**

Affected: `submitStaticQuiz.ts:40–65, 88–95`; history/analytics aggregators.

A sequential replay inserts a second batch in the isolated backend; source checks no prior submission. Without a supplied session it creates another session per attempt. Establish an explicit attempt identity, verify existing results, reuse an eligible session, and enforce atomic uniqueness/idempotency in the database. A frontend lock or check-then-insert alone does not resolve cross-instance races.

### QZ-013 — Teacher detail/host screens lack complete access gating

**P2 · Access UX/defense in depth · Confirmed UI behavior; RLS remains QZ-006 · Must be fixed with security remediation.**

Affected: teacher quiz page `:49–85`; host page `:73–100`.

Anonymous teacher-detail navigation renders data under permissive synthetic policies because `!user` is never rejected. The host page silently signs anonymous visitors into the shared account and permits a student to view a teacher-owned host lobby. Require a verified authenticated teacher and quiz ownership before loading questions/sessions; also enforce ownership server-side/database-side. These UI changes alone must not be described as secure authorization.

### QZ-014 — Auth ignores role and live-room return parameters

**P2 · Routing/usability · Confirmed · Not independently release-blocking.**

Affected: `src/app/auth/page.tsx:3–9`, `AuthForm.tsx:22, 86, 109`; student login link `:458`.

Student Get Started opens signup with Teacher selected; login from `?next=/quiz/live/student/...` drops the room and navigates to the dashboard. Honor validated teacher/student defaults and an allowlisted internal return path. Test unsafe external/scheme-relative return paths are rejected.

### QZ-015 — Password recovery is decorative

**P2 · Authentication/usability · Confirmed · Required for production account recovery.**

Affected: `AuthForm.tsx:315`.

Forgot Password only navigates to `#`. Implement request/reset forms, Supabase recovery callback handling, accessible feedback, and password validation. Verify SMTP, redirect allowlists, link expiry, and a real completed recovery on staging; synthetic HTTP success is not email-delivery proof.

### QZ-016 — Static answer review mixes different sessions

**P2 · Data correctness · Confirmed · Not independently release-blocking.**

Affected: static page `:145–164`.

The review query filters student/question IDs, not the requested `sessionId`. Adding a later response for the same question in another session overwrites the selected attempt's score/answer. Scope review to the selected authorized attempt and reject missing/foreign attempts. Teacher cumulative scores/history must be checked against the agreed attempt model.

### QZ-017 — Mobile layouts clip important content and brand/navigation

**P2 · Responsive UI · Confirmed at 375×812 · Not independently release-blocking.**

Affected: `DashboardNavbar.tsx:22–89`; `Navbar.tsx:85–193`; `QuizCreator.tsx:349–591`; analytics index `:156–166`; host lobby `:552–559`; auth layout `:145–207`.

Teacher dashboard width reaches 423 px, teacher detail 391 px, analytics index 426 px on a 375 px viewport. Signout/date picker controls extend offscreen. Public navigation squeezes the logo almost to invisibility. The host code card is clipped by overflow hiding, and the auth illustration pushes the form below the first mobile viewport. Use responsive wrapping/min-widths, shrinkable date inputs, adaptive card/code sizing, and mobile-appropriate auth spacing while retaining the existing brand.

### QZ-018 — Accessibility semantics, labels, keyboard interaction, and status states are incomplete

**P2 · Accessibility · Confirmed axe/source/keyboard evidence · Not a critical security severity.**

Affected: shared navigation/forms/loading; home, dashboards, quiz, analytics pages.

Eight unique axe rule IDs across the viewport runs: color-contrast (QZ-019), button-name, label, page-has-heading-one, heading-order, region, landmark-one-main, scrollable-region-focusable. Teacher quiz cards are click-only DIVs (`tabIndex=-1`); password reveal has no accessible name; date/duration/review controls lack connected labels; headings/landmarks and selected/live status semantics are inconsistent. Add native links/buttons, labels/ARIA state, meaningful loading/error announcements, keyboard-focusable scroll regions, and visible focus treatment. Placeholder-based names are not a substitute for persistent labels.

### QZ-019 — Brand/muted text and white-on-orange controls fail contrast

**P2 · Accessibility/theming · Confirmed computed contrast · Not independently release-blocking.**

Affected: seven rendered page types and shared controls; `globals.css:4–7, 28–30`.

Examples: white on `#E86F47` is 3.09:1 (small text requires 4.5); orange on peach is 2.87:1 (large text requires 3); muted text on peach is approximately 3.5:1. Retain orange fills but use dark control text and accessible brand-ink/muted tokens, consistently across pages. Disabled controls are contrast-exempt and should not be misclassified.

### QZ-020 — Analytics chart exceeds its fixed-height card

**P2 · Visual layout · Confirmed DOM bounds · Not independently release-blocking.**

Affected: analytics detail `:219–262`.

The 500 px card includes a heading plus a chart set to 100% of parent height. At laptop size the chart bottom is 945 px while the card ends at 910 px. Allocate a separate bounded/flex chart area and provide accessible topic/accuracy text alongside the chart.

### QZ-021 — Analytics deduplicates distinct quizzes by title

**P2 · Functionality/performance · Confirmed · Not independently release-blocking.**

Affected: analytics index `:75–89`.

A completed competitive quiz hides an unrelated waiting quiz sharing the same title. Include/use `quiz_id`, not title. Build a set of played quiz IDs to avoid the current nested `some`/filter scan.

### QZ-022 — Study material and provider/database details leak into logs/errors

**P2 · Privacy/error handling · Confirmed logging probes/source · Must be corrected with security fixes.**

Affected: generation action `:15, 65–68`, AI types `:42–44`, NVIDIA `:68–70`, Gemini catch blocks; privileged action catches.

A raw study topic and malformed model output are logged. Raw provider response bodies and internal error messages are returned/re-logged through the action. Logs may contain private teaching material or upstream details. Keep safe operational summaries/codes and public validation messages; omit prompts, model bodies, credentials, and raw privileged errors.

### QZ-023 — TXT uploads, parser lifetime, and network bounds are incomplete

**P2 · Integration/performance · Confirmed probes/source · Not independently release-blocking.**

Affected: instant file accept `:286`, generation `:26–61`, NVIDIA fetch `:58–66`, Gemini model loops.

The instant UI advertises `.txt` but the action always parses uploads as PDF. `PDFParse.destroy()` is never invoked. AI calls lack explicit timeouts; Gemini candidate lists contain duplicate defaults and retries can multiply expensive vision work. Handle TXT as bounded text, validate PDFs, release parser resources in finally, bound requests/retries, and deduplicate candidate models. Scanned-PDF/Gemini production behavior remains unverified.

### QZ-024 — Static analysis fails and data types obscure contracts

**P2 · Maintainability/build gates · Confirmed · Must pass the agreed CI gate.**

Affected: 60 ESLint errors / 29 warnings across actions, pages, components, AI parsing.

Errors include explicit any, refs read during render, use-before-declaration in effects, synchronous cache hydration state updates, and a host cancellation variable never updated. Add shared typed data contracts/unknown-error handling and correct actual hook/lifecycle problems. Do not silence the lint configuration globally to produce a nominal pass. Existing TypeScript noEmit/build success does not imply runtime validation.

### QZ-025 — Homepage eagerly transfers oversized logo images

**P2 · Performance · Confirmed resource sizes · Not independently release-blocking.**

Affected: home/nav/footer/auth `<img>` and duplicated logo assets.

One fresh local homepage load transfers 1,619,425 encoded bytes for just three logos: 546,608 + 546,608 + 526,209 bytes. The 2,172×724 navbar image is displayed at approximately 84×28. Hero/nav/assets/logo files are byte-identical. Use responsive optimized image delivery with intrinsic dimensions/lazy loading; retain original source assets unless deletion is authorized. Local single-run LCP 208 ms, FCP 196 ms, CLS 0 are unthrottled localhost observations, not production Core Web Vitals.

### QZ-026 — Footer destinations and product promises are incomplete

**P2 · Secondary functionality/product readiness · Confirmed · Owner review required.**

Affected: `Footer.tsx:169–191, 207–248`; master/design specifications.

Analytics points to the general dashboard; documentation/help/about/privacy/terms links are `#`; socials point to generic platform homepages. BYOK settings, diagnostic drilldowns, average response-time/common-wrong-answer reports, and several design-spec enhancements are absent. Fix real destinations; represent unavailable links honestly; obtain actual privacy/contact/social content. Agree the launch feature scope rather than invent policies or claim these features work.

### QZ-027 — Gemini SDK is past documented end of support

**P2 · Dependency/integration lifecycle · Confirmed package README · Requires review before enabling Gemini at launch.**

Affected: `@google/generative-ai` 0.24.1; `src/lib/ai/gemini.ts`.

The installed SDK README states all support ended August 31, 2025. `npm view ... deprecated` returns no metadata, so this is a documented support issue, not a fabricated npm deprecation/advisory. Plan a focused supported-SDK migration and verify current model identifiers, entitlements, response shapes, OCR, and timeouts in staging. No real Gemini request was made.

### QZ-028 — Deployment environment and operational setup are undocumented/unverified

**P2 · Deployment operations · Confirmed local gaps; production settings unverified · Operational launch gate.**

Affected: starter `README.md`, `package.json`, missing `.env.example`, no health/monitoring/runbook artifacts.

Supabase JS requires Node ≥22; pdf-parse requires Node ≥22.3 (or its supported Node 20 range, insufficient for Supabase). The project has no Node engine pin and still uses Node 20 type definitions. Required environment variables, production start procedure, Supabase schemas/policies/Realtime/email, AI configuration, logging, backups/restore, and hosting limits are not documented. Provide a placeholder-only env template, compatible Node engine, deployment instructions, liveness/configuration checks, and owner-verified operational settings. Next.js server hosting is required; a static SPA upload is not compatible with these Server Actions.

### QZ-029 — Unused dependencies/assets and specification drift

**P3 · Cleanup/documentation · Confirmed inventory · Does not block deployment.**

Affected: unused direct `clsx`/`tailwind-merge`; unreferenced template/reference/flow PNG/SVG assets; unused Geist Mono variable; comments/imports; `design.md`.

Full source import review shows no direct use of clsx/tailwind-merge. React DOM remains framework-required despite no explicit source import. Several public reference assets are unused, and logo duplication is hash-confirmed. The design spec's example indigo/dark-projector guidance does not match the newer implemented peach identity. Keep brand/design intent; clean only justified dependencies/imports and document asset candidates instead of deleting user files.

### QZ-030 — Continuous decorative motion ignores reduced-motion preference

**P2 · Accessibility/usability · Confirmed CSS/SVG implementation · Not independently release-blocking.**

Affected: `DashboardBackground.tsx`, hero/footer SVG SMIL, feature marquee, winner bounce/loading animation.

No prefers-reduced-motion treatment is implemented. Meaningful feature content only pauses its ticker on hover, which is unavailable to keyboard/touch users. Provide a reduced-motion/static treatment and an accessible pause for moving meaningful content, preserving decorative identity for users who permit motion.

### QZ-031 — Host initialization can create a subscription after unmount

**P2 · Lifecycle/resource cleanup · Confirmed source path; race not browser-reproduced · Not independently release-blocking.**

Affected: host page `:59, 154, 211–213` and module initialization cache `:36–37, 65–151`.

The cancellation flag is never set in cleanup; a slow initialization may continue and create a channel after unmount. The map is keyed only by quiz ID, not authenticated identity. Set cancellation on cleanup, check it around awaits/subscription creation, and scope initialization reuse to the verified user. Treat the race as a source-supported risk, not an executed leak measurement.

## Repository safety

Safe to commit after remediation/review: source, package/config/lockfiles, AGENTS/CLAUDE/design/README documentation, intended public brand assets, placeholder-only environment template, and redacted audit/test documentation. The two credential-bearing source files are **not safe in their baseline form**.

Exclude: `.env.local` and real `.env*` files, `.next/` including credential-containing caches, `node_modules/`, generated type/build-info files, build/coverage/test output, logs, private keys/certificates, local databases, and local tool/browser artifacts. Baseline `.gitignore` already excludes environment/build/dependencies but also excludes any env example; add a deliberate template exception and practical local-secret/test-output patterns.

Further review: existing shared-host account/sessions and legacy quizzes, all reachable history containing the credential, the sensitivity of publishing detailed security reports, reference assets/product/contact/legal links, and the parent PDF (outside this Git repository). No history, remote, commit, push, deployment, or production operation was changed.

## Remediation plan

### Phase A — Critical security

1. QZ-001: remove distributed shared credentials; isolate instant hosts; owner must revoke/rotate legacy account credentials/sessions.
2. QZ-002/QZ-012: authenticate and authorize static grading, validate eligibility/input, add application replay handling; database idempotency/uniqueness must be verified separately.
3. QZ-007: compatible targeted dependency patches and scans.
4. QZ-005/QZ-022: bounded public operations and sanitized errors/logs; verify deployment-wide quotas.
5. QZ-003/QZ-006: obtain schema/RLS and authorization for database-side grading/access controls; no unreviewed production migration.

### Phase B — Functional/deployment blockers

Correct confirmation handling, save validation/rollback/visible feedback, submission failures, resource cleanup, TXT ingestion, reliable local progress, session-scoped review, and deployment documentation. Persisted authoritative deadlines and transactions require an agreed database migration/attempt model and staging verification.

### Phase C — UI/UX/responsive

Fix mobile navigation/date cards, accessible labels/links/headings/status/focus, contrast tokens, chart containment, return paths, recovery UX, and honest secondary destinations. Preserve the implemented brand.

### Phase D — Performance/maintainability

Optimize measured logo delivery, correct hook/type/static-analysis problems, use quiz-ID analytics filtering, bound lifecycle/retries, and document low-priority asset/spec/SDK follow-ups. Add meaningful regression tests for security boundaries and assessment behavior.

## Outstanding authorization and verification

Required before claiming readiness: sanitized Supabase schema/RLS/grants/constraints export; isolated staging access; authorization for schema/RPC/deadline changes; owner-handled legacy credential revocation/session invalidation; real signup/recovery/email and AI model validation; hosting HTTPS/origin/rate-limit/resource/monitoring settings; backup/restore proof. None of these is inferred from a successful local build.

## Expanded-history follow-up (documented after the initial audit)

The final review included reflog-only commits in addition to the initial reachable-history scan. This identified an old NVIDIA API key at `src/lib/ai/config.ts:19 @ b9281c3d73f4`, not reachable from current branch/remote-tracking refs. It differs from the current local NVIDIA key; provider validity, revocation and any past publication were not tested. The final report registers this as **QZ-033 / P0** and requires old-key revocation verification. It also records **QZ-032**, the baseline missing-header finding resolved during local hardening. No key values, history or provider settings were changed.
