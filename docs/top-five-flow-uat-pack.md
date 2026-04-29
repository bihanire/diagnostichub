# Top Five Flow UAT Pack

Use this pack to validate the five highest-volume triage flows before wider rollout:

- `Phone Not Powering On`
- `Screen Issue`
- `Charging Issue`
- `Freezing, Hanging, or App Issue`
- `SIM or Network Issue`

## UAT goal

Confirm that branch officers can:

1. choose the right flow from real customer wording
2. complete the triage without coaching
3. avoid dispatch when the issue is branch-solvable
4. collect the right evidence when dispatch is truly needed

## Test setup

- Run on a phone or low-end laptop where possible.
- Use normal branch wording, not technical lab language.
- Test with one officer driving and one reviewer recording.
- Record whether the final action was:
  - `branch resolution`
  - `monitor and return`
  - `repair intake`
  - `service-centre dispatch`

## Flow 1: Phone Not Powering On

### Scenario A: deep drain or recovery case

Search phrase:

`the phone went off and was not coming on but now it vibrates after charge`

Expected:

- lands on `Phone Not Powering On`
- does not jump straight to dispatch
- guides the officer through charger and restart checks
- ends in a branch-safe monitoring or charging-related outcome if recovery happens

### Scenario B: true no-life case

Search phrase:

`phone is dead no life after charging and force restart`

Expected:

- lands on `Phone Not Powering On`
- requires evidence that known-good charging and forced restart were attempted
- escalates only after those checks fail

### Review questions

- Did the flow prevent premature dispatch?
- Did the officer understand what counts as a completed branch check?
- Was the final escalation threshold defensible?

## Flow 2: Screen Issue

### Scenario A: app-specific or settings-led complaint

Search phrase:

`screen is yellow only in one app`

Expected:

- lands on `Screen Issue`
- does not push hardware repair too early
- directs the officer toward settings or app checks first

### Scenario B: persistent display fault

Search phrase:

`lines in screen and touch not working after restart`

Expected:

- lands on `Screen Issue`
- confirms the issue persists outside one app
- moves toward inspection only after that is clear

### Review questions

- Did the officer know when to avoid quoting repair too early?
- Did the flow separate visible damage from app-only behavior clearly?

## Flow 3: Charging Issue

### Scenario A: accessory-side complaint

Search phrase:

`phone charges with another charger`

Expected:

- lands on `Charging Issue`
- ends without repair intake
- clearly states that the device should not be dispatched yet

### Scenario B: port or charging-path complaint

Search phrase:

`phone only charges when cable is bent and shows moisture warning`

Expected:

- lands on `Charging Issue`
- treats moisture or visible port issues carefully
- escalates only with clear port-side evidence

### Review questions

- Did the flow stop the branch from sending out non-reproducible charging complaints?
- Was the moisture or port guidance clear and safe?

## Flow 4: Freezing, Hanging, or App Issue

### Scenario A: one-app complaint

Search phrase:

`only whatsapp keeps freezing`

Expected:

- lands on `Freezing, Hanging, or App Issue`
- stays branch-side
- points to app troubleshooting before repair

### Scenario B: persistent device-wide instability

Search phrase:

`phone keeps freezing across apps even after restart and storage cleanup`

Expected:

- lands on `Freezing, Hanging, or App Issue`
- confirms branch checks were done first
- escalates only after the issue remains across several apps

### Review questions

- Did the officer know the difference between an app problem and a phone problem?
- Did the flow avoid sending software-load cases out too early?

## Flow 5: SIM or Network Issue

### Scenario A: SIM or coverage-side complaint

Search phrase:

`my line has no network but another sim works in the same phone`

Expected:

- lands on `SIM or Network Issue`
- avoids dispatch
- routes the officer toward SIM, registration, or coverage checks

### Scenario B: device-side network complaint

Search phrase:

`another active sim also fails and manual network search does not work`

Expected:

- lands on `SIM or Network Issue`
- records that another active SIM was tested in the same location
- escalates only after that evidence is clear

### Review questions

- Did the flow clearly separate line-side issues from device-side issues?
- Would the branch avoid courier cost for cases solved by SIM or network checks?

## Pass criteria for each flow

- the officer can finish the flow without facilitator help
- the final action is understandable
- the branch checks feel realistic and not overly technical
- the flow does not over-escalate a case that can be handled locally
- the flow does not under-escalate a case with strong device-side evidence

## What to record

- search phrase used
- first matched procedure
- any confusing question
- any point where the officer wanted to dispatch too early
- any point where the officer felt blocked from a necessary dispatch
- whether the final outcome felt correct
- whether the customer wording felt natural
