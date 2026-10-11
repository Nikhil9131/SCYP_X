"""Evidence attribution and explainability metadata for graph edges."""

from math import isfinite
from typing import Any, Dict, List, Optional, Tuple


_EVIDENCE_KEYS = ("evidence", "evidence_references", "references", "evidence_sources")
_CONFIDENCE_KEYS = ("confidence_percentage", "confidence", "confidence_score")
_DIRECT_MARKERS = {"direct", "observed", "fact", "factual"}
_CITATION_FIELDS = (
	("source_name", ("source_name", "source", "publisher")),
	("document_title", ("document_title", "title")),
	("url", ("url",)),
	("filing_type", ("filing_type",)),
	("filing_date", ("filing_date",)),
	("page_number", ("page_number", "page")),
	("reference_id", ("reference_id", "reference_identifier", "id")),
	("source_type", ("source_type", "document_type", "report_type")),
)


def _safe_text(value: Any) -> Optional[str]:
	if isinstance(value, str) and value.strip():
		return value.strip()
	if isinstance(value, (int, float)) and not isinstance(value, bool):
		if isinstance(value, float) and not isfinite(value):
			return None
		return str(value)
	return None


def _is_direct_evidence(item: Dict[str, Any]) -> bool:
	if item.get("is_direct") is True or item.get("direct") is True:
		return True
	for key in ("evidence_type", "evidence_kind", "classification", "basis"):
		marker = item.get(key)
		if isinstance(marker, str) and marker.strip().lower() in _DIRECT_MARKERS:
			return True
	return False


def _evidence_items(edge_data: Dict[str, Any]) -> Tuple[List[Any], bool]:
	for key in _EVIDENCE_KEYS:
		if key not in edge_data:
			continue
		value = edge_data[key]
		if isinstance(value, list):
			return value, True
		if isinstance(value, (dict, str)):
			return [value], True
		return [], True
	return [], False


def _format_reference(item: Any) -> Tuple[Optional[Dict[str, Any]], bool]:
	if isinstance(item, str):
		value = _safe_text(item)
		if value is None:
			return None, False
		return {
			"reference_id": value,
			"citation": value,
			"is_direct": False,
		}, True
	if not isinstance(item, dict):
		return None, False

	reference: Dict[str, Any] = {}
	for output_key, input_keys in _CITATION_FIELDS:
		for input_key in input_keys:
			value = _safe_text(item.get(input_key))
			if value is not None:
				reference[output_key] = value
				break

	if not reference:
		return None, False

	citation_parts = [
		reference.get("source_name"),
		reference.get("document_title"),
		reference.get("source_type"),
		reference.get("filing_type"),
		reference.get("filing_date"),
		f"p. {reference['page_number']}" if "page_number" in reference else None,
		reference.get("reference_id"),
		reference.get("url"),
	]
	reference["citation"] = " | ".join(part for part in citation_parts if part)
	reference["is_direct"] = _is_direct_evidence(item)
	return reference, True


def _confidence_value(edge_data: Dict[str, Any], reference_count: int) -> Tuple[float, str, List[str]]:
	warnings: List[str] = []
	supplied_key = next((key for key in _CONFIDENCE_KEYS if key in edge_data), None)
	if supplied_key is not None:
		value = edge_data[supplied_key]
		if (
			isinstance(value, (int, float))
			and not isinstance(value, bool)
			and isfinite(value)
			and 0 <= value <= 100
		):
			return round(float(value), 2), f"Supplied valid {supplied_key} value.", warnings
		warnings.append("Supplied confidence must be a finite number from 0 to 100; it was ignored.")

	if reference_count == 0:
		return 0.0, "No usable references; support score is 0 by rule.", warnings

	# This is a transparent evidence-coverage heuristic, not a probability.
	score = round(100 * reference_count / (reference_count + 1), 2)
	return score, (
		f"Heuristic evidence-coverage score: 100 * {reference_count} usable reference(s) "
		f"/ ({reference_count} + 1) = {score}; not a calibrated probability."
	), warnings


def attach_evidence_metadata(edge_data: dict) -> Dict[str, Any]:
	"""Validate edge evidence and return JSON-friendly hover-sidebar metadata.

	A relationship is an ``Observed Fact`` only when at least one usable
	evidence object explicitly marks itself direct (``is_direct``/``direct``
	true, or an exact direct/observed/fact classification). Otherwise it is
	an ``Inferred Relationship``. Confidence uses a valid supplied 0-100
	value when present; otherwise it uses the evidence-coverage heuristic
	documented in ``confidence_basis``. Neither value is a probability.
	"""
	warnings: List[str] = []
	if not isinstance(edge_data, dict):
		edge: Dict[str, Any] = {}
		warnings.append("Edge data must be a dictionary; received value was ignored.")
	else:
		edge = edge_data

	raw_items, evidence_supplied = _evidence_items(edge)
	if not evidence_supplied:
		warnings.append("No evidence was supplied.")
	elif not raw_items:
		warnings.append("Evidence was empty or had an unsupported container type.")

	references: List[Dict[str, Any]] = []
	has_direct_evidence = False
	for index, item in enumerate(raw_items):
		reference, valid = _format_reference(item)
		if not valid or reference is None:
			warnings.append(f"Evidence item {index} was malformed and ignored.")
			continue
		references.append(reference)
		has_direct_evidence = has_direct_evidence or reference["is_direct"]

	confidence, confidence_basis, confidence_warnings = _confidence_value(edge, len(references))
	warnings.extend(confidence_warnings)

	badge = "Observed Fact" if has_direct_evidence else "Inferred Relationship"
	reasoning = _safe_text(edge.get("reasoning"))
	if has_direct_evidence:
		explanation = "At least one usable evidence reference is explicitly marked as direct."
	elif reasoning:
		explanation = f"This relationship is inferred. Supplied reasoning: {reasoning}"
	else:
		explanation = "No usable evidence is explicitly marked as direct; this remains an inference."

	return {
		"source": _safe_text(edge.get("source")),
		"target": _safe_text(edge.get("target")),
		"relationship": _safe_text(edge.get("relationship")) or "IMPACTS",
		"relationship_badge": badge,
		"evidence_references": references,
		"confidence_percentage": confidence,
		"confidence_basis": confidence_basis,
		"confidence_is_probability": False,
		"explanation": explanation,
		"validation_warnings": warnings,
	}
