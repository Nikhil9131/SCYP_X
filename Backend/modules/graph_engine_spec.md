# Module Specification: Deterministic Graph Engine (`modules/graph_engine.py`)

- **Developer Assigned:** Developer 2
- **Purpose:** Constructs in-memory directed graphs using NetworkX and executes mathematical path-finding (BFS/Shortest Path) for 4-hop propagation chains.

## Core Requirements & Functions

1. **`build_propagation_graph(validated_data: dict)`**:
   - **Action:** Takes the validated JSON dictionary from the orchestrator and builds a `networkx.DiGraph()` instance.
   - **Nodes & Edges:** Adds nodes with attributes (category, hop level, sentiment, impact score) and directed edges with weights and relationship types.

2. **`get_hop_subgraph(graph: networkx.DiGraph, target_hop: int)`**:
   - **Action:** Traverses the graph to extract nodes and paths up to Hop 4.
   - **Returns:** Serialized node and edge lists formatted for frontend rendering.

## Fallback & Error Handling

- If graph construction fails due to malformed node/edge IDs, fallback to building a simple linear graph structure from mock data.
