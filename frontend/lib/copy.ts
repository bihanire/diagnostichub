export const reviewWindowOptions = [7, 30, 90] as const;

export const quickQueries = [
  { label: "Screen issue", query: "screen issue", hint: "Open a likely display flow faster" },
  {
    label: "Not powering on",
    query: "phone not powering on",
    hint: "Start with the main power checks"
  },
  { label: "Stolen phone", query: "stolen phone", hint: "Open the theft and recovery flow" }
] as const;

export const feedbackTagOptions = [
  { value: "wrong_match", label: "Wrong match" },
  { value: "confusing_question", label: "Confusing question" },
  { value: "too_many_steps", label: "Too many steps" },
  { value: "should_have_solved_at_branch", label: "Should have solved at branch" },
  { value: "should_have_escalated_sooner", label: "Should have escalated sooner" }
] as const;

export const uiCopy = {
  meta: {
    title: "Diagnosis Hub",
    description: "Guided after-sales decision support for branch teams."
  },
  global: {
    skipLink: "Skip to main content",
    offlineBanner:
      "You are offline. New searches and next steps will resume when the connection returns.",
    slowNetworkBanner:
      "Network is weak or data saver is on. Keep searches short and allow a little extra time.",
    backToApp: "Back to app",
    backToSearch: "Back to search",
    startNewCase: "Start a new case"
  },
  home: {
    hero: {
      eyebrow: "Watu Simu",
      title: "Simu Triage and Diagnosis Hub",
      description: "Describe the problem or start from the visible issue."
    },
    savedProgress: {
      eyebrow: "Saved progress",
      title: "Continue saved case",
      continueLabel: "Continue saved case",
      clearLabel: "Clear saved case",
      savedDeviceSuffix: "saved on this device."
    },
    search: {
      placeholder:
        "Example: phone is not turning on but it vibrates when I hold the power button",
      submitLabel: "Find the best flow",
      submittingLabel: "Searching...",
      emptyQuery: "Describe the problem first.",
      searchFailure: "Search failed. Please try again.",
      flowFailure: "Could not start the guided flow.",
      footerLink: "Open ops insights"
    },
    intent: {
      eyebrow: "Structured intent",
      title: "What the system heard"
    },
    noMatch: {
      eyebrow: "No strong match",
      title: "Try another description"
    },
    suggestions: {
      alternativesTitle: "Other possible procedures",
      alternativesEmpty: "No close alternatives were found.",
      relatedTitle: "Related procedures to keep in mind",
      relatedEmpty: "No linked procedures were found for this issue."
    }
  },
  matchCard: {
    eyebrow: "Best match",
    matchSuffix: "match",
    categoryLabel: "Category",
    warrantyReviewed: "Warranty reviewed in flow",
    secondaryGuideTitle: "Optional opening guide",
    firstLineLabel: "First line to use",
    listeningLabel: "Listen for",
    cautionEyebrow: "Review closely",
    cautionTitle: "Closest flow, but confirm carefully",
    cautionStrongTitle: "Strong match ready",
    cautionMarginLabel: "Match separation",
    busyLabel: "Opening...",
    startLabel: "Start guided triage"
  },
  suggestions: {
    eyebrow: "Suggested next steps"
  },
  careGuide: {
    eyebrow: "Customer guidance",
    secondaryEyebrow: "After diagnosis",
    title: "Customer wording",
    greetingLabel: "Open well",
    listeningLabel: "Listen for",
    expectationLabel: "Set expectation"
  },
  progress: {
    eyebrow: "Guided triage",
    note: "Keep each answer tied to what you can confirm now."
  },
  triage: {
    fallback: {
      eyebrow: "Guided triage",
      missingSessionTitle: "Assessment not ready.",
      missingSessionDescription: "Go back to the search screen to start a new case.",
      missingNodeTitle: "The next question is missing.",
      missingNodeDescription:
        "Return to search and restart the case, or escalate for manual review."
    },
    caseFrame: {
      eyebrow: "Case frame",
      title: "Current description",
      directStartFallback: "This case was started directly from a selected procedure."
    },
    flowPurpose: {
      eyebrow: "Diagnosis focus",
      title: "Why this triage path matters",
      fallback:
        "This step helps the branch team separate a quick branch fix from a case that truly needs service centre handling."
    },
    reminder: {
      eyebrow: "Officer reminder",
      title: "Keep it precise",
      description:
        "Answer from what is visible or confirmed at hand. If the customer is unsure, keep the answer conservative and continue with the branch-safe path."
    },
    heroLead: "Answer from what the officer can confirm on the device right now.",
    question: {
      eyebrow: "Current question"
    },
    answerStrip: {
      eyebrow: "Answer this question",
      description: "Choose the clearest answer for the current question.",
      yes: {
        label: "Yes, confirmed",
        busyLabel: "Saving...",
        note: "Use this only when the sign is clearly seen or confirmed."
      },
      no: {
        label: "No, not confirmed",
        busyLabel: "Saving...",
        note: "Use this when the sign is absent, unclear, or not confirmed."
      }
    },
    expectation: {
      eyebrow: "Keep the customer with you",
      title: "Expectation setting"
    },
    pauseLabel: "Pause and return later",
    nextStepFailure: "Could not load the next step."
  },
  result: {
    fallback: {
      eyebrow: "Outcome",
      title: "No result is ready yet.",
      description: "Return to the guided flow or start a new search."
    },
    hero: {
      eyebrow: "Aftersales decision",
      department: "Watu Simu",
      footerLabel: "Branch recommendation"
    },
    summary: {
      eyebrow: "Case summary",
      title: "What this case started with",
      flowComplete: "Flow complete",
      directProcedureFallback:
        "This result came from a directly selected procedure rather than a typed description."
    },
    primary: {
      eyebrow: "Diagnosis and triage"
    },
    playbook: {
      eyebrow: "Branch playbook",
      title: "What the officer should do next"
    },
    warrantyDirection: {
      eyebrow: "Warranty direction",
      title: "How this warranty path looks right now",
      confidenceLabel: "Confidence"
    },
    operational: {
      eyebrow: "Operational follow-up"
    },
    relatedFlows: {
      eyebrow: "Related flows"
    },
    threshold: {
      title: "Do not send yet unless these are true",
      description:
        "Use this threshold before repair intake or service-centre routing so branch-solvable cases do not leave the branch too early."
    },
    gate: {
      readyLabel: "Dispatch gate cleared",
      progressPrefix: "Confirmed",
      progressSuffix: "checks",
      prompt: "Mark each branch check only after it is truly complete.",
      empty: "No branch handover gate is needed for this decision."
    },
    actionCard: {
      decisionEyebrow: "Decision",
      decisionTitle: "Branch decision",
      actionEyebrow: "Action",
      actionTitle: "Action to take now",
      diagnosisEyebrow: "Diagnosis",
      diagnosisTitle: "Diagnosis",
      warrantyEyebrow: "Warranty",
      warrantyTitle: "Warranty status",
      warrantyFallback: "Review the case terms before confirming warranty."
    },
    evidence: {
      eyebrow: "Before handover",
      title: "Confirm this evidence first",
      description:
        "Use this short checklist before repair intake or service-centre routing so the next team receives a cleaner case."
    },
    relatedActions: {
      eyebrow: "Related actions",
      title: "Operational follow-up"
    },
    suggestions: {
      title: "You might also need",
      empty: "No linked procedures are available for this result."
    },
    feedback: {
      eyebrow: "Help improve this tool",
      title: "Was this guidance helpful?",
      alreadySavedPrefix: "Thank you. This case was marked as",
      helpfulLabel: "helpful",
      notHelpfulLabel: "not helpful",
      branchPrefix: "Branch",
      notePrefix: "Note saved",
      helpfulChoice: "Yes, it helped",
      notHelpfulChoice: "No, it needs work",
      branchLabel: "Branch name or code (optional)",
      branchPlaceholder: "Example: Kampala Central",
      tagsLabel: "What should we flag for UAT review? (optional)",
      commentLabel: "What should we keep or improve? (optional)",
      commentPlaceholder: "Please avoid customer names or other private details.",
      submitLabel: "Send feedback",
      submittingLabel: "Saving feedback...",
      chooseHelpfulness: "Choose whether this recommendation helped before sending feedback.",
      saveFailure: "Could not save your feedback.",
      openRelatedFailure: "Could not open the related flow.",
      relatedFlowBusy: "Opening related flow..."
    }
  },
  insights: {
    hero: {
      eyebrow: "Ops insights",
      title: "Review branch feedback and spot weak procedures fast.",
      description:
        "Use this internal view to see what branch teams find helpful, where guidance is struggling, and which procedures need sharper wording or cleaner routing next.",
      chips: ["Protected review area", "Feedback-led updates", "Export-ready"],
      sideEyebrow: "At a glance",
      sideDescription:
        "Use this view to decide what the content team should refine next, not just to count usage.",
      metrics: {
        feedbackCases: "feedback cases in scope",
        helpfulRate: "current helpful rate",
        writtenNotes: "written notes to review"
      },
      sessionStatusPrefix: "Session status",
      sessionActiveLabel: "Session active"
    },
    checking: {
      eyebrow: "Ops access",
      title: "Checking your access",
      description: "Please wait while we confirm your ops session."
    },
    cards: {
      topFlowEyebrow: "Most used flow",
      topFlowFallback: "No procedure data yet",
      topFlowEmpty: "Procedure usage will appear here once feedback starts coming in.",
      needsAttentionEyebrow: "Needs attention",
      needsAttentionFallback: "No weak signal yet",
      needsAttentionEmpty: "No procedure currently stands out as a frustration hotspot.",
      activeBranchEyebrow: "Most active branch",
      activeBranchFallback: "No branch labels yet",
      activeBranchEmpty:
        "Branch-labelled usage will appear here as teams add branch names or codes."
    },
    controls: {
      eyebrow: "Review controls",
      title: "Choose a review window",
      exportLabel: "Export CSV",
      exportLanguageLabel: "Export phrase review CSV",
      signOutLabel: "Sign out",
      signingOutLabel: "Signing out..."
    },
    summary: {
      eyebrow: "Overview",
      title: "Feedback summary",
      loadingLabel: "Loading insights...",
      loadFailure: "Could not load the insights view.",
      totalEyebrow: "Total",
      helpfulEyebrow: "Helpful",
      needsWorkEyebrow: "Needs work",
      helpfulRateSuffix: "helpful rate",
      submissionsSuffix: "Submissions in the selected window",
      needsWorkSuffix: "Cases marked not helpful"
    },
    procedures: {
      eyebrow: "By procedure",
      title: "Where guidance helps most",
      empty: "No procedure feedback has been captured in this date range."
    },
    branches: {
      eyebrow: "By branch",
      title: "Which teams are using the tool most",
      empty: "No branch-labelled feedback has been captured in this date range."
    },
    tags: {
      eyebrow: "UAT signals",
      title: "Which issues appear most in feedback",
      empty: "No structured UAT issue tags have been captured in this date range."
    },
    languageSignals: {
      eyebrow: "Language signals",
      title: "Which branch phrases should shape search next",
      description:
        "Use these live phrases to decide what should be added to the benchmark pack, tags, or wording review next.",
      sampleQueryColumn: "Sample phrase",
      mentionsColumn: "Mentions",
      helpfulColumn: "Helpful",
      needsWorkColumn: "Needs work",
      latestFlowColumn: "Latest flow",
      latestBranchColumn: "Latest branch",
      empty: "No branch search phrases are available in this date range.",
      unspecifiedBranch: "Unspecified branch"
    },
    notes: {
      eyebrow: "Recent notes",
      title: "What branch officers are saying",
      helpfulLabel: "Helpful",
      notHelpfulLabel: "Needs work",
      healthySignal: "Healthy signal",
      reviewNeeded: "Review needed",
      unspecifiedBranch: "Unspecified branch",
      emptyComment: "No written note was left for this submission.",
      emptyDiagnosis: "No diagnosis snapshot saved.",
      tagsPrefix: "Tags",
      decisionPrefix: "Decision",
      empty: "No recent comments are available yet."
    }
  },
  opsLogin: {
    hero: {
      eyebrow: "Ops access",
      title: "Sign in to review branch insights.",
      description:
        "This internal area helps operations teams review branch feedback, spot weak flows, and decide what guidance needs improvement next.",
      chips: ["Protected", "Feedback-led", "Internal review"],
      sideEyebrow: "Before you continue",
      sideDescription:
        "Use the shared operations password. Keep customer-private information out of free-form notes even inside the internal view."
    },
    form: {
      eyebrow: "Shared sign-in",
      title: "Enter the internal access password",
      checkingLabel: "Checking current access...",
      fieldLabel: "Shared password",
      placeholder: "Enter the shared password",
      emptyPassword: "Enter the shared ops password first.",
      invalidPassword: "The password did not match. Please try again.",
      submitLabel: "Sign in",
      submittingLabel: "Signing in...",
      signInFailure: "Could not sign you in right now."
    }
  }
} as const;

export function getReviewWindowLabel(days: number): string {
  return `Last ${days} days`;
}

export function getFeedbackTagLabel(tag: string): string {
  return feedbackTagOptions.find((item) => item.value === tag)?.label || tag;
}
