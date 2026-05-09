# DiagnosticHub Surface Inventory (Post-Phase 1 Hardening)

## Scope
- Frontend scan: `frontend/app`, `frontend/components`, `frontend/lib`
- Backend scan: `backend/app/api/routes`
- Purpose: detect dormant operator-facing surfaces before Phase 2 contract versioning.

## Status Legend
- `WIRED`: visible control triggers a complete behavior (backend call or deterministic local action).
- `FE_ONLY`: visible control appears actionable but has no meaningful backend behavior.
- `BE_ONLY`: backend route exists but is not referenced by frontend lib callers.
- `STUB`: frontend and backend are wired but backend returns placeholder/empty response.

## Frontend Interactive Surface Matrix

| Surface | Handler | API Call | Visible Behavior | Status |
|---|---|---|---|---|
| Top bar brand `watu` | `handleReturnHome` | none | Resets overlays/state and returns to home | WIRED |
| Top bar command input | `onOpenCommandPalette` | none | Opens command palette | WIRED |
| Families menu item | `handleSelectFamilyFromMenu` | `GET /families/{id}`, `GET /families/{id}/module` | Opens quick-drill family workspace | WIRED |
| Top bar `System` tab | `onFocusSearch` | none | Focuses diagnosis/search workspace | WIRED |
| Utilities `Master queries` | anchor | none | Opens master queries sheet in new tab | WIRED |
| Utilities `SOP guide` | anchor | none | Opens SOP guide in new tab | WIRED |
| Utilities `Open command palette` | `onOpenCommandPalette` | none | Opens command palette | WIRED |
| Top bar `Ops` | `Link /ops/login` | none | Navigates to ops sign-in | WIRED |
| Diagnosis output chip: `Issue interpretation` | `onOutputModeChange` | `POST /search` with `output_mode=issue_interpretation` | Selects output mode for next diagnosis request | WIRED |
| Diagnosis output chip: `Diagnostic path` | `onOutputModeChange` | `POST /search` with `output_mode=diagnostic_path` | Selects output mode for next diagnosis request | WIRED |
| Diagnosis output chip: `SOP action` | `onOutputModeChange` | `POST /search` with `output_mode=sop_action` | Selects output mode for next diagnosis request | WIRED |
| Diagnosis textarea submit / Run diagnosis | `runSearch` | `POST /search` | Runs diagnosis and renders results | WIRED |
| Search assist suggestion select | `applySuggestion` | `POST /search` (or external link) | Applies suggestion, runs search or opens reference link | WIRED |
| Clear search | `clearSearchInput` | none | Clears query and closes suggestions | WIRED |
| Family flow chip | `openFlow` | `POST /triage/start` (+ hydrate `GET /related/{id}`) | Starts guided triage | WIRED |
| Match card `Start guided triage` | `handleStartBestMatch` | `POST /triage/start` | Starts best-match triage (with review gate if needed) | WIRED |
| Review gate `Continue with selected flow` | `handleConfirmReviewSelection` | `POST /triage/start` | Starts selected procedure from confidence gate | WIRED |
| Recovery `Open <Family>` | `handleOpenRecoveryFamily` | `GET /families/{id}` | Opens family workspace for low-confidence/no-match recovery | WIRED |
| Recovery prompt pill | `handleRecoveryPromptSearch` | `POST /search` | Re-runs diagnosis with recovery phrase | WIRED |
| Saved progress `Continue` | `continueSession` | none | Navigates to `/triage` or `/result` from local session | WIRED |
| Saved progress `Clear` | `resetSession` | none | Clears persisted session | WIRED |
| Context panel related procedure button | `openFlow` | `POST /triage/start` | Starts selected related/recommended flow | WIRED |
| Command palette suggestion | `applySuggestion` | `POST /search` (or external link) | Selects suggestion and runs route | WIRED |
| Command palette `Guide me step-by-step` | `setModuleMode("guided")` | none | Switches workspace wording/mode | WIRED |
| Command palette `Explain this SOP` | `setModuleMode("explain")` | none | Switches workspace wording/mode | WIRED |
| Command palette `Focus diagnosis input` | `searchInputRef.current?.focus()` | none | Focuses diagnosis input | WIRED |
| Command palette `Start best-match triage` | guarded handler | `POST /triage/start` when available | Starts triage only when best-match exists; otherwise disabled + guidance | WIRED |
| Quick-drill symptom chip | `handleQuickDrillPromptSelect` | `POST /search` | Closes quick-drill and runs diagnosis from symptom | WIRED |
| Quick-drill `Start triage` | `handleQuickDrillStartTriage` | `POST /triage/start` | Starts flow from quick-drill primary track | WIRED |
| Quick-drill `Open full family workspace` | `handleQuickDrillOpenWorkspace` | `GET /families/{id}` | Opens full family workspace | WIRED |
| Triage answer `Yes/No` | `answerQuestion` | `POST /triage/next` | Advances guided triage | WIRED |
| Result page related flow button | `openRelatedFlow` | `POST /triage/start` (+ hydrate `GET /related/{id}`) | Starts selected related flow | WIRED |
| Result page feedback submit | `handleFeedbackSubmit` | `POST /feedback` | Saves operator feedback | WIRED |
| Ops login submit | `handleSubmit` | `POST /ops/login` | Signs into ops mode | WIRED |
| Ops insights load | page effect | `GET /ops/session` + protected feedback/telemetry GETs | Loads ops analytics cards/tables | WIRED |
| Ops insights sign out | `handleLogout` | `POST /ops/logout` | Clears session and returns to login | WIRED |

