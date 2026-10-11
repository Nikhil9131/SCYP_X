import React, { useMemo, useState, useRef, useEffect, useCallback } from "react"
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Maximize2,
  Minimize2,
  LineChart,
} from "lucide-react"
import type { GraphNode, GraphEdge, EvidenceItem } from "@/types/api.types"

export type LayoutMode = "starburst" | "hierarchical" | "radial"

export interface NetworkGraphProps {
  nodes: GraphNode[]
  edges?: GraphEdge[]
  evidence?: Record<string, EvidenceItem>
  selectedId: string | null
  onNodeClick: (node: GraphNode) => void
  activeHopFilter?: number | "all"
  onHopFilterChange?: (filter: number | "all") => void
  onSearchClick?: (node: GraphNode) => void
  onNavigateToTimeSeries?: (ticker: string) => void
  onNavigateToEvidence?: (evidenceId?: string) => void
  isExpanded?: boolean
  onToggleExpand?: () => void
  externalExpandTrigger?: { nodeId: string; action: "expand" | "collapse" } | null
}

// ─── Financial Causal Alert Badges (Matching Screenshot 1 & 2 Aesthetic) ────
function getFinancialAlertTag(node: GraphNode): string {
  const lbl = node.label.toLowerCase()
  const id = node.id.toLowerCase()

  if (node.hop === 0 || id.includes("crude") || lbl.includes("crude") || lbl.includes("oil")) {
    return "! COMMODITY SHOCK"
  }
  if (lbl.includes("energy") || id.includes("energy") || lbl.includes("xle")) {
    return "! SECTOR EXPOSURE"
  }
  if (lbl.includes("commodity") || id.includes("commodity") || lbl.includes("djp")) {
    return "! COMMODITY BASKET"
  }
  if (lbl.includes("airline") || id.includes("airline") || lbl.includes("dal")) {
    return "! MARGIN SQUEEZE"
  }
  if (lbl.includes("inflation") || id.includes("inflation") || lbl.includes("cpi")) {
    return "! INFLATION SPIKE"
  }
  if (lbl.includes("rate") || id.includes("rate") || lbl.includes("fed")) {
    return "! POLICY SHIFT"
  }
  if (lbl.includes("bank") || id.includes("bank") || lbl.includes("xlf")) {
    return "! CREDIT SQUEEZE"
  }
  if (lbl.includes("real estate") || id.includes("realestate") || lbl.includes("xlre")) {
    return "! MORTGAGE HEADWIND"
  }
  if (lbl.includes("tech") || id.includes("tech") || lbl.includes("xlk")) {
    return "! VALUATION SHOCK"
  }
  if (lbl.includes("market") || id.includes("market") || lbl.includes("spy")) {
    return "! MARKET CONTAGION"
  }

  // Forensic fallback if user searches Sukesh query
  if (id.includes("sukesh")) return "! HAWALA CONDUIT"
  if (id.includes("ward") || id.includes("iphone")) return "! BURNER SPOOF"
  if (id.includes("aiadmk")) return "! EC BRIBERY"
  if (id.includes("ecir") || id.includes("leena")) return "! SMURFING LAYER"

  if (node.hop === 1) return "! SECTOR EXPOSURE"
  if (node.hop === 2) return "! INFLATION SPIKE"
  if (node.hop === 3) return "! ASSET IMPACT"
  return "! MARKET CONTAGION"
}

