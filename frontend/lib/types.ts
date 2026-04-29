export type ProcedureSummary = {
  id: number;
  title: string;
  category: string;
  description: string;
  outcome?: string | null;
  warranty_status?: string | null;
};

export type RepairFamilySummary = {
  id: string;
  title: string;
  hint: string;
  symptom_prompts: string[];
  procedure_count: number;
};

export type RepairFamilyDetail = {
  id: string;
  title: string;
  hint: string;
  diagnostic_goal: string;
  symptom_prompts: string[];
  focus_cards: {
    title: string;
    description: string;
  }[];
  common_categories: {
    title: string;
    description: string;
    search_examples: string[];
    primary_procedure: ProcedureSummary;
    supporting_procedures: ProcedureSummary[];
  }[];
  procedure_groups: {
    title: string;
    description: string;
    procedures: ProcedureSummary[];
  }[];
  branch_checks: string[];
  escalation_signals: string[];
  procedures: ProcedureSummary[];
};

export type CustomerCare = {
  greeting: string;
  listening: string;
  expectation: string;
};

export type SopLayers = {
  immediate_action: string;
  explanation?: string | null;
  related_actions: string[];
};

export type DecisionNodePayload = {
  id: number;
  question: string;
};

export type ProgressPayload = {
  step: number;
  total: number;
};

export type FinalOutcomePayload = {
  diagnosis: string;
  recommended_action: string;
  decision_type: string;
  decision_label: string;
  warranty_status?: string | null;
  warranty_assessment: {
    direction: string;
    label: string;
    confidence: string;
    reasons: string[];
  };
  branch_playbook: {
    title: string;
    steps: string[];
  };
  related_actions: string[];
  evidence_checklist: string[];
  customer_care: CustomerCare;
  follow_up_message: string;
};

export type SearchResponse = {
  query: string;
  structured_intent: {
    issue_type?: string | null;
    symptoms: string[];
  };
  confidence: number;
  confidence_state: string;
  confidence_margin: number;
  needs_review: boolean;
  review_message?: string | null;
  suggested_next_step: string;
  best_match?: ProcedureSummary | null;
  alternatives: ProcedureSummary[];
  related: ProcedureSummary[];
  customer_care?: CustomerCare | null;
  sop_preview?: SopLayers | null;
  no_match: boolean;
  message: string;
};

export type TriageStartResponse = {
  status: "question" | "complete";
  procedure: ProcedureSummary;
  current_node?: DecisionNodePayload | null;
  progress: ProgressPayload;
  customer_care: CustomerCare;
  sop: SopLayers;
  outcome?: FinalOutcomePayload | null;
};

export type TriageNextResponse = {
  status: "question" | "complete";
  progress: ProgressPayload;
  next_node?: DecisionNodePayload | null;
  outcome?: FinalOutcomePayload | null;
  related: ProcedureSummary[];
  message?: string | null;
};

export type RelatedResponse = {
  procedure_id: number;
  items: ProcedureSummary[];
};

export type FeedbackCreateRequest = {
  helpful: boolean;
  procedure_id?: number | null;
  query?: string | null;
  branch_label?: string | null;
  comment?: string | null;
  outcome_diagnosis?: string | null;
  feedback_tags?: string[];
  triage_trace?: TriageAnswerRecord[];
  final_decision_label?: string | null;
  search_confidence?: number | null;
  search_confidence_state?: string | null;
};

export type FeedbackCreateResponse = {
  id: number;
  created_at: string;
  message: string;
};

export type FeedbackEntryPayload = {
  id: number;
  helpful: boolean;
  procedure_id?: number | null;
  branch_label?: string | null;
  comment?: string | null;
  outcome_diagnosis?: string | null;
  feedback_tags: string[];
  final_decision_label?: string | null;
  triage_trace: TriageAnswerRecord[];
  created_at: string;
};

export type FeedbackSummaryResponse = {
  total_submissions: number;
  helpful_count: number;
  not_helpful_count: number;
  latest_submissions: FeedbackEntryPayload[];
};

export type ProcedureFeedbackBreakdownItem = {
  procedure_id?: number | null;
  procedure_title: string;
  total_submissions: number;
  helpful_count: number;
  not_helpful_count: number;
};

export type ProcedureFeedbackBreakdownResponse = {
  days: number;
  items: ProcedureFeedbackBreakdownItem[];
};

export type BranchFeedbackBreakdownItem = {
  branch_label: string;
  total_submissions: number;
  helpful_count: number;
  not_helpful_count: number;
};

export type BranchFeedbackBreakdownResponse = {
  days: number;
  items: BranchFeedbackBreakdownItem[];
};

export type FeedbackLanguageCandidateItem = {
  normalized_query: string;
  sample_query: string;
  total_mentions: number;
  helpful_count: number;
  not_helpful_count: number;
  latest_procedure_title?: string | null;
  latest_branch_label?: string | null;
  latest_created_at?: string | null;
};

export type FeedbackLanguageCandidateResponse = {
  days: number;
  items: FeedbackLanguageCandidateItem[];
};

export type FeedbackTagBreakdownItem = {
  tag: string;
  total_submissions: number;
  helpful_count: number;
  not_helpful_count: number;
};

export type FeedbackTagBreakdownResponse = {
  days: number;
  items: FeedbackTagBreakdownItem[];
};

export type OpsSessionResponse = {
  authenticated: boolean;
  expires_at?: string | null;
  message?: string | null;
};

export type FeedbackSnapshot = {
  id: number;
  helpful: boolean;
  branch_label?: string | null;
  comment?: string | null;
  feedback_tags?: string[];
  submitted_at: string;
};

export type TriageAnswerRecord = {
  node_id: number;
  question: string;
  answer: "yes" | "no";
};

export type TriageSession = {
  query?: string;
  searchConfidence?: number | null;
  searchConfidenceState?: string | null;
  searchConfidenceMargin?: number | null;
  searchNeedsReview?: boolean;
  procedure: ProcedureSummary;
  currentNode?: DecisionNodePayload | null;
  progress: ProgressPayload;
  customerCare: CustomerCare;
  sop: SopLayers;
  outcome?: FinalOutcomePayload | null;
  related: ProcedureSummary[];
  history: TriageAnswerRecord[];
  feedback?: FeedbackSnapshot | null;
  dispatchGateConfirmed?: string[];
  updatedAt: string;
};
