# Complete System Product Requirements Document (PRD)

## Document Metadata

- **Project Name:** Financial Event Market Impact Graph & XAI Terminal
- **Target File:** `completeSystem_PRD.md`
- **Version:** 3.0.0
- **Scope:** End-to-End System Integration (Passive Ingestion + Vector DB + Orchestration + Graph + Frontend)

---

## 1. End-to-End System Workflow

1. **Passive Background Layer (Every 1 Min):** Autonomous workers fetch raw news feeds and store text embeddings into ChromaDB.
2. **Active On-Demand Layer (User Trigger):** When a user inputs a query or selects a scenario, the system queries the Vector DB for relevant context.
3. **Orchestrated Extraction:** Model 1 extracts entities; Model 2 computes deep 4-hop relationships and sentiment impact (+/-).
4. **Deterministic Computation:** NetworkX builds the impact graph; `yfinance` validates historical price fluctuations.
5. **Interactive Presentation:** Streamlit dashboard renders the visual graph with hoverable evidence sidebars.

---

## 2. Fallback & Robustness Requirements

- **Mock Mode Switch (`USE_MOCK_DATA = True`):** Instantly bypasses live external APIs and loads pre-validated mock JSON files (`data/mock_graph_response.json`, `data/mock_timeseries_tsla.json`) to guarantee 100% demo stability.
