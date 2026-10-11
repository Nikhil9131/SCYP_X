# Module Specification: Passive News Ingestion (`modules/ingestion.py`)

- **Developer Assigned:** Developer 1
- **Purpose:** Runs an autonomous background thread to poll news feeds (RSS / Tavily API) every 1 minute and pass raw text chunks to the Vector Database.

## Core Requirements & Functions

1. **`poll_and_store_news()`**:
   - **Trigger:** Runs in a background loop every 60 seconds (using `threading.Thread` or `APScheduler`).
   - **Action:** Fetches latest financial news headlines and articles via Tavily AI Search API or public RSS feeds (e.g., Bloomberg, Reuters).
   - **Integration:** Passes fetched text chunks to `vector_db.add_documents()`.
   - **Returns:** `dict` containing status (`success`/`error`), timestamp, and count of articles processed.

## Fallback & Error Handling

- If `TAVILY_API_KEY` is missing or network fails, catch exceptions gracefully, log a warning, and skip the 1-minute cycle without crashing the main application thread.