// ─── Node Core Colors (Matching Screenshot 1 & 2 Palette) ───────────────────
function getFinancialCoreColor(node: GraphNode): string {
  const lbl = node.label.toLowerCase()
  const id = node.id.toLowerCase()

  if (node.hop === 0 || id.includes("crude") || lbl.includes("crude") || id.includes("sukesh")) {
    return "#dc2626" // Crimson Red
  }
  if (lbl.includes("energy") || lbl.includes("commodity") || lbl.includes("airline") || id.includes("ward")) {
    return "#0284c7" // Cyan / Sky Blue
  }
  if (lbl.includes("inflation") || lbl.includes("rate") || id.includes("aiadmk") || id.includes("iphone")) {
    return "#ea580c" // Orange
  }
  if (lbl.includes("bank") || id.includes("bank") || id.includes("ecir") || id.includes("leena")) {
    return "#dc2626" // Crimson Red
  }
  if (lbl.includes("real estate") || id.includes("realestate") || id.includes("extortion")) {
    return "#ea580c" // Orange
  }
  if (lbl.includes("tech") || id.includes("tech") || id.includes("hdfc")) {
    return "#eab308" // Golden Yellow
  }
  if (lbl.includes("market") || id.includes("market") || lbl.includes("spy")) {
    return "#dc2626" // Crimson Red
  }

  return "#0284c7"
}

