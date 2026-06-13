export type ProcedureSummary = {
  id: number;
  title: string;
  category: string;
  description: string;
  outcome?: string | null;
  warranty_status?: string | null;
  src_group?: string | null;
  primary_t_code?: string | null;
};

export type RepairFamilySummary = {
  id: string;
  title: string;
  hint: string;
  symptom_prompts: string[];
  procedure_count: number;
};

export type RepairFamilySignalEntry = {
  key: string;
  summary: string;
  priority: "critical" | "primary" | "secondary" | string;
  source: string;
  signature: string;
  signature_label: string;
  occurrence_count: number;
  first_seen_order: number;
  related_procedures: ProcedureSummary[];
  technical_notes: string[];
};

export type RepairFamilySignalCluster = {
  signature: string;
  signature_label: string;
  priority: "critical" | "primary" | "secondary" | string;
  total_occurrences: number;
  entries: RepairFamilySignalEntry[];
};

export type RepairFamilySignalStream = {
  original_event_count: number;
  deduplicated_event_count: number;
  critical_entries: RepairFamilySignalEntry[];
  need_to_know_entries: RepairFamilySignalEntry[];
  nice_to_know_entries: RepairFamilySignalEntry[];
  clusters: RepairFamilySignalCluster[];
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
  in_family_stream: RepairFamilySignalStream;
  procedures: ProcedureSummary[];
};

export type RepairFamilyLearningTrack = {
  procedure: ProcedureSummary;
  track_title: string;
  track_summary: string;
  first_question?: string | null;
  guided_steps: number;
  related_suggestions: ProcedureSummary[];
};

export type RepairFamilyLearningModule = {
  id: string;
  title: string;
  hint: string;
  diagnostic_goal: string;
  symptom_prompts: string[];
  tracks: RepairFamilyLearningTrack[];
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
  src_group?: string | null;
  primary_t_code?: string | null;
};

