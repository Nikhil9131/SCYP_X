// ─────────────────────────────────────────────────────────────────────────────
// GRAPH RESPONSE TYPES
// These exactly mirror the Pydantic GraphResponseSchema from the backend.
// When backend is ready, import these same types for API response validation.
// ─────────────────────────────────────────────────────────────────────────────

export type Sentiment = "positive" | "negative" | "neutral"
export type EdgeType = "observed" | "inferred"
export type BadgeType = "fact" | "inference"
export type ImpactDirection = "positive" | "negative" | "neutral"
export type HopTone = "amber" | "violet" | "pink" | "green" | "blue" | "cyan"

export interface GraphNode {
  id: string
  label: string
  category: string
  hop: number
  sentiment: Sentiment
  impact_score: number
  ticker: string | null
  description: string
}

export interface GraphEdge {
  source: string
  target: string
  relationship: string
  weight: number
  type: EdgeType
  evidence_id: string
}

export interface HopChainItem {
  hop: number
  label: string
  node_id: string
  category: string
  impact_delta: string
  tone: HopTone
  description: string
}

export interface AffectedAsset {
  ticker: string
  name: string
  type: string
  impact_delta: string
  direction: ImpactDirection
  confidence: number
}

export interface EvidenceItem {
  id: string
  badge: string
  badge_type: BadgeType
  title: string
  source: string
  source_type: string
  text: string
  confidence: number
  url: string | null
}

export interface IngestionStatus {
  status: "active" | "idle" | "error"
  last_updated: string
  articles_processed: number
  vector_chunks_stored: number
}

/** Top-level response from POST /api/analyze — mirrors GraphResponseSchema */
export interface GraphResponse {
  query: string
  event_summary: string
  root_event: GraphNode
  nodes: GraphNode[]
  edges: GraphEdge[]
  hop_chain: HopChainItem[]
  affected_assets: AffectedAsset[]
  evidence: Record<string, EvidenceItem>
  ingestion_status: IngestionStatus
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME-SERIES TYPES
// These exactly mirror the return shape of market_data.py → fetch_market_validation()
// ─────────────────────────────────────────────────────────────────────────────

export interface PricePoint {
  date: string
  close: number
  volume?: number
}

export interface BenchmarkPoint {
  date: string
  close: number
  label: string
}

export interface BacktestSettings {
  similar_event_analysis: boolean
  avg_7day_return: string
  win_rate: string
  lookback_period: string
}

/** Top-level response from GET /api/market-data/:ticker — mirrors fetch_market_validation() */
export interface TimeSeriesResponse {
  ticker: string
  period: string
  correlation_coefficient: number
  avg_7day_return: number
  win_rate: number
  historical_price_series: PricePoint[]
  benchmark_index_series: BenchmarkPoint[]
  key_insights: string[]
  backtest_settings: BacktestSettings
}

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR DB / INGESTION STREAM TYPES
// Mirrors the return shape of ingestion.py → poll_and_store_news()
// ─────────────────────────────────────────────────────────────────────────────

export interface Headline {
  id: string
  title: string
  source: string
  timestamp: string
  category: string
  relevance_score: number
}

/** Response from GET /api/ingestion/status — mirrors poll_and_store_news() */
export interface VectorDBStream {
  status: "success" | "error"
  timestamp: string
  articles_processed: number
  vector_chunks_stored: number
  recent_headlines: Headline[]
}
