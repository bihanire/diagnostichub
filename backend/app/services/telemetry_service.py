from collections import Counter, defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from threading import Lock
from time import monotonic

from app.core.logging import request_id_context
from app.schemas.telemetry import (
    EndpointTelemetryPayload,
    InteractionTelemetryPayload,
    SearchTelemetryPayload,
    TelemetryEventPayload,
    TelemetrySummaryResponse,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    if len(sorted_values) == 1:
        return round(sorted_values[0], 2)
    index = int(round((len(sorted_values) - 1) * percentile))
    index = max(0, min(index, len(sorted_values) - 1))
    return round(sorted_values[index], 2)


@dataclass
class _EndpointMetric:
    method: str
    path: str
    total_requests: int = 0
    success_count: int = 0
    client_error_count: int = 0
    server_error_count: int = 0
    total_duration_ms: float = 0.0
    durations_ms: deque[float] = field(default_factory=lambda: deque(maxlen=500))

    def record(self, *, status_code: int, duration_ms: float) -> None:
        self.total_requests += 1
        self.total_duration_ms += max(duration_ms, 0.0)
        self.durations_ms.append(max(duration_ms, 0.0))
        if status_code >= 500:
            self.server_error_count += 1
        elif status_code >= 400:
            self.client_error_count += 1
        else:
            self.success_count += 1

    def to_payload(self) -> EndpointTelemetryPayload:
        average_duration = self.total_duration_ms / self.total_requests if self.total_requests else 0.0
        return EndpointTelemetryPayload(
            method=self.method,
            path=self.path,
            total_requests=self.total_requests,
            success_count=self.success_count,
            client_error_count=self.client_error_count,
            server_error_count=self.server_error_count,
            average_duration_ms=round(average_duration, 2),
            p95_duration_ms=_percentile(list(self.durations_ms), 0.95),
        )


@dataclass
class _SearchMetric:
    total_searches: int = 0
    no_match_count: int = 0
    review_required_count: int = 0
    issue_type_counts: Counter[str] = field(default_factory=Counter)
    confidence_state_counts: Counter[str] = field(default_factory=Counter)
    ambiguity_risk_counts: Counter[str] = field(default_factory=Counter)

    def to_payload(self) -> SearchTelemetryPayload:
        return SearchTelemetryPayload(
            total_searches=self.total_searches,
            no_match_count=self.no_match_count,
            review_required_count=self.review_required_count,
            top_issue_types=dict(self.issue_type_counts.most_common(5)),
            confidence_states=dict(self.confidence_state_counts),
            ambiguity_risk_counts=dict(self.ambiguity_risk_counts),
        )


@dataclass
class _InteractionMetric:
    total_events: int = 0
    event_counts: Counter[str] = field(default_factory=Counter)

    def record(self, event: str) -> None:
        self.total_events += 1
        self.event_counts[event] += 1

    def to_payload(self) -> InteractionTelemetryPayload:
        return InteractionTelemetryPayload(
            total_events=self.total_events,
            event_counts=dict(self.event_counts),
        )


class TelemetryCollector:
    def __init__(self) -> None:
        self._lock = Lock()
        self._started_at = monotonic()
        self._endpoint_metrics: dict[tuple[str, str], _EndpointMetric] = {}
        self._search_metrics = _SearchMetric()
        self._interaction_metrics = _InteractionMetric()
        self._events: deque[TelemetryEventPayload] = deque(maxlen=300)
        self._total_http_requests = 0

    def record_http_request(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
    ) -> None:
        key = (method.upper(), path)
        with self._lock:
            metric = self._endpoint_metrics.get(key)
            if metric is None:
                metric = _EndpointMetric(method=method.upper(), path=path)
                self._endpoint_metrics[key] = metric
            metric.record(status_code=status_code, duration_ms=duration_ms)
            self._total_http_requests += 1

    def record_search_outcome(
        self,
        *,
        issue_type: str | None,
        confidence_state: str,
        no_match: bool,
        needs_review: bool,
        ambiguity_risk: str | None,
    ) -> None:
        with self._lock:
            self._search_metrics.total_searches += 1
            if no_match:
                self._search_metrics.no_match_count += 1
            if needs_review:
                self._search_metrics.review_required_count += 1
            if issue_type:
                self._search_metrics.issue_type_counts[issue_type] += 1
            self._search_metrics.confidence_state_counts[confidence_state] += 1
            if ambiguity_risk:
                self._search_metrics.ambiguity_risk_counts[ambiguity_risk] += 1

    def record_interaction(
        self,
        *,
        event: str,
    ) -> None:
        with self._lock:
            self._interaction_metrics.record(event)

    def record_event(
        self,
        *,
        event: str,
        status: str,
        metadata: dict[str, object] | None = None,
        request_id: str | None = None,
    ) -> None:
        safe_metadata: dict[str, str] = {}
        if metadata:
            for key, value in metadata.items():
                if value is None:
                    continue
                text_value = str(value)
                if len(text_value) > 180:
                    text_value = f"{text_value[:177]}..."
                safe_metadata[key] = text_value

        event_payload = TelemetryEventPayload(
            timestamp=_utc_now(),
            event=event,
            status=status,
            request_id=request_id or request_id_context.get(),
            metadata=safe_metadata,
        )
        with self._lock:
            self._events.appendleft(event_payload)

    def snapshot(self) -> TelemetrySummaryResponse:
        with self._lock:
            endpoint_payloads = [
                metric.to_payload()
                for metric in sorted(
                    self._endpoint_metrics.values(),
                    key=lambda item: (item.method, item.path),
                )
            ]
            search_payload = self._search_metrics.to_payload()
            interaction_payload = self._interaction_metrics.to_payload()
            recent_events = list(self._events)[:100]
            total_http_requests = self._total_http_requests

        uptime_seconds = int(max(0, monotonic() - self._started_at))
        return TelemetrySummaryResponse(
            generated_at=_utc_now(),
            uptime_seconds=uptime_seconds,
            total_http_requests=total_http_requests,
            active_endpoints=len(endpoint_payloads),
            endpoints=endpoint_payloads,
            search=search_payload,
            interaction=interaction_payload,
            recent_events=recent_events,
        )


@lru_cache(maxsize=1)
def get_telemetry_collector() -> TelemetryCollector:
    return TelemetryCollector()
