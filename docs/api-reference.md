# API Reference

Base URL: `http://localhost:8000`

## `POST /search`

Searches procedures from free-text input.

### Request

```json
{
  "query": "phone not turning on but vibrates"
}
```

### Response

```json
{
  "query": "phone not turning on but vibrates",
  "structured_intent": {
    "issue_type": "Power",
    "symptoms": ["phone", "power", "vibrate"]
  },
  "confidence": 0.82,
  "suggested_next_step": "Start with Phone Not Powering On, but keep the alternate matches in mind.",
  "best_match": {
    "id": 1,
    "title": "Phone Not Powering On",
    "category": "Power",
    "description": "Use this when a phone seems dead, does not start, or only vibrates without showing a screen.",
    "outcome": "Power diagnosis complete.",
    "warranty_status": "Depends on the final diagnosis and any visible damage."
  },
  "alternatives": [],
  "related": [],
  "customer_care": {
    "greeting": "Start with: 'I'll help you check the phone step by step so we can choose the safest next action.'",
    "listening": "Let the customer explain what happened before the phone stopped powering on.",
    "expectation": "Set expectation: 'This branch check takes a few quick questions, then I'll explain the next step clearly.'"
  },
  "sop_preview": {
    "immediate_action": "Confirm what the customer sees right now, then ask the guided yes or no questions.",
    "explanation": "This flow separates charger problems, deep battery drain, display faults, and hard power failures.",
    "related_actions": [
      "Check the screen issue flow if the phone vibrates but the display stays dark.",
      "Offer repair booking when the branch check points to hardware failure."
    ]
  },
  "no_match": false,
  "message": "Best match ready for guided triage."
}
```

## `POST /triage/start`

Starts a procedure flow and returns the first question.

### Request

```json
{
  "procedure_id": 1
}
```

### Response

```json
{
  "status": "question",
  "procedure": {
    "id": 1,
    "title": "Phone Not Powering On",
    "category": "Power",
    "description": "Use this when a phone seems dead, does not start, or only vibrates without showing a screen.",
    "outcome": "Power diagnosis complete.",
    "warranty_status": "Depends on the final diagnosis and any visible damage."
  },
  "current_node": {
    "id": 101,
    "question": "Does the phone show any sign of life such as vibration, sound, or a charging symbol?"
  },
  "progress": {
    "step": 1,
    "total": 3
  },
  "customer_care": {
    "greeting": "Start with: 'I'll help you check the phone step by step so we can choose the safest next action.'",
    "listening": "Let the customer explain what happened before the phone stopped powering on.",
    "expectation": "Set expectation: 'This branch check takes a few quick questions, then I'll explain the next step clearly.'"
  },
  "sop": {
    "immediate_action": "Confirm what the customer sees right now, then ask the guided yes or no questions.",
    "explanation": "This flow separates charger problems, deep battery drain, display faults, and hard power failures.",
    "related_actions": [
      "Check the screen issue flow if the phone vibrates but the display stays dark.",
      "Offer repair booking when the branch check points to hardware failure."
    ]
  },
  "outcome": null
}
```

## `POST /triage/next`

Advances the flow based on a yes/no answer.

### Request

```json
{
  "node_id": 101,
  "answer": "yes"
}
```

### Question response

```json
{
  "status": "question",
  "progress": {
    "step": 2,
    "total": 3
  },
  "next_node": {
    "id": 102,
    "question": "Is the screen black, cracked, flickering, or otherwise not showing the normal picture?"
  },
  "outcome": null,
  "related": [],
  "message": "Next question ready."
}
```

### Final response

```json
{
  "status": "complete",
  "progress": {
    "step": 3,
    "total": 3
  },
  "next_node": null,
  "outcome": {
    "diagnosis": "The phone is receiving power but the display path may be damaged.",
    "recommended_action": "Move the customer to the screen issue procedure or book display inspection.",
    "warranty_status": "Cracks or impact damage are usually not covered.",
    "related_actions": [
      "Check for visible impact marks before promising warranty support.",
      "Offer safe backup advice if the phone is still vibrating or ringing."
    ],
    "customer_care": {
      "greeting": "Start with: 'I'll help you check the phone step by step so we can choose the safest next action.'",
      "listening": "Let the customer explain what happened before the phone stopped powering on.",
      "expectation": "Set expectation: 'This branch check takes a few quick questions, then I'll explain the next step clearly.'"
    },
    "follow_up_message": "Explain that the phone appears alive, so the next check focuses on the display side."
  },
  "related": [
    {
      "id": 2,
      "title": "Screen Issue",
      "category": "Screen",
      "description": "Use this for cracked displays, black screens, flicker, lines, and touch problems.",
      "outcome": "Screen diagnosis complete.",
      "warranty_status": "Manufacturing faults may be covered. Cracks and impact damage are usually not covered."
    }
  ],
  "message": "Final recommendation ready."
}
```

