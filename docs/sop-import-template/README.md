# SOP Import Template

Use these CSV files to convert SOP content into PostgreSQL-ready DiagnosticHub knowledge.

## Files

- `procedures.csv`: one row per SOP procedure.
- `tags.csv`: searchable words and customer phrases for each procedure.
- `decision_nodes.csv`: yes/no triage questions and final outcomes.
- `linked_procedures.csv`: related procedure links.
- `search-benchmark.csv`: messy real-world queries that must keep matching the right procedures with enough confidence and enough score separation from the next-best alternative.
- feedback language candidate exports: reviewable CSVs generated from live branch feedback queries to help decide what should be promoted into `search-benchmark.csv` next.

This folder is now the canonical knowledge pack for seeded procedures. Backend seeding, validation, and tests read from this pack, so approved edits here flow straight into the app workflow.

## Authoring Rules

- Keep IDs stable once a procedure is reviewed.
- Use plain-language titles and questions.
- Start every `recommended_action` with an approved action opening from [outcome-consistency-guide.md](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/outcome-consistency-guide.md).
- Use pipe-separated lists for `related_actions`, for example `Check charger|Book repair`.
- Leave `yes_next` and `no_next` blank only when the row has a complete final outcome.
- A final outcome must include:
  - `diagnosis`
  - `recommended_action`
  - `outcome_warranty_status`
  - `follow_up_message`
- Non-final question rows should leave final outcome fields blank.

## Export Command

To refresh this folder from the current seeded knowledge base, run the exporter from the `backend` folder:

```powershell
..\venv\Scripts\python.exe -m app.db.export_sop --path ..\docs\sop-import-template
```

The exporter writes the four CSV files and validates that the generated pack can pass the same import rules the app uses.

## Audit Command

Before import, run the precision audit so you can spot shared tags, thin procedures, or flows that escalate too quickly:

```powershell
..\venv\Scripts\python.exe -m app.db.audit_sop --path ..\docs\sop-import-template --markdown ..\docs\sop-import-template\quality-report.md
```

Use `--fail-on-warnings` when you want the command to stop a release candidate until the warnings are reviewed.

## One-Step Validation

To run the audit and import dry run together from the repo root:

```powershell
.\scripts\validate-sop-pack.ps1
```

To validate and then apply the pack into the configured database:

```powershell
.\scripts\validate-sop-pack.ps1 -Apply
```

The one-step validator now runs three gates in order:

1. SOP structure and ambiguity audit
2. Import dry run
3. Search benchmark against messy branch-style queries

## Search Benchmark Command

To run the messy-query benchmark directly from the `backend` folder:

```powershell
..\venv\Scripts\python.exe -m app.db.search_benchmark --path ..\docs\sop-import-template\search-benchmark.csv --markdown ..\docs\sop-import-template\search-benchmark-report.md --fail-on-mismatch
```

Each benchmark row now protects two things:

- `minimum_confidence`: the winning match must be strong enough
- `minimum_margin`: the winning match must be far enough ahead of the next-best procedure

## Feedback Language Export

To export live branch wording from collected feedback into a review CSV:

```powershell
..\venv\Scripts\python.exe -m app.db.export_feedback_language_candidates --days 30 --limit 50 --path ..\docs\sop-import-template\feedback-language-candidates.csv
```

Use this file as the review lane between ops insights and the canonical benchmark pack:

1. review which phrases appear often
2. decide which ones deserve new benchmark rows or tags
3. add approved phrases into `search-benchmark.csv`
4. rerun `.\scripts\validate-sop-pack.ps1`

## Import Command

From the `backend` folder:

```powershell
..\venv\Scripts\python.exe -m app.db.import_sop --path ..\docs\sop-import-template --dry-run
```

When the dry run passes, import into the configured database:

```powershell
..\venv\Scripts\python.exe -m app.db.import_sop --path ..\docs\sop-import-template
```

To replace procedures with matching IDs:

```powershell
..\venv\Scripts\python.exe -m app.db.import_sop --path ..\docs\sop-import-template --replace
```
