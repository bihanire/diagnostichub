# Samsung Specialization Plan

## Goal

Keep the core complaint taxonomy stable while making the branch experience feel Samsung-native, more predictive, and less likely to send branch-solvable devices to the service centre.

## Current approach

1. Canonical procedure pack
The source of truth stays in [docs/sop-import-template](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/sop-import-template).

2. Samsung guidance overlay
The runtime layer in [samsung_guidance_service.py](/C:/Users/eatugonza/Documents/projects/diagnostichub/backend/app/services/samsung_guidance_service.py) adds Galaxy-specific customer-care wording, branch checks, and service handover advice without mutating the canonical procedure data.

3. Sentence-first search growth
Real branch wording should be promoted into [search-benchmark.csv](/C:/Users/eatugonza/Documents/projects/diagnostichub/docs/sop-import-template/search-benchmark.csv) so every new phrase becomes a protected regression case before it is trusted in rollout.

4. Feedback-to-content loop
Ops should review unclear or low-help cases in `/insights`, then convert strong new wording into:
- tags in the canonical procedure pack
- benchmark cases in the search benchmark pack
- policy or guidance refinements only where needed

## Samsung-specific design principles

- Prefer branch-resolvable Samsung checks before courier escalation.
- Use Samsung Galaxy wording in customer-facing scripts.
- Reference Samsung-native tools where they help branch diagnosis:
  - Samsung Members diagnostics
  - Battery and device care
  - Safe mode
  - Samsung Find / Find My Mobile
  - Maintenance mode before service handover
- Keep warranty, dispatch, and compliance logic inside the existing operational workflows.

## Content growth sequence

1. Add real branch phrases from logs to the benchmark pack.
2. Expand tags only when the benchmark shows a search gap.
3. Refine decision questions only when a branch check can prevent an unnecessary courier send.
4. Keep Samsung operational wording in the overlay layer unless the canonical procedure itself truly changes.

## Rollout rule

No search wording expansion should be treated as production-ready until all three gates pass:

1. SOP audit
2. import dry run
3. search benchmark

Run:

```powershell
.\scripts\validate-sop-pack.ps1
```
