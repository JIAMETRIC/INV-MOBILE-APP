# Persistent AI Assistant Guidelines

## Automated Session Tracking & Documentation Protocol

For **every** prompt and session in this workspace, the AI assistant must automatically adhere to the following workflow without needing user prompting:

> **Definition — "session":** each new chat (a new conversation or agent invocation) counts as one session, regardless of its length. If a single chat covers multiple topics, each topic still gets its own `<TOPIC>/` folder (see item 2 below), but the "session" itself is the whole chat.

---

### 1. Mandatory Artifacts & Documentation

At all times and across every session:

1. **Standard IDE Artifacts (`implementation_plan.md` & `walkthrough.md`):**
   - Proactively maintain and update `implementation_plan.md` and `walkthrough.md` in the session's internal artifact directory (`<appDataDir>/brain/<id>/`).
   - Detail problem statements, architectural analysis, and validation steps to power IDE review and progress tracking.
   - **Scope note:** these files are *session-scoped* — internal to the IDE, one set per session. The similarly-named `walkthrough.md` under item 2 below is *topic-scoped*: it lives in-repo and persists across sessions on the same topic (and its topic-scoped `TRACKING.md` counterpart now also carries the design rationale that this session-scoped `implementation_plan.md` covers). Do not confuse the two.

2. **Dedicated In-Repository Topic Folders & Suite (`<TOPIC>/`):**
   - For every session and topic, the AI assistant **MUST automatically create a dedicated directory named after the active topic suite in the workspace root: `<TOPIC>/`** (e.g. `EXPORT_AND_LAYOUT/`, `GST_AND_TAX/`, `INVENTORY_AND_STOCK/`).
   - **Check first:** before creating `<TOPIC>/`, check the workspace root for an existing folder matching this topic (same or near-identical name, e.g. `EXPORT_AND_LAYOUT/` vs. `EXPORT_LAYOUT/`) — reuse it if found. Only create a new folder when none exists.
   - Inside this topic folder, all three (3) topic-scoped files — **all Markdown (`.md`)** — **MUST be created and maintained together in lockstep**:
     - **`<TOPIC>/<TOPIC>_TRACKING.md`** (e.g. [`EXPORT_AND_LAYOUT/EXPORT_AND_LAYOUT_TRACKING.md`](file:///c:/Users/admin/Desktop/prethyega_erp_v2/EXPORT_AND_LAYOUT/EXPORT_AND_LAYOUT_TRACKING.md)): Opens with a short **Rationale** section — why each spec below was chosen, alternatives considered, trade-offs made — directly above the specs it explains. Followed by the technical tracking itself: layout coordinates, width budgets, database schemas, and packaging configs.
     - **`<TOPIC>/<TOPIC>_walkthrough.md`** (e.g. [`EXPORT_AND_LAYOUT/EXPORT_AND_LAYOUT_walkthrough.md`](file:///c:/Users/admin/Desktop/prethyega_erp_v2/EXPORT_AND_LAYOUT/EXPORT_AND_LAYOUT_walkthrough.md)): Detailed verification log, code diffs, root-cause findings, and test outputs.
     - **`<TOPIC>/<TOPIC>_session-prompts.md`** (e.g. [`EXPORT_AND_LAYOUT/EXPORT_AND_LAYOUT_session-prompts.md`](file:///c:/Users/admin/Desktop/prethyega_erp_v2/EXPORT_AND_LAYOUT/EXPORT_AND_LAYOUT_session-prompts.md)): Topic-specific prompt log. Automatically append every prompt relevant to this topic — append only, never overwrite prior entries. Each entry is a `## Prompt N` heading followed by the verbatim prompt in a single fenced code block, with exactly one blank line between entries.
   - **Rotation/archiving policy:** once a `<TOPIC>_session-prompts.md` file exceeds 200 entries, move all but the most recent 50 into `<TOPIC>/session-prompts-archive/<TOPIC>_session-prompts_<YYYYMM>.md`.
   - **Before writing:** at the start of any session touching an existing `<TOPIC>/`, read all three files in that folder first and merge new content in — never overwrite a file's prior contents outright.
   - **Crucial Rule:** The project root remains clean and uncluttered. All topic files, including prompt-log archives, are strictly isolated inside their respective `<TOPIC>/` directory. Never place topic files loose in the workspace root, and never omit `<TOPIC>_TRACKING.md` or any companion file.

3. **Project Overview & Setup Documentation (`README.md`):**
   - Automatically create or maintain an exhaustive, production-grade [`README.md`](file:///c:/Users/admin/Desktop/prethyega_erp_v2/README.md) at the workspace root.
   - Must comprehensively document:
     - Project overview, core business features, and architectural principles.
     - Complete tech stack table (framework, database, document engines, UI, packaging).
     - Prerequisites and step-by-step virtualenv / dependency installation guide.
     - Exhaustive CLI commands table (development, web mode, testing, and production builds).
     - Full repository directory tree mapping with descriptions.
     - Environment configuration: document variable *names* only (e.g. `DB_PASSWORD`, `SECRET_KEY`) via a checked-in `.env.example`. Never commit literal credential values to `README.md` or any tracked file; if local-dev sample values are needed for onboarding, mark them explicitly "dev-only, rotate before any shared/production use."
     - Direct cross-references to `AGENTS.md` and, for each active topic, its `<TOPIC>_TRACKING.md`, `<TOPIC>_walkthrough.md`, and `<TOPIC>_session-prompts.md`.

---