## Backend Route Cross-Reference Matrix

| Route | Referenced in `frontend/lib/*` | Data Shape | Status |
|---|---|---|---|
| `POST /search` | Yes (`searchProcedures`) | Real search scoring + procedure candidates | WIRED |
| `GET /ready` | Yes (`probeStartupReadiness`) | Real readiness checks + degraded states | WIRED |
| `GET /families` | Yes (`getRepairFamilies`) | Real family summaries from DB | WIRED |
| `GET /families/{family_id}` | Yes (`getRepairFamilyDetail`) | Real family details + stream cards | WIRED |
| `GET /families/{family_id}/module` | Yes (`getRepairFamilyLearningModule`) | Real track/module payload | WIRED |
| `POST /triage/start` | Yes (`startTriage`) | Real first-node/outcome triage payload | WIRED |
| `POST /triage/next` | Yes (`nextTriage`) | Real next-node/final-outcome payload | WIRED |
| `GET /related/{procedure_id}` | Yes (`getRelated`) | Real linked procedures | WIRED |
| `POST /feedback` | Yes (`submitFeedback`) | Real persisted feedback entry | WIRED |
| `GET /feedback/summary` | Yes (`getOpsFeedbackSummary`) | Real aggregated feedback metrics | WIRED |
| `GET /feedback/by-procedure` | Yes (`getOpsFeedbackByProcedure`) | Real grouped procedure metrics | WIRED |
| `GET /feedback/by-branch` | Yes (`getOpsFeedbackByBranch`) | Real grouped branch metrics | WIRED |
| `GET /feedback/by-tag` | Yes (`getOpsFeedbackByTag`) | Real grouped feedback-tag metrics | WIRED |
| `GET /feedback/language-candidates` | Yes (`getOpsFeedbackLanguageCandidates`) | Real grouped language candidates | WIRED |
| `GET /feedback/export.csv` | Yes (`getOpsFeedbackExportUrl`) | Real CSV export payload | WIRED |
| `GET /feedback/language-candidates/export.csv` | Yes (`getOpsFeedbackLanguageExportUrl`) | Real CSV export payload | WIRED |
| `POST /ops/login` | Yes (`loginOps`) | Real cookie-auth session response | WIRED |
| `POST /ops/logout` | Yes (`logoutOps`) | Real session-clear response | WIRED |
| `GET /ops/session` | Yes (`getOpsSession`) | Real auth state response | WIRED |
| `GET /ops/telemetry/summary` | Yes (`getOpsTelemetrySummary`) | Real in-memory telemetry snapshot | WIRED |
| `POST /telemetry/interaction` | Yes (`recordInteractionTelemetry`) | Real accepted interaction event | WIRED |
| `GET /health` | No | Static liveness payload | BE_ONLY |

## Priority Classification

### P0
- None found in readiness/critical-path surfaces.

### P1 (resolved in this PR)
1. Diagnosis output selectors looked actionable but were disconnected from request semantics.  
   Resolution: wired selector state into `POST /search` payload (`output_mode`).
2. Command palette `Start best-match triage` could silently no-op when no best match existed.  
   Resolution: added guard/disabled state and explicit operator guidance.

### P2 Backlog (deferred)
1. `GET /health` (`BE_ONLY`)  
   Rationale: used by infra/liveness automation, not an operator action in FE workflows.  
   Suggested Phase 3 milestone: add FE-facing diagnostics page or document as infra-only heartbeat endpoint.
