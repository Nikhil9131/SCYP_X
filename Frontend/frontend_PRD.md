# Product Requirements Document (PRD): Frontend Architecture & UI/UX Design

## Document Metadata

- **Project Name:** Financial Event Market Impact Graph & XAI Terminal
- **Target File:** `frontend_PRD.md`
- **Version:** 3.0.0
- **Status:** Ready for Implementation

---

## 1. Executive Summary

This document specifies the complete frontend user interface requirements for the Financial Impact Graph terminal, built using Streamlit. The interface provides an interactive Bloomberg-style dashboard designed for on-demand event querying, multi-hop graph visualization, quantitative time-series validation, and transparent Explainable AI (XAI) evidence inspection with hoverable sidebars.

---

## 2. Global AI System Boundaries (What the AI Must NOT Do)

1. **No Absolute Price Predictions:** The UI must not display guaranteed future stock prices.
2. **No Unattributed Inferences:** Every node and edge must display explicit factual grounding or AI inference tags.
3. **No Automated Trade Execution:** The terminal is strictly analytical and advisory.

---

## 3. Frontend Multi-Page Architecture & Synthetic Data Mapping

### Page 0: Landing & System Overview Page

- **Purpose:** Acts as the entry portal explaining system architecture, passive 1-minute background ingestion, and strict AI operational boundaries.
- **Synthetic Data / Mock Mapping:**
  - None required (Static informational view).

### Page 1: Home & Event Ingestion Control Center

- **Purpose:** The primary operational control center where users initiate custom queries or select pre-configured scenario triggers.
- **Synthetic Data / Mock Mapping:**
  - Triggers input payload injection from `data/mock_graph_response.json` and retrieves vector chunks from `data/mock_vectordb_stream.json` when mock mode is active.

### Page 2: Interactive Graph Visualizer

- **Purpose:** Renders the multi-hop network graph dynamically with color-coded risk/sentiment nodes.
- **Synthetic Data / Mock Mapping:**
  - Consumes the `nodes` and `edges` arrays from `data/mock_graph_response.json`.

### Page 3: Propagation Path & Asset Explorer

- **Purpose:** Breaks down the traversal sequence from Hop 0 to Hop 4 into a scannable linear chain and actionable asset table.
- **Synthetic Data / Mock Mapping:**
  - Consumes sequential hop levels from `data/mock_graph_response.json`.

### Page 4: Time-Series & Historical Backtest View

- **Purpose:** Validates qualitative network predictions using quantitative historical market data.
- **Synthetic Data / Mock Mapping:**
  - Consumes `data/mock_timeseries_tsla.json` (containing `historical_price_series` and `benchmark_index_series`).

### Page 5: Explainability & Evidence Audit Trail (Hoverable Sidebar)

- **Purpose:** Provides complete auditability, fact vs. inference badging, SEC filing references, and hoverable evidence popups.
- **Synthetic Data / Mock Mapping:**
  - Consumes the `evidence` object dictionary nested inside `data/mock_graph_response.json`.
