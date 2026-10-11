"""Tests for edge explainability metadata."""

import json
import unittest

from Backend.modules.xai_engine import attach_evidence_metadata


class TestAttachEvidenceMetadata(unittest.TestCase):
    def test_explicit_direct_evidence_is_observed_fact(self):
        result = attach_evidence_metadata({
            "source": "event-1",
            "target": "asset-1",
            "relationship": "SUPPLIES",
            "evidence": [{
                "source_name": "SEC",
                "document_title": "Annual Report",
                "filing_type": "10-K",
                "filing_date": "2025-02-01",
                "page_number": 12,
                "url": "https://example.test/filing",
                "is_direct": True,
            }],
        })

        self.assertEqual(result["relationship_badge"], "Observed Fact")
        self.assertEqual(result["evidence_references"][0]["page_number"], "12")
        self.assertIn("10-K", result["evidence_references"][0]["citation"])
        self.assertEqual(result["source"], "event-1")

    def test_inferred_relationship_without_direct_marker(self):
        result = attach_evidence_metadata({
            "evidence": [{"source_name": "Maritime report", "title": "Port activity"}],
        })

        self.assertEqual(result["relationship_badge"], "Inferred Relationship")
        self.assertTrue(result["evidence_references"])

    def test_missing_evidence_is_not_a_fact(self):
        result = attach_evidence_metadata({})

        self.assertEqual(result["relationship_badge"], "Inferred Relationship")
        self.assertEqual(result["confidence_percentage"], 0.0)
        self.assertTrue(result["validation_warnings"])

    def test_multiple_reference_types_preserve_citation_details(self):
        result = attach_evidence_metadata({
            "references": [
                {"source": "SEC", "title": "Form 10-K", "filing_type": "10-K", "reference_id": "sec-7"},
                {"source_name": "Maritime archive", "document_title": "Vessel log", "page": 4},
                {"source": "Historical Archives", "title": "Trade ledger", "source_type": "historical archive", "url": "https://example.test/archive"},
            ],
            "confidence": 72,
        })

        self.assertEqual(len(result["evidence_references"]), 3)
        self.assertEqual(result["confidence_percentage"], 72.0)
        self.assertEqual(result["evidence_references"][0]["reference_id"], "sec-7")
        self.assertEqual(result["evidence_references"][1]["page_number"], "4")
        self.assertIn("https://example.test/archive", result["evidence_references"][2]["citation"])
        self.assertIn("historical archive", result["evidence_references"][2]["citation"])

    def test_invalid_confidence_is_ignored_with_warning(self):
        result = attach_evidence_metadata({
            "confidence_percentage": 101,
            "evidence": [{"reference_id": "archive-1"}],
        })

        self.assertEqual(result["confidence_percentage"], 50.0)
        self.assertTrue(any("confidence" in warning.lower() for warning in result["validation_warnings"]))
        self.assertFalse(result["confidence_is_probability"])

    def test_malformed_evidence_and_unexpected_edge_type_are_safe(self):
        malformed = attach_evidence_metadata({"evidence": [None, 42, {}]})
        unexpected = attach_evidence_metadata(None)

        self.assertEqual(malformed["relationship_badge"], "Inferred Relationship")
        self.assertEqual(malformed["evidence_references"], [])
        self.assertEqual(unexpected["relationship_badge"], "Inferred Relationship")
        self.assertTrue(unexpected["validation_warnings"])

    def test_result_is_json_serializable(self):
        result = attach_evidence_metadata({
            "reasoning": "The relationship follows from the cited reports.",
            "evidence": [{"source_type": "historical archive", "reference_id": "archive-9"}],
        })

        self.assertIsInstance(json.dumps(result), str)


if __name__ == "__main__":
    unittest.main()