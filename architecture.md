# System Architecture & Technology Stack Document

## Document Metadata

- **Project Name:** Financial Event Market Impact Graph & XAI Terminal
- **Target File:** `architecture.md`
- **Version:** 3.0.0

---

## 1. Component Architecture & Technology Stack

| Layer                   | Selected Technologies & Libraries                         | Purpose & Justification                                                                     | API Key Required?                     |
| :---------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------ | :------------------------------------ |
| **Frontend UI**         | Streamlit, PyVis / Streamlit Components                   | High-density terminal layout, interactive graph visualization, hoverable evidence sidebars. | **NO**                                |
| **Vector Database**     | ChromaDB, Sentence-Transformers                           | Local vector storage and similarity search for retrieved news context.                      | **NO**                                |
| **Passive Ingestion**   | Feedparser, Tavily API, Python Threading                  | Autonomous background worker polling news every 1 minute.                                   | **YES** _(Tavily API Key - Optional)_ |
| **Orchestrated LLM**    | Google GenAI SDK (`google-genai`), Gemini 2.5 Flash & Pro | Multi-model pipeline: Model 1 for fast extraction, Model 2 for deep 4-hop reasoning.        | **YES** _(Gemini API Key - Required)_ |
| **Schema Validation**   | Pydantic v2                                               | 100% type safety and structured JSON enforcement.                                           | **NO**                                |
| **Graph Engine**        | NetworkX                                                  | Deterministic in-memory graph traversal (Hops 0–4).                                         | **NO**                                |
| **Quantitative Fusion** | yfinance, Pandas, NumPy                                   | Historical stock pricing validation and correlation analysis.                               | **NO**                                |

---

## 2. Explicit API Key Audit Registry

> ⚠️ **CRITICAL TRANSPARENCY NOTICE:** External services requiring authentication keys are isolated below. **No external API will be invoked automatically without explicit configuration.**

1. **Gemini API:** Used in `modules/orchestrator.py` (`GEMINI_API_KEY`). Required for structured parsing and reasoning. Falls back to mock JSON if absent.
2. **Tavily AI Search API:** Used in `modules/ingestion.py` (`TAVILY_API_KEY`). Optional for live news fetching.
