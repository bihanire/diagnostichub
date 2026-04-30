from app.schemas.search import SemanticInsight


def classify_ambiguity_risk(
    *,
    confidence: float,
    confidence_margin: float,
    dominant_category_score: int,
    runner_up_score: int,
) -> str:
    if confidence < 0.34:
        return "high"
    if confidence < 0.58 or confidence_margin < 0.12:
        return "high"
    if dominant_category_score <= 0:
        return "medium"
    if dominant_category_score - runner_up_score <= 1:
        return "medium"
    return "low"


def build_semantic_insight(
    *,
    normalized_query: str,
    key_terms: list[str],
    confidence: float,
    confidence_margin: float,
    category_scores: dict[str, int],
) -> SemanticInsight:
    sorted_scores = sorted(category_scores.items(), key=lambda item: item[1], reverse=True)
    dominant_score = sorted_scores[0][1] if sorted_scores else 0
    runner_up_score = sorted_scores[1][1] if len(sorted_scores) > 1 else 0
    ambiguity_risk = classify_ambiguity_risk(
        confidence=confidence,
        confidence_margin=confidence_margin,
        dominant_category_score=dominant_score,
        runner_up_score=runner_up_score,
    )
    capped_strength = max(0.0, min(round(confidence, 2), 1.0))
    top_scores = {name: score for name, score in sorted_scores[:3] if score > 0}
    return SemanticInsight(
        normalized_query=normalized_query,
        key_terms=key_terms[:8],
        ambiguity_risk=ambiguity_risk,
        intent_strength=capped_strength,
        matched_category_signals=top_scores,
    )
