# API & Module Function Guidelines (`api_guideline.md`)

## Document Metadata

- **Project Name:** Financial Event Market Impact Graph & XAI Terminal
- **Target File:** `api_guideline.md`

---

## 1. Core Module Functions & Endpoints Contracts

### 1. Ingestion Module (`modules/ingestion.py`)

- **Function:** `poll_and_store_news()`
- **Work:** Runs in a background thread every 1 minute. Fetches latest news, generates embeddings, and pushes chunks to ChromaDB.
- **Returns:** `dict` (Status: Success/Error, Chunks added count).

### 2. Vector Database Module (`modules/vector_db.py`)

- **Function:** `query_vector_context(query_text: str)`
- **Work:** Searches ChromaDB for semantic chunks relevant to the user query.
- **Returns:** `List[str]` (Top matching news/SEC context snippets).

### 3. Orchestrator Module (`modules/orchestrator.py`)

- **Function:** `run_multi_model_pipeline(context: str)`
- **Work:** Orchestrates Model 1 (Flash) for entity extraction and Model 2 (Pro) for 4-hop chain reasoning.
- **Returns:** `Validated Pydantic Graph Schema` (JSON contract).

### 4. Graph Engine Module (`modules/graph_engine.py`)

- **Function:** `build_propagation_graph(data: dict)`
- **Work:** Constructs NetworkX directed graph and calculates edge weights/hop paths.
- **Returns:** `networkx.DiGraph` object and serialized node/edge lists.

### 5. Quantitative Validation Module (`modules/market_data.py`)

- **Function:** `fetch_market_validation(ticker: str)`
- **Work:** Pulls historical pricing data via `yfinance` and computes correlation metrics.
- **Returns:** `dict` (Historical price series array and correlation coefficient).
