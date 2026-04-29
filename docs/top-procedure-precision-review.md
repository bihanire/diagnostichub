# Top Procedure Precision Review

This review tightens the five highest-value complaint flows for branch-level decision quality:

- `Phone Not Powering On`
- `Screen Issue`
- `Charging Issue`
- `Freezing, Hanging, or App Issue`
- `SIM or Network Issue`

## What changed

- Stronger branch recovery thresholds before dispatch:
  - no-power now requires known-good charging plus a forced-restart attempt before escalation
  - charging now separates reproducible port or battery-path faults from one-off behavior more clearly
  - SIM/network now distinguishes device faults from SIM, network, and location-side causes more explicitly

- Better branch-safe exits:
  - screen issues now hold back dispatch when the symptom is app-specific or settings-led
  - freezing issues now hold back dispatch when cleanup, updates, or storage relief clear the complaint
  - charging issues now hold back dispatch when the complaint is not repeatable with approved accessories

- Better evidence capture before courier handoff:
  - no-power records charger used, forced-restart attempt, heat, liquid history, swelling, and logo-loop behavior
  - screen records photos and whether the symptom persists outside one app or in Safe Mode
  - SIM/network records whether another active SIM works in the same location and whether manual network search fails

- Wider phrase capture:
  - added tags such as `stuck on logo`, `logo loop`, `display tinted`, `moisture warning`, `slow after update`, `network registration issue`, and `airplane mode reset`

## Operational intent

The aim is to reduce unnecessary service-centre sends by making officers prove three things before dispatch:

1. The symptom is reproducible.
2. The branch-level checks have actually been completed.
3. The evidence points to a device-side fault rather than an accessory, settings, app, SIM, or coverage issue.
