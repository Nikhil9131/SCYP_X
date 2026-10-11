# Module Specification: Explainability & Evidence Engine (`modules/xai_engine.py`)

- **Developer Assigned:** Developer 3
- **Purpose:** Manages evidence attribution, Fact vs. Inference badging, SEC filing references, and confidence scoring.

## Core Requirements & Functions

1. **`attach_evidence_metadata(edge_data: dict)`**:
   - **Action:** Validates and formats evidence objects for every graph edge.
   - **Tagging:** Categorizes relationships into strict badges: `"Observed Fact"` or `"Inferred Relationship"`.
   - **Citations:** Links references to SEC Form 10-K filings, maritime shipping reports, or historical archives.
   - **Confidence Scoring:** Calculates or assigns aggregate confidence percentages (e.g., 84%).
   - **Returns:** Formatted metadata dictionary ready for UI hoverable sidebars.
