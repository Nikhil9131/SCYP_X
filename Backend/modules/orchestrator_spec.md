# Module Specification: Multi-Model AI Orchestrator (`modules/orchestrator.py`)

- **Developer Assigned:** Developer 2
- **Purpose:** Manages the multi-model Gemini pipeline: Model 1 (Flash) for fast entity extraction and Model 2 (Pro) for deep 4-hop reasoning and sentiment impact scoring.

## Core Requirements & Functions

1. **`run_multi_model_pipeline(query: str, retrieved_context: list[str])`**:
   - **Stage 1 (Entity Extraction - Flash Model):** Calls Gemini 2.5 Flash to quickly parse the query and retrieved context, extracting keywords, core entities, and initial sentiment.
   - **Stage 2 (Deep 4-Hop Reasoning - Pro Model):** Passes Stage 1 output to Gemini 2.5 Pro to generate the full multi-hop traversal structure (Root Event -> Commodity -> Sector -> Target Assets) with impact scores (+/-) and reasoning strings.
   - **Validation:** Validates the final LLM JSON output against the Pydantic schema (`GraphResponseSchema`).
   - **Returns:** A validated Python dictionary conforming strictly to the graph schema.

## Fallback & Error Handling

- If `GEMINI_API_KEY` is missing or rate limits are hit, or if Pydantic validation fails, automatically catch the exception and return the pre-validated payload from `data/mock_graph_response.json`.
