# Quizeee

A Next.js learning app for PDF/text-to-quiz generation, teacher/student dashboards, competitive live quizzes, scheduled static assessments, and classroom analytics.

## Deployment status

**NOT READY FOR DEPLOYMENT.** See [AUDIT-REPORT.md](./AUDIT-REPORT.md) and the pre-remediation [AUDIT-INITIAL.md](./AUDIT-INITIAL.md). Local security/UX fixes and regression checks do not resolve the outstanding database authorization, live grading/deadline, credential-revocation, and service-verification requirements.

## Stack and runtime

- Next.js 16.4.3 App Router, React 19.2.8, TypeScript, React Compiler.
- Tailwind CSS 4, Courier/Geist fonts, Lucide icons, Recharts.
- Supabase Auth/PostgreSQL/Realtime; Node Server Actions for generation, instant guests, and static grading.
- NVIDIA text generation with Gemini fallback/OCR/vision; `pdf-parse` for selectable PDF text.
- **Node.js ≥22.3.0 is required.** Use a supported, patched Node 22+ release. Supabase JS requires Node ≥22; the selected PDF parser requires ≥22.3 in this runtime branch.

## Local setup

1. Install dependencies with `npm ci`.
2. On a fresh checkout, create `.env.local` using `.env.example` and fill in the required configuration. Preserve any existing local environment file.
3. Prepare the Supabase schema, Auth profile trigger, policies, and Realtime settings in an isolated development/staging project. The current repository does not contain these migrations.
4. Run `npm run dev` and open `http://localhost:3000`.

### Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: public HTTPS Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon/publishable key with appropriate RLS. **Never use a service-role/secret key here.**
- `SUPABASE_SERVICE_ROLE_KEY`: server-only admin credential used by privileged actions.
- `AI_PROVIDER`: `nvidia` or `gemini` (default `nvidia`).
- `NVIDIA_API_KEY`, `NVIDIA_MODEL`: server-only provider credential and an entitled, verified model.
- `NVIDIA_API_URL`: optional server-only endpoint override; defaults to NVIDIA's HTTPS chat completions endpoint.
- `GEMINI_API_KEY`, `GEMINI_MODEL`: server-only Gemini configuration needed for fallback/visual PDFs. Verify actual model access before enabling it.

All real environment files are ignored. `.env.example` intentionally contains only empty secrets/public placeholders. `NEXT_PUBLIC_` values are baked into browser bundles at build time and require rebuilding if changed.

