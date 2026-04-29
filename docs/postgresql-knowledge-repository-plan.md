# PostgreSQL Knowledge Repository Plan

## Goal

Prepare the production PostgreSQL database to become the governed source of truth for DiagnosticHub procedures, SOP-derived triage flows, customer guidance, and related after-sales actions.

## Recommended Next Step

Organize the internal SOP Word document into a structured import workbook before loading it into PostgreSQL. The application already expects structured procedures and decision nodes, so converting the SOP directly into database-ready rows will be safer than storing the SOP as a large text blob.

## Repository Structure

### 1. Procedures

Each SOP topic should become one procedure.

Required fields:

- `title`: Plain-language procedure name, for example `Phone Not Powering On`.
- `category`: Operational category, for example `Power`, `Screen`, `Charging`, `Account`, `Warranty`.
- `description`: When branch staff should use this procedure.
- `immediate_action`: First instruction shown to the officer.
- `explanation`: Why the procedure exists and what it separates.
- `warranty_status`: Default warranty framing before final diagnosis.

### 2. Search Tags

Each procedure needs searchable language that branch staff and customers actually use.

Examples:

- Customer phrases: `phone is dead`, `screen is black`, `lost phone`.
- Staff phrases: `no power`, `display fault`, `charging port`.
- Common misspellings or informal wording where useful.

### 3. Decision Nodes

Each SOP diagnostic path should be converted into yes/no questions.

Rules:

- One question per node.
- Questions should be answerable at the branch without deep technical tools.
- Each question should point to either another question or a final outcome.
- If an SOP step requires escalation, make that a final outcome rather than another vague question.

### 4. Final Outcomes

Each branch of a triage flow should end in a clear outcome.

Required fields:

- `diagnosis`: What the branch officer can reasonably conclude.
- `recommended_action`: What to do next.
- `warranty_status`: How to frame warranty without over-promising.
- `related_actions`: Other procedures or checks that may help.
- `follow_up_message`: Customer-friendly explanation.

### 5. Related Procedures

Use related links when one procedure naturally leads to another.

Examples:

- `Phone Not Powering On` links to `Screen Issue` and `Charging Issue`.
- `Stolen Phone` links to ownership verification, SIM replacement, or account security.

## PostgreSQL Readiness Checklist

- Confirm the target database name, user, host, and port.
- Create a non-admin application user for DiagnosticHub.
- Keep `backend/.env` pointed at PostgreSQL for production-like runs.
- Add a repeatable seed/import command for SOP-derived data.
- Add a backup/export routine before replacing production knowledge.
- Add validation checks for missing questions, broken node links, duplicate tags, and incomplete outcomes.

## SOP Conversion Workflow

1. Extract the internal SOP Word document into a structured table.
2. Group content by procedure.
3. Convert each procedure into:
   - procedure metadata
   - tags
   - decision questions
   - final outcomes
   - related procedure links
4. Review the converted flows with operations staff.
5. Import into a staging PostgreSQL database.
6. Run backend tests and smoke tests against staging.
7. Promote the reviewed data into the production database.

## Proposed Import Format

Use a spreadsheet or CSV set with these tabs/files:

- `procedures`
- `tags`
- `decision_nodes`
- `linked_procedures`

This keeps review easy for non-engineers while still mapping cleanly into PostgreSQL.

The starter template is available in `docs/sop-import-template/`.

Validate it without writing to the database:

```powershell
cd backend
..\venv\Scripts\python.exe -m app.db.import_sop --path ..\docs\sop-import-template --dry-run
```

Import reviewed SOP rows into the configured database:

```powershell
cd backend
..\venv\Scripts\python.exe -m app.db.import_sop --path ..\docs\sop-import-template
```

Use `--replace` only when intentionally overwriting procedures with matching IDs.

## Near-Term Implementation Tasks

1. Use the SOP conversion template for operations review.
2. Load the first complete SOP category as a pilot.
3. Add backup/export before replacing production knowledge.
4. Test the current app against the real PostgreSQL database.
5. Expand validation as new SOP edge cases appear.

## Recommendation

Start with one high-value SOP category, not the whole document. A focused pilot will reveal wording gaps, duplicate procedures, and unclear decision points before the entire knowledge base is imported.