export type SearchResponse = {
  query: string;
  structured_intent: {
    issue_type?: string | null;
    symptoms: string[];
  };
  semantic_insight?: {
    normalized_query: string;
    key_terms: string[];
    ambiguity_risk: string;
    intent_strength: number;
    matched_category_signals: Record<string, number>;
  } | null;
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
  triage_trace: Record<string, unknown>[];
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

export type InteractionTelemetryEvent =
  | "confidence_gate_shown"
  | "confidence_gate_option_selected"
  | "confidence_gate_confirmed"
  | "confidence_gate_dismissed"
  | "no_match_recovery_family_opened"
  | "no_match_recovery_prompt_used"
  | "best_match_direct_started";

export type InteractionTelemetryPayload = {
  event: InteractionTelemetryEvent;
  status?: "info" | "success" | "review";
  metadata?: Record<string, string>;
};

export type InteractionTelemetryResponse = {
  accepted: boolean;
};

export type OpsTelemetrySummaryResponse = {
  generated_at: string;
  uptime_seconds: number;
  total_http_requests: number;
  active_endpoints: number;
  search: {
    total_searches: number;
    no_match_count: number;
    review_required_count: number;
    top_issue_types: Record<string, number>;
    confidence_states: Record<string, number>;
    ambiguity_risk_counts: Record<string, number>;
  };
  interaction: {
    total_events: number;
    event_counts: Record<string, number>;
  };
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

export type DeviceItem = {
  id: number;
  model_name: string;
  samsung_code: string;
  storage_gb?: number | null;
  ram_gb?: number | null;
  bom_version?: string | null;
  auto_blocker_required: boolean;
  display_label: string;
};

export type DeviceListResponse = {
  devices: DeviceItem[];
};

export type PartsPredictionItem = {
  part_name: string;
  part_category?: string | null;
};

export type PartsPredictionResponse = {
  t_code: string;
  parts: PartsPredictionItem[];
  directional_note: string;
};

export type DispatchRouteRequest = {
  src_group: string | null;
  primary_t_code: string | null;
  warranty_direction: "IW" | "OW" | null;
  warranty_needs_review: boolean;
  procedure_id?: number | null;
};

export type DispatchRouteResponse = {
  ls_code: string | null;
  service_center: string | null;
  route_note: string;
  escalate: boolean;
  dispatch_class: "iw_hardware" | "ow_hardware" | "customer_request" | "needs_review";
  pre_dispatch_checklist: string[];
};

export type WarrantyNextRequest = {
  primary_t_code: string;
  answers: ("yes" | "no")[];
};

export type WarrantyNextResponse = {
  status: "question" | "complete";
  question_index: number | null;
  question: string | null;
  warranty_direction: "IW" | "OW" | null;
  wty_exception: string | null;
  needs_review: boolean;
  auto_skipped: boolean;
};

export type TriageSession = {
  query?: string;
  learningFamilyId?: string | null;
  learningFamilyTitle?: string | null;
  learningTrackTitle?: string | null;
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
  warrantyComplete?: boolean;
  warrantyAutoSkipped?: boolean;
  warrantyDirection?: "IW" | "OW" | null;
  warrantyException?: string | null;
  warrantyNeedsReview?: boolean;
  warrantyAnswers?: ("yes" | "no")[];
  device?: DeviceItem | null;
  updatedAt: string;
};

export type CasePacket = {
  id: string;
  schemaVersion: "diagnostichub.case_packet.v1";
  source: "diagnostic_hub";
  eventName: "diagnostic.case.completed" | "diagnostic.case.in_progress";
  createdAt: string;
  idempotencyKey: string;
  privacyClassification: "internal_operational" | "contains_customer_free_text";
  query: string;
  family: {
    id?: string | null;
    title?: string | null;
    trackTitle?: string | null;
  };
  procedure: ProcedureSummary;
  answers: TriageAnswerRecord[];
  diagnosis?: string | null;
  recommendation?: string | null;
  decisionLabel?: string | null;
  warrantyDirection?: string | null;
  evidenceChecklist: string[];
  dispatchGateConfirmed: string[];
  feedbackStatus: "saved" | "not_saved";
  ticketReadiness: "needs_triage_completion" | "ready_for_ticket_draft";
  evidenceState: "not_required" | "pending" | "complete";
  deliveryReadiness:
    | "blocked_incomplete_triage"
    | "blocked_missing_evidence"
    | "ready_for_operator_review";
  watuDecision: {
    decisionLabel?: string | null;
    warrantyDirection?: string | null;
    ticketReadiness: "needs_triage_completion" | "ready_for_ticket_draft";
  };
  knowledgeSourceIds: string[];
};

export type KnowledgeSource = {
  id: string;
  vendor: "Device support" | "Enterprise device management" | "Microsoft" | "Zapier" | "Make" | "GitHub" | "Watu";
  sourceType:
    | "official_documentation"
    | "integration_documentation"
    | "integration_best_practice"
    | "internal_policy";
  topic: string;
  url?: string;
  reviewedAt: string;
  allowedUsage: "paraphrase_and_link" | "internal_policy_only";
  copyrightStatus: "link_only_no_copying" | "watu_owned";
  teachingSummary: string;
};

export type TeachingGuidance = {
  id: string;
  title: string;
  families: string[];
  procedureCategories: string[];
  searchSignals: string[];
  priority: "foundational" | "case_specific" | "integration";
  teach: string;
  branchSafeChecks: string[];
  doNotPromise: string[];
  sourceIds: string[];
};

export type FamilyLessonCard = {
  id: string;
  familyId: string;
  title: string;
  teachingGoal: string;
  firstLook: string[];
  modelCaveats: string[];
  localPhrases: string[];
  sourceIds: string[];
};

export type DecisionTeachingNote = {
  id: string;
  title: string;
  procedureCategories: string[];
  searchSignals: string[];
  whyItMatters: string;
  officerPrompt: string;
  escalationRisk: string;
  sourceIds: string[];
};

export type ContentHealthSignal = {
  id: string;
  label: string;
  value: string;
  level: "healthy" | "watch" | "risk";
  teachingImpact: string;
  recommendedAction: string;
};

export type CasePacketWebhookRequirement = {
  id: string;
  label: string;
  reason: string;
  sourceIds: string[];
};

export type IpaasCandidateProfile = {
  id: "power_automate" | "zapier" | "make" | "direct_webhook";
  label: string;
  bestFor: string;
  cautions: string[];
  sourceIds: string[];
};

// ── Auth / EC Platform ────────────────────────────────────────────────────────

export type ECLocationItem = {
  id: number;
  name: string;
  city: string;
  country_code: string;
  region?: string | null;
};

export type ECLocationListResponse = {
  locations: ECLocationItem[];
};

export type AppUser = {
  id: number;
  email: string;
  full_name: string;
  role: "ec_agent" | "ec_manager" | "watu_ops" | "watu_admin";
  approval_status: "pending" | "approved" | "suspended";
  country_code?: string | null;
  ec_location_id?: number | null;
  ec_location?: ECLocationItem | null;
};

export type AuthStatusResponse = {
  authenticated: boolean;
  user?: AppUser | null;
};

export type RegisterRequest = {
  ec_location_id: number;
  country_code: string;
  full_name?: string;
};

export type OTPVerifyResponse = {
  action: "dashboard" | "register" | "pending";
};

export type AllowedEmailItem = {
  id: number;
  email: string;
  notes?: string | null;
  created_at: string;
};

export type AllowedEmailListResponse = {
  emails: AllowedEmailItem[];
  total: number;
};

export type AllowedEmailAddResponse = {
  message: string;
  item: AllowedEmailItem;
};

// ── Cases ─────────────────────────────────────────────────────────────────────

export type CaseType = "repair" | "frp" | "return" | "theft";

export type CaseStatus = "open" | "dispatched" | "closed" | "cancelled";

export type CaseCreateRequest = {
  case_type: CaseType;
  client_name: string;
  client_phone: string;
  client_alt_phone?: string | null;
  client_id_number?: string | null;
  device_model: string;
  device_imei: string;
  complaint: string;
  sim_tray_present?: boolean | null;
  lock_type?: string | null;
  client_pin?: string | null;
  pattern_sequence?: string | null;
  sym_code?: string | null;
  src_group?: string | null;
  defect_description?: string | null;
  warranty_direction?: string | null;
  wty_exception?: string | null;
  liquid_exposure?: boolean | null;
  drop_or_repair?: boolean | null;
  sw_update?: boolean | null;
  normal_use?: boolean | null;
  asc_name?: string | null;
  asc_code?: string | null;
  ls_code?: string | null;
};

export type CaseResponse = {
  id: number;
  reference: string;
  case_type: CaseType;
  status: CaseStatus;
  ec_location_id: number;
  created_by_id: number;
  client_name: string;
  client_phone: string;
  client_alt_phone?: string | null;
  client_id_number?: string | null;
  device_model: string;
  device_imei: string;
  complaint: string;
  sim_tray_present?: boolean | null;
  lock_type?: string | null;
  client_pin?: string | null;
  pattern_sequence?: string | null;
  sym_code?: string | null;
  src_group?: string | null;
  defect_description?: string | null;
  warranty_direction?: string | null;
  wty_exception?: string | null;
  liquid_exposure?: boolean | null;
  drop_or_repair?: boolean | null;
  sw_update?: boolean | null;
  normal_use?: boolean | null;
  asc_name?: string | null;
  asc_code?: string | null;
  ls_code?: string | null;
  waybill_number?: string | null;
  photo_front?: string | null;
  photo_back?: string | null;
  photo_client_holding?: string | null;
  photo_pattern?: string | null;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
};

export type CaseListResponse = {
  cases: CaseResponse[];
  total: number;
};

export type CaseStatsResponse = {
  open: number;
  dispatched: number;
  closed: number;
  cancelled: number;
  total: number;
};

export type CaseStatusUpdateResponse = {
  message: string;
  case: CaseResponse;
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export type AdminUserItem = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  approval_status: "pending" | "approved" | "suspended";
  country_code?: string | null;
  ec_location_id?: number | null;
  ec_location_name?: string | null;
  created_at: string;
  approved_at?: string | null;
  last_login_at?: string | null;
};

export type AdminUserListResponse = {
  users: AdminUserItem[];
  total: number;
  pending_count: number;
};

export type AdminActionResponse = {
  message: string;
  user: AdminUserItem;
};

export type TicketDraftPreviewResponse = {
  dry_run: boolean;
  delivery_enabled: boolean;
  draft_status: "blocked" | "ready_for_operator_review";
  external_ticket_id?: string | null;
  blockers: string[];
  ticket_fields: Record<string, string | string[]>;
  webhook_requirements: Array<{
    id: string;
    label: string;
    ready: boolean;
    note: string;
  }>;
  message: string;
};