The unsupported legacy Google SDK has been replaced with **`@google/genai` 2.31.0**, pinned to avoid an unreviewed SDK 3 upgrade. The server adapter explicitly uses the Gemini Developer API and preserves configured-model/fallback selection, text JSON, inline PDF vision, and OCR interfaces. Automatic continuation is disabled and HTTP attempts are capped at one per candidate model; each request has a 60-second timeout/abort signal. Real Gemini model access and text/OCR/vision output still require staging verification.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm audit
npm run build
```

The 37-case Node test suite executes actual TypeScript modules with explicit local service doubles. It verifies authenticated static identity, eligibility/input/replay controls, isolated guest hosts, guest validation, strict AI output, privacy, bounded generation, and internal redirects. Ten Gemini tests execute the installed SDK's actual serialization/response/retry code with fetch intercepted, covering JSON/PDF/OCR contracts, auth-header handling, bounded fallback and continuation suppression. It does **not** attest to the real Supabase policies or external AI/email services.

Browser evidence and audit tooling were kept outside the repository in the approved temporary audit directory; commands and exact paths are recorded in the audit report. Those runs used a production Next.js server with synthetic Supabase/AI/Realtime fixtures and Chrome, not production data.

## Production build/start

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

Install build-time dev dependencies before building. Configure the same intended public Supabase values for build and runtime, and supply server secrets through the hosting secret store. Deploy with a Node-capable Next.js host; static export/SPA-only hosting cannot execute the Server Actions or health Route Handler. Next.js handles nested routing; no separate static SPA fallback is used.

The audit's browser builds used placeholder/local endpoints. The final normal build restores this workspace's existing environment configuration; it still does not prove production service connectivity. Always rebuild for the chosen production environment and complete the release gates below.

### Current request bounds

- Action body: 12 MB including multipart overhead; uploads: 10 MB.
- PDF: at most 200 pages; selectable extraction: 30-second processing deadline with parser disposal.
- Study text: at most 120,000 characters; quiz: 1–20 questions, four distinct non-empty options each.
- AI requests: 60-second per-provider request timeout; three concurrent generations per server instance.
- Gemini SDK: one HTTP attempt per candidate model, deduplicated configured/latest fallback, and no automatic continuation requests.
- Supabase requests: 15-second per-request timeout, in addition to any SDK retry behavior.
- Per-instance fixed-window guards: 10 generations, 5 instant creations, and 200 guest joins per 10 minutes per derived client address. The join guard accommodates a shared school/NAT address.

These in-memory limits reset with process restarts and are not shared between instances. Production ingress must normalize/trust forwarded address headers and provide durable rate limits, provider spending quotas, and appropriate classroom/NAT capacity. Do not treat the local guard as complete abuse protection.

### Health and security headers

`GET /api/health` returns a non-sensitive, uncached **process/configuration** status (`200` or `503`). Its `scope` explicitly excludes database/AI connectivity. Pair it with staging-tested upstream checks and external monitoring.

Headers include CSP, frame denial, nosniff, referrer/permissions policy, and production HSTS. The current CSP permits inline scripts/styles required by prerendered Next.js/React. A nonce-based strict script policy would require a reviewed dynamic-rendering change. Configure HTTPS at ingress and forward the public host consistently for Next.js Server Action Origin checks; no wildcard extra action origins are configured.

## Required release gates

1. **Historical credential revocation:** the original shared instant-host credential appears in existing history/browser artifacts. The owner must revoke/rotate that account credential and invalidate sessions, then review its legacy quizzes/access. An old NVIDIA key was also recovered from reflog-only commit `b9281c3d73f4` (`src/lib/ai/config.ts:19`); it differs from the current configured key, but its revocation and past publication remain unverified. Verify/revoke that old provider key. Current code uses isolated random guest accounts. Removing current source or changing to a different local key does not revoke an exposed credential or erase history.
2. **Schema and policy verification:** obtain/version a sanitized schema, RLS/grants/constraints/Auth triggers, and Realtime authorization. Inferred tables are `profiles`, `quizzes`, `questions`, `quiz_sessions`, `submissions`. Test anonymous, student, teacher, foreign-owner, and direct REST/action requests separately.
3. **Authoritative live grading:** students currently receive correct-answer indexes and supply live correctness/score/timing fields. Move grading and answer-key reads behind authenticated server/database operations; deny client grading-field writes; return safe question DTOs. Verify room broadcast/host ownership permissions.
4. **Authoritative deadlines:** persist server-owned attempt/question start/end timestamps and enforce them during grading. The local static progress store is refresh UX, not an anti-tampering control; late live joins still invent a fresh local deadline.
5. **Atomicity/idempotency:** verify database-level attempt identity and unique submission/room-code constraints, collision handling, transactions/RPCs, and parallel retries. Current compensating quiz rollback and in-process submission locks do not guarantee cross-instance/uncertain-network atomicity. Reconcile any existing orphan/duplicate records in staging before planning production cleanup.
6. **Production services:** verify actual AI model entitlements/limits and visual PDFs; Supabase signup/profile creation, confirmation/recovery email delivery and redirect allowlists; Realtime publication and private message policy; durable quotas and hosting body/time/resource limits.
7. **Operations and product scope:** configure monitored errors/health, backups and a tested staging restore, migration/rollback procedure, and required privacy/terms/contact content. Documentation/social links marked coming soon and BYOK/advanced diagnostics are not completed launch features.

Database/infrastructure/history changes require owner authorization. Do not use production accounts/data for destructive validation.

## Main user flows

- Public topic/PDF/TXT → server extraction/generation → isolated instant teacher account → live host room.
- Public room code/nickname → validated guest student account → presence, active questions, answer feedback, final results.
- Registered teacher → PDF generation → human review/edit/delete/add → quiz/questions → scheduled code or competitive session → diagnostics.
- Registered student → static/competitive code → assessment → personal history → authorized session-scoped static review.

The implemented design is the warm peach/orange/Courier theme. Example indigo/dark-projector suggestions in `design.md` are older design guidance, not a reason to replace the current brand during maintenance.
