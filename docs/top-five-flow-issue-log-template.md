# Top Five Flow Issue Log Template

Use this template while running the focused UAT pack.

## Fields to capture per issue

- `date`
- `branch`
- `tester name`
- `flow`
- `search phrase used`
- `expected result`
- `actual result`
- `issue type`
- `severity`
- `notes`
- `recommended action`

## Issue type options

- `search mismatch`
- `wrong flow opened`
- `question unclear`
- `over-escalated to dispatch`
- `under-escalated`
- `customer wording unnatural`
- `missing branch check`
- `missing evidence requirement`
- `performance or UI issue`

## Severity guide

- `critical`
  - would cause repeated wrong dispatch or wrong customer action
- `high`
  - likely to confuse officers or create avoidable courier cost
- `medium`
  - understandable but still rough or incomplete
- `low`
  - polish issue that does not affect the decision outcome

## Simple table format

| Date | Branch | Flow | Search phrase | Expected | Actual | Issue type | Severity | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-04-27 | Kampala Central | Charging Issue | phone only charges when cable is bent | branch should confirm port evidence first | escalated too early | over-escalated to dispatch | high | tighten port evidence wording |
