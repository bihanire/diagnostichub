# RFC 001: Relational Encyclopedia

## Status

Accepted

## Context

Branch officers need a reliable way to diagnose after-sales issues without digging through long SOP documents or relying on memory under pressure. Inputs are often messy, incomplete, or phrased as natural language complaints.

## Decision

Build a two-tier web application:

- A FastAPI backend that owns search, triage flow control, seeded procedures, and related-procedure lookups.
- A Next.js frontend that presents one question per screen and keeps the active assessment in browser storage for resume support.

## Core architectural choices

### 1. Deterministic fuzzy search instead of ML-first intent extraction

Reason:
- Easier to explain and maintain.
- Lower latency on low-end infrastructure.
- No external model dependency for the first production version.

Trade-off:
- Less flexible than a trained classifier for very noisy or multilingual input.

### 2. Procedures plus decision nodes instead of plain-text SOP blobs

Reason:
- Supports guided yes/no triage.
- Keeps the data model extensible for more procedures later.
- Makes linked follow-up procedures easy to query.

Trade-off:
- Seed content authoring takes more effort up front.

### 3. Customer care guidance stored with each procedure

Reason:
- Ensures branch officers receive greeting, listening, and expectation-setting prompts inside the same flow.
- Keeps support guidance contextual rather than global and generic.

### 4. Browser-local session persistence

Reason:
- Handles abandoned flows without introducing authentication or server-side sessions.
- Works well for shared branch desks where the current browser is the active work surface.

Trade-off:
- Resume history is device-local, not account-global.

## Data model

- `procedures`: high-level procedure records and SOP metadata.
- `tags`: searchable keywords per procedure.
- `decision_nodes`: yes/no flow steps and final outcomes.
- `linked_nodes`: related-procedure relationships.

## API boundaries

- `POST /search`: free-text search and intent extraction.
- `POST /triage/start`: open the first node for a procedure.
- `POST /triage/next`: advance the flow or return the final outcome.
- `GET /related/{procedure_id}`: fetch linked procedures.

## UX principles

- Mobile-first
- One question per screen
- Large tap targets
- Plain-language output
- Minimal clutter
- Visible progress

## Edge-case handling

- No search match: return a helpful fallback and alternatives when available.
- Multiple possible matches: return the best match plus nearby alternatives.
- Incomplete decision tree: return an escalation-safe outcome instead of breaking the flow.
- User abandons flow: keep the latest session in local storage.
- Invalid API input: rely on FastAPI validation plus clear route errors.

## Future extensions

- Admin interface for authoring procedures.
- PostgreSQL full-text or trigram indexing.
- Audit logging.
- Analytics for common issue patterns and flow drop-off.
- Authentication and multi-branch case history.
