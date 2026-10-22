# Ojas Polakhare · career platform

A static portfolio with a reviewed career knowledge base, read-only agent tools, public JSON, GitHub intake, and a one-page LaTeX resume workflow. No framework or runtime dependencies.

```sh
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Build output is **`dist/` only**. `index.html` is the shared build template; project and experience routes are generated from `career/database.json`. Old source HTML is historical migration material and is not deployed. Edit the database rather than those historical files. Generated cards and case studies share the same approved records as API responses and resumes.

## Publication and hosting

The repository currently uses GitHub Pages legacy branch deployment. **Before merging this upgrade, switch Settings → Pages → Source to GitHub Actions.** The included Pages workflow uploads only `dist/`, preserving CNAME, existing URLs, and the existing resume download. Do not deploy the repository root: it includes build source and review material. Nothing in this change alters live Pages settings or merges automatically. Set a required reviewer on the `github-pages` environment if you want an additional deployment approval.

GitHub Pages serves JSON snapshots at `/api/career/profile.json`, `/api/career/projects.json`, `/api/career/projects/{slug}.json`, and `/api/career/resume-evidence.json`. Pages cannot run a server or filter query strings. WebMCP and the evidence interface filter the approved dataset locally. For extensionless GET endpoints and server-side filtering, deploy `worker.mjs` with the included `wrangler.jsonc` to an authorized Cloudflare account, or run the Node server. Cloudflare deployment is optional and has not been performed.

## Career records and approval

Each claim has a stable ID, text, verification status, explicit approval, and source IDs. Projects also have category, lifecycle, approval provenance, skills, and case-study sections. `lib/career.mjs` validates records and constructs an explicit public projection.

- `verified`: inspected source supports this statement; no implied performance measurement or individual authorship.
- `user_confirmed`: self-reported in the owner-supplied resume/interview, with provenance.
- `needs_review`: historical public statement awaiting supporting evidence; displayed with a review label, never used in resumes.
- `excluded`: not emitted.

Project publication requires `approved: true`, `lifecycle: "published"`, an `approvalSource`, and individually approved claims. A source reference alone never grants publication. New projects move through `discovered`, `in_development`, `ready_for_review`, then `published`. The excluded names in the database must stay blocked. No new project is published by discovery or interview processing.

Missing case-study details remain explicitly unknown. `career/intake/questions.json` contains five interview questions per migrated project. No performance metrics, individual AKMS contributions, or lessons were inferred from repository existence. See [provenance](docs/provenance.md).

## Public API and WebMCP

The Node server and optional Worker support:

- `GET /api/career/profile`
- `GET /api/career/projects?skills=Python,SQLite&category=ai-agents&relevance=research`
- `GET /api/career/projects/akms`
- `GET /api/career/resume-evidence?relevance=Python%20research`

Skills use case-insensitive exact matches with AND semantics. Category matches exactly. Relevance uses transparent keyword ranking; it is not a prediction of job fit. Profile and detail endpoints accept no filters. Unknown parameters, repeated parameters, objects, control characters, oversized strings and invalid slugs are rejected. Public endpoints only permit GET/HEAD. No credentials or drafts are served. `/llms.txt`, `/agents/`, canonical links, sitemap and JSON-LD provide discovery.

WebMCP follows the [20 October 2026 community draft](https://webmachinelearning.github.io/webmcp/) and [Chrome’s imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api): `document.modelContext.registerTool`. It registers `get_profile`, `list_projects`, `get_project` and `get_resume_evidence`, with JSON schemas, runtime validation and read-only annotations. It is experimental; unsupported browsers retain fully functional HTML and JSON access. No invented polyfill or external model service is used.

## Automatic public repository intake

The weekly/manual `Review new public projects` workflow reads public, owned, non-fork repositories, inspects a bounded README/manifests/source sample, records language/dependency observations and source hashes, and opens or updates one **draft PR**. Enable GitHub Actions’ “Allow GitHub Actions to create and approve pull requests” repository setting for PR creation. Its token has contents/PR write access only in that workflow. No private repository content is fetched.

```sh
GITHUB_TOKEN=... npm run intake  # use an approved secret/environment; never commit tokens
```

For a bounded authenticated local check: `node scripts/intake.mjs --github-cli --repo TheRealOP/Agent-Knowledge-Management-System` uses your existing GitHub CLI session without exporting a token. Existing projects retain their portfolio slugs.

Fingerprints cover relevant code/manifests/README tree hashes and language observations; unchanged content produces no new draft. Review state is stored in `career/intake/state.json`. Re-running retains owner answers but marks new code for review. README text is stored as untrusted data, never executed or passed to an instruction-following model. Planned statements are separate from implemented features; source presence is not proof of functionality. Bounded samples are scaffolding for review, not an exhaustive architecture audit. Large/truncated trees require manual review.

Answer `overview`, `motivation`, `contributions`, `architecture`, `decisions`, `challenges`, `results`, `limitations`, and `lessons` in a draft’s `answers`, and add public HTTPS `answerSources` and `confirmedSkills`. Then:

```sh
node scripts/review-intake.mjs <slug>
```

This assembles a case study and card summary from the owner’s answers without inventing facts. It writes **unapproved** `ready_for_review` records. Explicitly approve the project and intended claims, set lifecycle to published, record approvalSource, then review the diff and merge. This repository is public: keep confidential interview material and private drafts outside it; intake is intentionally restricted to already-public repositories.

## One-page resume

The font, margins, and macros from the supplied `main.tex` are retained in `resume/template.tex`; its full personal body remains local, outside tracked/public output. Generated content comes only from approved published career evidence. Architecture descriptions do not become claims of personal authorship. Relevance is deterministic; select and review against the actual role.

```sh
npm run resume -- resume/ai-ml-job.txt --source-only
npm run resume -- path/to/job.txt
# Alternative trusted compiler:
npm run resume -- path/to/job.txt --tectonic
```

PDF generation needs pdfLaTeX (or Tectonic), template packages including Source Sans Pro and Font Awesome, and Poppler (`pdfinfo`, `pdftoppm`). Compiler/PDF tool locations may be supplied as `TECTONIC_BIN`, `PDFINFO_BIN`, `PDFTOPPM_BIN`. There are no browser compilation or AI-processing endpoints. The manual authenticated **Generate one-page resume** workflow installs these dependencies on an isolated runner, escapes every selected claim, disables shell escape, and uploads a seven-day artifact with PDF, TeX, a PNG preview and an evidence manifest.

**Exactly one page is mandatory.** The generator compiles, checks page count and LaTeX overflow, reduces the evidence selection if needed, and refuses a PDF that still fails. It never shrinks font size or changes margins to hide overflow. Review the preview before sending a resume. The existing historical PDF download is unchanged; it is not described as a newly generated/validated resume.

## Verification

`npm test` covers public projections, provenance, publication gates, excluded names, filters, WebMCP schemas/execution/fallback, untrusted repository intake/idempotency, Worker routing, generated page links, TeX escaping, and strict one-page/overflow checks. A sample AI/ML resume was compiled locally with the trusted app-bundled Tectonic compiler, passed `pdfinfo` (one Letter page), and was rendered and visually reviewed. See [audit and verification](docs/audit.md).
