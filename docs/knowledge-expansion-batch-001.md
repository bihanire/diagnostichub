# Knowledge Expansion Batch 001

## Source

This batch is based on the first service-center complaint family set shared from operational logs.

## Complaint families captured

### 1. Display & Vision

- Common log language:
  - blacked out
  - no display
  - lines in screen
  - shaky screen
  - blurry
  - yellow light
- Primary suspects:
  - LCD/OLED panel
  - flex cable
  - GPU

### 2. Power & Thermal

- Common log language:
  - not charging
  - not powering on
  - overheating
  - drained battery
  - swollen battery
- Primary suspects:
  - battery
  - charging port
  - PMIC

### 3. Logic & Software

- Common log language:
  - freezing
  - frozen screen
  - restarts itself
  - hanging
  - safe mode
  - app issues
- Primary suspects:
  - firmware
  - RAM/CPU saturation
  - cache

### 4. Security & Access

- Common log language:
  - FRP
  - forgot password
  - forgot pattern
  - locked
  - shell managed
- Primary suspects:
  - factory reset protection
  - user credential loss

### 5. Connectivity & I/O

- Common log language:
  - not reading SIM
  - no network
  - mouthpiece
  - speaker
  - Wi-Fi/data issues
- Primary suspects:
  - SIM slot
  - antenna
  - audio IC
  - microphone

### 6. Physical & Liquid

- Common log language:
  - fell in water
  - broken screen
  - bent device
  - burnt
  - SIM tray broken
- Primary suspects:
  - external impact
  - corrosion

## Recommended modeling split

These complaint families should not all be modeled the same way.

### A. Diagnostic procedures

These are safe to model as guided yes/no troubleshooting flows.

- Display & Vision
- Power & Thermal
- Logic & Software
- Connectivity & I/O

### B. Operational or policy-led procedures

These depend more heavily on branch rules, ownership checks, access policy, or warranty framing.

- Security & Access
- Physical & Liquid

## Recommended rollout order

## Priority 1: expand current production-safe diagnostic coverage

These should be added first because the app already has nearby logic and branch officers can answer the questions safely.

1. Power & Thermal
2. Display & Vision
3. Logic & Software

## Priority 2: add guarded diagnostic flows with stronger escalation outcomes

These can be added next, but should prefer escalation-safe endpoints if confidence is low.

4. Connectivity & I/O

## Priority 3: add operational workflows with SOP overlay

These should not be deep repair trees on day one.

5. Security & Access
6. Physical & Liquid

## Procedure candidates by family

## Display & Vision

- Screen Black / No Display
- Lines, Flicker, or Shaky Screen
- Blurry or Discolored Display
- Touch and Display Combined Fault

## Power & Thermal

- Not Powering On
- Not Charging
- Overheating
- Battery Draining Fast
- Swollen Battery

## Logic & Software

- Freezing or Hanging
- Random Restart
- Safe Mode / Boot State Issue
- App Instability

## Security & Access

- FRP or Google Lock
- Forgot Password or Pattern
- Managed or Restricted Device

## Connectivity & I/O

- SIM Not Detected
- No Network or Weak Signal
- Speaker or Mouthpiece Issue
- Wi-Fi or Mobile Data Issue

## Physical & Liquid

- Liquid Contact
- Broken Screen from Impact
- Bent or Burnt Device
- Broken SIM Tray or External Damage

## Same-day rollout guidance

If rollout is happening today, use this rule:

- Full triage only for:
  - Power & Thermal
  - Display & Vision
  - Logic & Software
- Limited or escalation-safe procedures for:
  - Connectivity & I/O
  - Physical & Liquid
- Operational workflow only for:
  - Security & Access

This keeps the first live batch within branch-safe reasoning boundaries.

## How SOP should be applied

The general SOP should not define complaint families directly.
It should be used as an overlay for:

- warranty wording
- branch documentation requirements
- stolen-device process
- repair ticket logging
- replacement handling
- transfer handling
- expectation-setting scripts

## Batch 001 implementation sequence

1. Convert these six families into reviewed procedure candidates.
2. Build or extend diagnostic trees for:
   - Power & Thermal
   - Display & Vision
   - Logic & Software
3. Add operational procedures for:
   - Security & Access
4. Add escalation-safe flows for:
   - Connectivity & I/O
   - Physical & Liquid
5. Apply SOP overlays after the complaint trees are defined.
6. Dry-run the import before any production replacement.

## Data needed next

To finish Batch 001 safely, we still need:

- the relevant SOP sections for:
  - warranty
  - repair ticket logging
  - replacements
  - transfers
  - stolen-device handling
- preferred branch wording for customer-facing scripts
- confirmation of which of the six families are highest volume

## Decision

Use the service-center logs as the primary input for complaint taxonomy and decision trees.
Use the SOP only as an internal governance and policy layer.
