# Development & AI Tool Guidelines (`guidelines.md`)

## Document Metadata

- **Project Name:** Financial Event Market Impact Graph & XAI Terminal
- **Target File:** `guidelines.md`

---

## 1. Core Development Rules

1. **Strict Modular Isolation:** Never mix UI code (`app.py`) with backend logic (`modules/`). Each file has a singular responsibility.
2. **Schema Enforcement:** All LLM outputs must be validated using Pydantic models in `schemas/data_schemas.py`.
3. **Mock Mode Fallback:** Every external API call (Gemini, Tavily, yfinance) must include a graceful fallback to local mock JSON files if `USE_MOCK_DATA = True` or upon connection failure.
4. **No Database Bloat:** Do not implement heavy relational databases; rely on ChromaDB for vectors and NetworkX for in-memory graph traversal.
5. **Git Hygiene:** Always work on feature branches (`git checkout -b feature/<module-name>`) and avoid direct pushes to `main`.
