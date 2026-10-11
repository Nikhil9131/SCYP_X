# Module Specification: Vector Database Manager (`modules/vector_db.py`)

- **Developer Assigned:** Developer 1
- **Purpose:** Manages local persistence, embeddings, and semantic similarity search using ChromaDB and HuggingFace sentence-transformers.

## Core Requirements & Functions

1. **`initialize_vectordb()`**:
   - **Action:** Initializes a local ChromaDB client (persistent mode stored in a local `./chroma_db` directory).
   - **Embeddings:** Uses local HuggingFace embeddings (`sentence-transformers/all-MiniLM-L6-v2`) so no external paid embedding API is required.

2. **`add_documents(chunks: list[str])`**:
   - **Action:** Embeds incoming news text chunks and stores them in the ChromaDB collection.

3. **`query_vector_context(query_text: str, top_k: int = 3)`**:
   - **Action:** Performs a similarity search on ChromaDB using the user's query or incoming event headline.
   - **Returns:** `List[str]` containing the top relevant news/SEC context snippets.

## Fallback & Error Handling

- If ChromaDB initialization fails or vector storage is empty, return fallback static text snippets from `data/mock_graph_response.json`.