export function NetworkGraph({
  nodes,
  edges = [],
  evidence = {},
  selectedId,
  onNodeClick,
  activeHopFilter = "all",
  onHopFilterChange,
  onSearchClick,
  onNavigateToTimeSeries,
  onNavigateToEvidence,
  isExpanded: isExpandedProp,
  onToggleExpand,
  externalExpandTrigger,
}: NetworkGraphProps) {
  // Canvas coordinate bounds
  const canvasWidth = 1400
  const canvasHeight = 850
  const containerRef = useRef<HTMLDivElement>(null)

  // Zoom & Pan matching reference screenshots (starts ~71%)
  const [zoom, setZoom] = useState(0.71)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)
  const [inspectorDismissed, setInspectorDismissed] = useState(false)

  // ─── 1. ROOT EVENT NODE ───────────────────────────────────────────────────
  const rootNode = useMemo(() => {
    return nodes.find((n) => n.hop === 0) || nodes[0] || null
  }, [nodes])

  // ─── 2. PROGRESSIVE EXPANSION STATE ───────────────────────────────────────
  // Initial state has ONLY the root shock node visible matching Screenshot 1!
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(() => {
    return rootNode ? new Set([rootNode.id]) : new Set()
  })

  // Reset to root on new query dataset
  const prevRootIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (rootNode && rootNode.id !== prevRootIdRef.current) {
      prevRootIdRef.current = rootNode.id
      setVisibleNodeIds(new Set([rootNode.id]))
      setZoom(0.71)
      setPan({ x: 0, y: 0 })
    }
  }, [rootNode])

  // Reset inspector dismissed on node selection change
  useEffect(() => {
    if (selectedId) setInspectorDismissed(false)
  }, [selectedId])

  // External trigger sync from side panel
  useEffect(() => {
    if (!externalExpandTrigger) return
    const { nodeId, action } = externalExpandTrigger
    if (action === "expand") {
      handleExpandNode(nodeId)
    } else if (action === "collapse") {
      handleCollapseNode(nodeId)
    }
  }, [externalExpandTrigger])

  // Adjacency map
  const { adjacencyMap, allNeighborsMap } = useMemo(() => {
    const adj = new Map<string, string[]>()
    const all = new Map<string, string[]>()

    nodes.forEach((n) => {
      adj.set(n.id, [])
      all.set(n.id, [])
    })

    edges.forEach((e) => {
      if (adj.has(e.source)) adj.get(e.source)!.push(e.target)
      if (all.has(e.source) && !all.get(e.source)!.includes(e.target)) all.get(e.source)!.push(e.target)
      if (all.has(e.target) && !all.get(e.target)!.includes(e.source)) all.get(e.target)!.push(e.source)
    })

    // If edges sparse, connect to root or sequential hops
    nodes.forEach((n) => {
      if (n.id !== rootNode?.id && rootNode) {
        if (!all.get(rootNode.id)!.includes(n.id)) all.get(rootNode.id)!.push(n.id)
        if (!all.get(n.id)!.includes(rootNode.id)) all.get(n.id)!.push(rootNode.id)
      }
    })

    return { adjacencyMap: adj, allNeighborsMap: all }
  }, [nodes, edges, rootNode])

  // ─── 3. EXPAND / COLLAPSE ACTIONS ─────────────────────────────────────────
  const handleExpandNode = useCallback(
    (nodeId: string) => {
      const neighbors = allNeighborsMap.get(nodeId) || []
      setVisibleNodeIds((prev) => {
        const next = new Set(prev)
        neighbors.forEach((nbrId) => next.add(nbrId))
        return next
      })
    },
    [allNeighborsMap],
  )

  const handleCollapseNode = useCallback(
    (nodeId: string) => {
      if (nodeId === rootNode?.id) {
        setVisibleNodeIds(new Set([rootNode.id]))
        return
      }
      const children = adjacencyMap.get(nodeId) || []
      setVisibleNodeIds((prev) => {
        const next = new Set(prev)
        children.forEach((cId) => next.delete(cId))
        return next
      })
    },
    [rootNode, adjacencyMap],
  )

  const handleExpandAll = useCallback(() => {
    setVisibleNodeIds(new Set(nodes.map((n) => n.id)))
    setZoom(0.39) // Zoom to 39% matching Screenshot 2 full constellation
    setPan({ x: 0, y: 0 })
  }, [nodes])

  const handleReset = useCallback(() => {
    if (rootNode) {
      setVisibleNodeIds(new Set([rootNode.id]))
      onNodeClick(rootNode)
      setZoom(0.71)
      setPan({ x: 0, y: 0 })
    }
  }, [rootNode, onNodeClick])

  // Currently visible nodes
  const currentVisibleNodes = useMemo(() => {
    return nodes.filter((n) => visibleNodeIds.has(n.id))
  }, [nodes, visibleNodeIds])

  // Selected or active node for top-right inspector card
  const activeNode = useMemo(() => {
    if (selectedId) {
      const match = nodes.find((n) => n.id === selectedId)
      if (match) return match
    }
    // Default active node when expanded
    const energyOrFirst = currentVisibleNodes.find(
      (n) => n.id.includes("energy") || n.label.includes("Energy") || n.id.includes("leena"),
    )
    if (energyOrFirst && currentVisibleNodes.length > 1) return energyOrFirst
    return rootNode || currentVisibleNodes[0] || null
  }, [selectedId, nodes, currentVisibleNodes, rootNode])

  // ─── 4. GEOMETRIC POSITIONING (MATCHING SCREENSHOT 2) ────────────────────
  const nodePositions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>()
    if (currentVisibleNodes.length === 0) return posMap

    const centerX = canvasWidth / 2
    const centerY = canvasHeight / 2 + 50

    // Root is pinned at center
    if (rootNode) {
      posMap.set(rootNode.id, { x: centerX, y: centerY })
    }

    if (currentVisibleNodes.length === 1) {
      return posMap
    }

    // Exact radial/starburst geometry mapping the financial impact chain
    currentVisibleNodes.forEach((node) => {
      if (node.id === rootNode?.id) return

      const id = node.id.toLowerCase()
      const lbl = node.label.toLowerCase()

      // 1. Energy Sector (12 o'clock, top)
      if (id.includes("energy") || lbl.includes("energy") || id.includes("ward")) {
        posMap.set(node.id, { x: centerX, y: centerY - 250 })
      }
      // 2. Commodities Basket (10:30 o'clock, top-left)
      else if (id.includes("commodities") || lbl.includes("commodities") || id.includes("aiadmk")) {
        posMap.set(node.id, { x: centerX - 275, y: centerY - 165 })
      }
      // 3. Airlines & Logistics (1:30 o'clock, top-right)
      else if (id.includes("airlines") || lbl.includes("airline") || id.includes("iphone")) {
        posMap.set(node.id, { x: centerX + 265, y: centerY - 145 })
      }
      // 4. Inflation Expectations (9 o'clock, mid-left)
      else if (id.includes("inflation") || lbl.includes("inflation") || id.includes("ecir")) {
        posMap.set(node.id, { x: centerX - 380, y: centerY + 10 })
      }
      // 5. Interest-Rate Expectations (3 o'clock, mid-right)
      else if (id.includes("rates") || lbl.includes("rate") || id.includes("leena")) {
        posMap.set(node.id, { x: centerX + 260, y: centerY + 15 })
      }
      // 6. Tech Growth Equities (further out to the right)
      else if (id.includes("tech") || lbl.includes("tech") || id.includes("hdfc")) {
        posMap.set(node.id, { x: centerX + 535, y: centerY - 110 })
      }
      // 7. Banks & Financials (8 o'clock, bottom-left)
      else if (id.includes("banks") || lbl.includes("bank") || id.includes("fir208")) {
        posMap.set(node.id, { x: centerX - 290, y: centerY + 185 })
      }
      // 8. Real Estate & Housing (6 o'clock, bottom-center)
      else if (id.includes("realestate") || lbl.includes("real estate") || id.includes("procurement")) {
        posMap.set(node.id, { x: centerX + 20, y: centerY + 325 })
      }
      // 9. S&P 500 Market Benchmark (5 o'clock, bottom-right)
      else if (id.includes("market") || lbl.includes("market") || lbl.includes("spy") || id.includes("deepak")) {
        posMap.set(node.id, { x: centerX + 260, y: centerY + 185 })
      }
      // Fallback radial positioning
      else {
        const satellites = currentVisibleNodes.filter((n) => n.id !== rootNode?.id)
        const idx = satellites.indexOf(node)
        const total = Math.max(1, satellites.length)
        const angle = (idx / total) * 2 * Math.PI - Math.PI / 2
        const radius = 260 + (node.hop > 1 ? 120 : 0)
        posMap.set(node.id, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        })
      }
    })

    return posMap
  }, [currentVisibleNodes, rootNode, canvasWidth, canvasHeight])

  // ─── 5. EDGES WITH EXACT COLORS & LABELS ──────────────────────────────────
  const visualLinks = useMemo(() => {
    const visibleIdSet = new Set(currentVisibleNodes.map((n) => n.id))
    const links: {
      key: string
      source: string
      target: string
      relationship: string
      color: string
      markerId: string
    }[] = []

    const seenEdges = new Set<string>()

    edges.forEach((e) => {
      if (visibleIdSet.has(e.source) && visibleIdSet.has(e.target)) {
        const edgeKey = `${e.source}->${e.target}`
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey)
          const rel = (e.relationship || "").toLowerCase()

          let edgeColor = "#475569" // Default dark charcoal
          let markerId = "arrow-black"

          // Highlight lines matching reference aesthetics
          if (rel.includes("policy response") || rel.includes("rates") || rel.includes("wife")) {
            edgeColor = "#ea580c" // Orange line for macro policy transmission
            markerId = "arrow-orange"
          } else if (rel.includes("discount rate") || rel.includes("valuation") || rel.includes("account")) {
            edgeColor = "#eab308" // Golden yellow line for valuation shock
            markerId = "arrow-yellow"
          } else if (rel.includes("input cost") || rel.includes("fuel") || rel.includes("attachment")) {
            edgeColor = "#dc2626" // Red line for primary direct cost surge
            markerId = "arrow-red"
          }

          links.push({
            key: edgeKey,
            source: e.source,
            target: e.target,
            relationship: e.relationship || "IMPACTS",
            color: edgeColor,
            markerId,
          })
        }
      }
    })

    return links
  }, [edges, currentVisibleNodes])

  // Canvas pan & zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 100) / 100))
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 100) / 100))

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).id === "graph-canvas-bg") {
      setIsDraggingCanvas(true)
      dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy })
    }
  }

  const handleMouseUp = () => setIsDraggingCanvas(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92
    setZoom((z) => Math.min(2.0, Math.max(0.25, z * zoomFactor)))
  }

  return (
    <div
      ref={containerRef}
      className={`forensic-graph-canvas ${isExpandedProp ? "expanded" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 650,
        height: isExpandedProp ? "calc(100vh - 110px)" : 650,
        borderRadius: 16,
        overflow: "hidden",
        background: "#fbfaf6", // Warm cream background matching exact screenshots
        border: "1px solid #e8e4d9",
        boxShadow: "0 4px 24px rgba(15, 23, 42, 0.05)",
        cursor: isDraggingCanvas ? "grabbing" : "grab",
        userSelect: "none",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ─── TOP-LEFT CONTROL PILL CAPSULE (EXACT MATCH) ────────────────── */}
      <div
        className="control-pill-capsule"
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          zIndex: 40,
          display: "inline-flex",
          alignItems: "center",
          background: "#ffffff",
          borderRadius: 28,
          padding: "5px 12px",
          border: "1px solid #dcd7cb",
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.06)",
          gap: 10,
        }}
      >
        {/* + Zoom In */}
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          style={{
            border: 0,
            background: "transparent",
            color: "#0f172a",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            padding: "0 3px",
            lineHeight: 1,
          }}
        >
          +
        </button>

        {/* – Zoom Out */}
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          style={{
            border: 0,
            background: "transparent",
            color: "#0f172a",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            padding: "0 3px",
            lineHeight: 1,
          }}
        >
          –
        </button>

        {/* Reset Button */}
        <button
          type="button"
          onClick={handleReset}
          title="Reset to Root Shock Event only"
          style={{
            border: 0,
            background: "transparent",
            color: "#0f172a",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            padding: "2px 4px",
          }}
        >
          Reset
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: "#e2ded4" }} />

        {/* Zoom % text */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#475569",
            minWidth: 32,
            textAlign: "center",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>

        {/* Expand All / Collapse Pill */}
        <button
          type="button"
          onClick={visibleNodeIds.size < nodes.length ? handleExpandAll : handleReset}
          style={{
            border: "1px solid #dcd7cb",
            borderRadius: 16,
            background: "#ffffff",
            color: "#1e293b",
            fontSize: 11.5,
            fontWeight: 700,
            padding: "4px 12px",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {visibleNodeIds.size < nodes.length ? "Expand All" : "Collapse"}
        </button>
      </div>

      {/* ─── TOP-RIGHT LEGEND PILL (EXACT MATCH) ────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 18,
          right: activeNode && !inspectorDismissed && currentVisibleNodes.length > 1 ? 260 : 18,
          zIndex: 40,
          transition: "right 0.25s ease",
        }}
      >
        <button
          type="button"
          onClick={() => setLegendOpen(!legendOpen)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#ffffff",
            borderRadius: 20,
            padding: "6px 14px",
            border: "1px solid #dcd7cb",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.06)",
            fontSize: 12.5,
            fontWeight: 700,
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          <span>Legend</span>
          <span style={{ fontSize: 9 }}>▼</span>
        </button>

        {legendOpen && (
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e2ded4",
              boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
              padding: 14,
              minWidth: 240,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 11,
              color: "#334155",
              zIndex: 50,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>
              Financial Propagation Layers
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#dc2626", border: "1.5px solid #0f172a" }} />
              <span>Commodity Shock (Hop 0)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#0284c7", border: "1.5px solid #0f172a" }} />
              <span>Direct Sector Exposure (Hop 1)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ea580c", border: "1.5px solid #0f172a" }} />
              <span>Inflation & Monetary Policy (Hop 2)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#eab308", border: "1.5px solid #0f172a" }} />
              <span>Credit & Valuation Sensitivity (Hop 3)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#dc2626", border: "1.5px solid #0f172a" }} />
              <span>Broad Market Benchmark Drag (Hop 4)</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── FLOATING TOP-RIGHT ENTITY INSPECTOR CARD (MATCHING SCREENSHOT 2) ─ */}
      {activeNode && !inspectorDismissed && currentVisibleNodes.length > 1 && (
        <div
          className="floating-suspect-card"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            width: 230,
            zIndex: 45,
            background: "rgba(255, 255, 255, 0.98)",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Top row: Type badge + close X */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: "#ffffff",
                background:
                  activeNode.hop === 0
                    ? "#b91c1c"
                    : activeNode.hop === 1
                      ? "#0284c7"
                      : activeNode.hop === 2
                        ? "#ea580c"
                        : "#7c3aed",
                padding: "3px 9px",
                borderRadius: 5,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {activeNode.hop === 0
                ? "COMMODITY SHOCK"
                : activeNode.ticker
                  ? `$${activeNode.ticker}`
                  : activeNode.category.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={() => setInspectorDismissed(true)}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: 0,
                background: "transparent",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
                padding: 0,
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Node Name */}
          <h3
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.25,
            }}
          >
            {activeNode.label}
          </h3>

          {/* Verified Source + Search / Analyze button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b", fontSize: 11, fontWeight: 500 }}>
              <ShieldCheck size={13} color="#16a34a" />
              <span>Verified Source</span>
            </div>
            {activeNode.ticker && onNavigateToTimeSeries ? (
              <button
                type="button"
                onClick={() => onNavigateToTimeSeries(activeNode.ticker!)}
                style={{
                  background: "#b4431a",
                  color: "#ffffff",
                  border: 0,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  boxShadow: "0 2px 6px rgba(180, 67, 26, 0.25)",
                }}
              >
                <span>Analyze</span>
                <span style={{ fontSize: 12, lineHeight: 1 }}>↗</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onSearchClick) onSearchClick(activeNode)
                  else window.open(`https://www.google.com/search?q=${encodeURIComponent(activeNode.label)}`, "_blank")
                }}
                style={{
                  background: "#b4431a",
                  color: "#ffffff",
                  border: 0,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  boxShadow: "0 2px 6px rgba(180, 67, 26, 0.25)",
                }}
              >
                <span>Search</span>
                <span style={{ fontSize: 12, lineHeight: 1 }}>↗</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── MAIN SVG CANVAS ────────────────────────────────────────────── */}
      <svg
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Subtle Warm Dot Grid matching exact screenshot */}
          <pattern id="graph-canvas-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="1.15" fill="#94a3b8" opacity="0.3" />
          </pattern>

          {/* Directed Arrowheads matching exact screenshot */}
          <marker id="arrow-black" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 1.5 L 9 5 L 0 8.5 Z" fill="#0f172a" />
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 1.5 L 9 5 L 0 8.5 Z" fill="#dc2626" />
          </marker>
          <marker id="arrow-yellow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">
            <path d="M 0 1.5 L 9 5 L 0 8.5 Z" fill="#eab308" />
          </marker>
          <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 1.5 L 9 5 L 0 8.5 Z" fill="#ea580c" />
          </marker>
        </defs>

        {/* Background Clickable Area */}
        <rect id="graph-canvas-bg" width={canvasWidth} height={canvasHeight} fill="url(#graph-canvas-dots)" />

        {/* Zoom & Pan Viewport Container */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* ─── 1. DIRECTED EDGES & RELATIONSHIP PILLS ──────────────────── */}
          <g className="edges-layer">
            {visualLinks.map((link) => {
              const srcPos = nodePositions.get(link.source)
              const tgtPos = nodePositions.get(link.target)
              if (!srcPos || !tgtPos) return null

              const dist = Math.hypot(tgtPos.x - srcPos.x, tgtPos.y - srcPos.y) || 1
              const uX = (tgtPos.x - srcPos.x) / dist
              const uY = (tgtPos.y - srcPos.y) / dist

              // Radius of node circles
              const srcRadius = link.source === rootNode?.id ? 28 : 22
              const tgtRadius = link.target === rootNode?.id ? 28 : 22

              const x1 = srcPos.x + uX * srcRadius
              const y1 = srcPos.y + uY * srcRadius
              const x2 = tgtPos.x - uX * (tgtRadius + 6)
              const y2 = tgtPos.y - uY * (tgtRadius + 6)

              const midX = (srcPos.x + tgtPos.x) / 2
              const midY = (srcPos.y + tgtPos.y) / 2

              const pillWidth = Math.max(90, link.relationship.length * 6.5 + 20)

              return (
                <g key={`edge-${link.key}`}>
                  {/* Directed Edge Line */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={link.color}
                    strokeWidth={link.color === "#475569" ? "1.8" : "2.4"}
                    strokeLinecap="round"
                    markerEnd={`url(#${link.markerId})`}
                  />

                  {/* Relationship Label Pill */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-pillWidth / 2}
                      y="-9"
                      width={pillWidth}
                      height="18"
                      rx="4"
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeWidth="1"
                      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.06))" }}
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="600"
                      fill="#1e293b"
                      letterSpacing="0.01em"
                    >
                      {link.relationship}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>

          {/* ─── 2. BULLSEYE CONCENTRIC NODES (EXACT SCREENSHOT STYLE) ──── */}
          <g className="nodes-layer">
            {currentVisibleNodes.map((node) => {
              const pos = nodePositions.get(node.id)
              if (!pos) return null

              const isRoot = node.id === rootNode?.id
              const isSelected = selectedId === node.id || (!selectedId && isRoot)
              const alertTag = getFinancialAlertTag(node)
              const coreColor = getFinancialCoreColor(node)

              const labelWidth = Math.max(110, Math.min(270, node.label.length * 7.4 + 28))

              return (
                <g
                  key={`node-${node.id}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => {
                    onNodeClick(node)
                    // If node is root and only 1 node is visible, click expands all
                    if (isRoot && visibleNodeIds.size === 1) {
                      handleExpandAll()
                    } else {
                      handleExpandNode(node.id)
                    }
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* ── A. Top Alert Pill perched above circle ── */}
                  <g transform="translate(0, -32)">
                    <rect
                      x="-54"
                      y="-10"
                      width="108"
                      height="20"
                      rx="5"
                      fill="#b91c1c"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="800"
                      fill="#ffffff"
                      letterSpacing="0.04em"
                    >
                      {alertTag}
                    </text>
                  </g>

                  {/* ── B. Concentric Bullseye Circles ── */}
                  {/* Selection Halo */}
                  {isSelected && (
                    <circle
                      cx="0"
                      cy="0"
                      r={isRoot ? 35 : 29}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.8"
                      opacity="0.85"
                    />
                  )}

                  {/* Outer Dotted Halo */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isRoot ? 28 : 22}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="1.6"
                    strokeDasharray="3 3"
                  />

                  {/* Solid Black Ring */}
                  <circle
                    cx="0"
                    cy="0"
                    r={isRoot ? 22 : 17}
                    fill="#0f172a"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                  />

                  {/* Vibrant Core Disk */}
                  <circle cx="0" cy="0" r={isRoot ? 18 : 14} fill={coreColor} />

                  {/* Center White Bullseye Dot */}
                  <circle cx="0" cy="0" r="4.5" fill="#ffffff" />

                  {/* ── C. Expand Chevron Indicator on Circle Rim (1:30 position) ── */}
                  <g
                    transform="translate(15, -14)"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (visibleNodeIds.size === 1) {
                        handleExpandAll()
                      } else {
                        handleExpandNode(node.id)
                      }
                    }}
                    title="Expand connected entities"
                  >
                    <circle cx="0" cy="0" r="6" fill="#ffffff" stroke="#0f172a" strokeWidth="1.4" />
                    <polygon points="-3,-1.5 3,-1.5 0,2.5" fill="#0f172a" />
                  </g>

                  {/* ── D. Label Pill Card Below Circle ── */}
                  <g transform="translate(0, 32)">
                    <rect
                      x={-labelWidth / 2}
                      y="-1"
                      width={labelWidth}
                      height="24"
                      rx="6"
                      fill="#ffffff"
                      stroke={isSelected ? "#2563eb" : "#0f172a"}
                      strokeWidth={isSelected ? "2.2" : "1.6"}
                      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.06))" }}
                    />
                    <text
                      x="0"
                      y="15"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="700"
                      fill="#0f172a"
                    >
                      {node.label}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>
        </g>
      </svg>
    </div>
  )
}
