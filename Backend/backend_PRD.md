# Product Requirements Document (PRD): Backend Architecture & Core Engine

## Document Metadata

- **Project Name:** Financial Event Market Impact Graph & XAI Terminal
- **Target File:** `backend_PRD.md`
- **Version:** 3.0.0
- **Status:** Ready for Implementation

---

## 1. Executive Summary

The backend architecture is engineered around a hybrid model: **Passive Background Ingestion** (polling news every 1 minute and storing chunks into a Vector DB) combined with **On-Demand Multi-Model Orchestration** (triggering deep graph traversal and quantitative validation only when requested by the user).

---

## 2. Backend System Boundaries

1. **No Monolithic Database Storage:** Dynamic sub-graph construction via NetworkX in-memory; no heavy relational DB bloat.
2. **No Unstructured LLM Outputs:** Strict Pydantic schema validation for all LLM JSON contracts.
3. **No Direct Trade Execution:** Purely analytical and advisory backend.

---

## 3. Core Backend Modules

- **Passive Ingestion Worker (`modules/ingestion.py`):** Runs an autonomous background loop every 1 minute to fetch news via RSS/Tavily and push raw chunks to the Vector DB.
- **Vector Database Layer (`modules/vector_db.py`):** Uses ChromaDB and local HuggingFace embeddings (`sentence-transformers`) for fast similarity search and semantic retrieval.
- **Multi-Model Orchestration Layer (`modules/orchestrator.py`):**
  - _Model 1 (Gemini Flash):_ Fast entity extraction and initial keyword filtering.
  - _Model 2 (Gemini Pro):_ Deep 4-hop reasoning, relationship mapping, and impact score calculation.
- **Graph Traversal Engine (`modules/graph_engine.py`):** Uses `NetworkX` for deterministic in-memory path tracing.
- **Quantitative Fusion Module (`modules/market_data.py`):** Pulls historical price series via `yfinance` and computes correlation metrics.
- **XAI & Evidence Engine (`modules/xai_engine.py`):** Manages source attribution, SEC references, and Fact vs. Inference tagging.