## `GET /related/{procedure_id}`

Returns linked procedures for contextual follow-up.

### Example response

```json
{
  "procedure_id": 1,
  "items": [
    {
      "id": 2,
      "title": "Screen Issue",
      "category": "Screen",
      "description": "Use this for cracked displays, black screens, flicker, lines, and touch problems.",
      "outcome": "Screen diagnosis complete.",
      "warranty_status": "Manufacturing faults may be covered. Cracks and impact damage are usually not covered."
    },
    {
      "id": 4,
      "title": "Charging Issue",
      "category": "Power",
      "description": "Use this when the phone charges slowly, only charges in one position, or does not hold charge well.",
      "outcome": "Charging diagnosis complete.",
      "warranty_status": "Depends on physical condition and the final charging diagnosis."
    }
  ]
}
```

## `GET /ready`

Checks live database readiness and the last startup workflow-validation result.

### Example response

```json
{
  "status": "ok",
  "database_ok": true,
  "workflow_validation": {
    "validated_procedures": 4,
    "validated_nodes": 32,
    "error_count": 0,
    "warning_count": 0,
    "issues": []
  }
}
```

When the app is not ready, this endpoint returns HTTP `503` with the same response shape and `status: "not_ready"`.

## `POST /feedback`

Stores branch-user feedback from the result screen.

### Request

```json
{
  "helpful": true,
  "procedure_id": 1,
  "query": "phone not turning on but vibrates",
  "branch_label": "Kampala Central",
  "comment": "Guidance was clear and quick to follow.",
  "outcome_diagnosis": "The phone is receiving power but the display path may be damaged."
}
```

### Response

```json
{
  "id": 1,
  "created_at": "2026-04-27T06:55:58.176145Z",
  "message": "Thanks. Your feedback has been saved."
}
```

## `POST /ops/login`

Creates an ops session cookie for protected reporting views.

### Request

```json
{
  "password": "<shared-password>"
}
```

### Response

```json
{
  "authenticated": true,
  "expires_at": "2026-04-27T14:55:58.176145Z",
  "message": "Ops access granted."
}
```

If the password is wrong, the endpoint returns HTTP `401` with:

```json
{
  "authenticated": false,
  "message": "The password did not match. Please try again."
}
```

## `POST /ops/logout`

Clears the ops session cookie.

### Response

```json
{
  "authenticated": false,
  "message": "Ops session cleared."
}
```

## `GET /ops/session`

Returns the current ops session state for the browser.

### Example response

```json
{
  "authenticated": true,
  "expires_at": "2026-04-27T14:55:58.176145Z",
  "message": null
}
```

## `GET /feedback/summary`

Returns a lightweight summary of collected feedback.

This route now requires a valid ops session cookie.

### Example response

```json
{
  "total_submissions": 12,
  "helpful_count": 9,
  "not_helpful_count": 3,
  "latest_submissions": [
    {
      "id": 12,
      "helpful": true,
      "procedure_id": 1,
      "branch_label": "Kampala Central",
      "comment": "Guidance was clear and quick to follow.",
      "outcome_diagnosis": "The phone is receiving power but the display path may be damaged.",
      "created_at": "2026-04-27T06:55:58.176145Z"
    }
  ]
}
```

If the session is missing or invalid, the route returns HTTP `401` with:

```json
{
  "detail": "Ops access is required for this view."
}
```

## `GET /feedback/by-procedure`

Returns grouped feedback totals by procedure for the selected date range.

This route requires a valid ops session cookie.

## `GET /feedback/by-branch`

Returns grouped feedback totals by branch label for the selected date range.

This route requires a valid ops session cookie.

## `GET /feedback/language-candidates`

Returns grouped branch search phrases from saved feedback queries so the ops team can promote real wording into the benchmark pack.

This route requires a valid ops session cookie.

### Example response

```json
{
  "days": 30,
  "items": [
    {
      "normalized_query": "the phone is not charging when i insert a charger",
      "sample_query": "the phone is not charging when i insert a charger",
      "total_mentions": 3,
      "helpful_count": 2,
      "not_helpful_count": 1,
      "latest_procedure_title": "Charging Issue",
      "latest_branch_label": "Kampala Central",
      "latest_created_at": "2026-04-27T06:55:58.176145Z"
    }
  ]
}
```

## `GET /feedback/language-candidates/export.csv`

Exports the same reviewed phrase signals as CSV so the ops team can prepare benchmark-draft updates outside the app.

This route requires a valid ops session cookie.

## `GET /feedback/export.csv`

Exports recent feedback rows as CSV.

This route requires a valid ops session cookie.

## Request tracing

Every API response now includes an `X-Request-ID` header. This makes it easier to match a branch-reported issue with the backend logs.
