# Outcome Consistency Guide

This guide keeps final recommendations in the same operational voice across the whole knowledge base.

## Approved action openings

- `Resolve at branch:` use when the officer should complete the next step locally and avoid immediate repair intake.
- `Monitor at branch:` use when the issue is not yet strong enough for dispatch and the customer should return only if the symptom repeats.
- `Book repair intake:` use when the branch has enough evidence to open a defined repair path.
- `Send to service centre:` use when the device must move beyond branch handling after the required evidence is captured.
- `Continue branch processing:` use for policy, legal-status, refund, replacement, transfer, and other operational workflows that stay inside branch processing.
- `Pause and verify:` use when the officer must stop and confirm missing conditions before moving the case forward.

## Writing rules

1. Start every `recommended_action` with one approved action opening.
2. Keep the first sentence decisive and branch-usable.
3. Name the missing evidence or next system action directly.
4. Avoid vague phrasing like `handle accordingly`, `review further`, or `send for diagnosis` without conditions.
5. Use dispatch language only when the branch checks are already complete.

## Why this matters

- Officers should not need to interpret tone differences between flows.
- Ops teams should be able to scan outcomes and immediately see the branch decision class.
- The audit gate can now flag non-standard outcome openings before rollout.
