import React, { useMemo, useState, useRef, useEffect, useCallback } from "react"
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  ShieldCheck,
  Search,
  Maximize2,
  Minimize2,
  GitBranch,
  Layers,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Filter,
  Eye,
  Plus,
  Minus,
  Check,
  Compass,
  Zap,
  Activity,
  Maximize,
} from "lucide-react"
import type { GraphNode, GraphEdge, EvidenceItem } from "@/types/api.types"
import {
  classifyNodeSector,
  SECTOR_CONFIGS,
  type SectorCategory,
} from "@/utils/sectorClassifier"

export type LayoutMode = "hierarchical" | "radial" | "force"

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
  // Optional external controls to expand/collapse from parent
  externalExpandTrigger?: { nodeId: string; action: "expand" | "collapse" } | null
}

export type EntityType =
  | "root"
  | "sector"
  | "company"
  | "commodity"
  | "macro"
  | "metric"

export function getEntityType(node: GraphNode): EntityType {
  if (node.hop === 0) return "root"
  const cat = (node.category || "").toLowerCase()
  const lbl = (node.label || "").toLowerCase()
  if (cat.includes("commodity") || lbl.includes("crude") || lbl.includes("oil") || lbl.includes("gas")) {
    return "commodity"
  }
  if (cat.includes("sector") || lbl.includes("sector")) {
    return "sector"
  }
  if (node.ticker || cat.includes("asset") || cat.includes("equity") || cat.includes("company")) {
    return "company"
  }
  if (cat.includes("macro") || lbl.includes("inflation") || lbl.includes("rate") || lbl.includes("yield")) {
    return "macro"
  }
  return "metric"
}

interface SectorLaneBox {
  sector: SectorCategory
  minY: number
  maxY: number
  minX: number
  maxX: number
  nodeCount: number
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
  // Canvas dimensions
  const canvasWidth = 1350
  const canvasHeight = 780
  const containerRef = useRef<HTMLDivElement>(null)

  // Viewport navigation
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 40, y: 30 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Layout mode (Hierarchical is default per requirement)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("hierarchical")
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)

  // ─── 1. ROOT NODE IDENTIFICATION ──────────────────────────────────────────
  const rootNode = useMemo(() => {
    return nodes.find((n) => n.hop === 0) || nodes[0] || null
  }, [nodes])

  // ─── 2. PROGRESSIVE EXPANSION STATE ───────────────────────────────────────
  // visibleNodeIds initially starts with ONLY the root node!
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(() => {
    return rootNode ? new Set([rootNode.id]) : new Set()
  })
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set())

  // Reset to root node when nodes dataset changes (new event analyzed)
  const prevRootIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (rootNode && rootNode.id !== prevRootIdRef.current) {
      prevRootIdRef.current = rootNode.id
      setVisibleNodeIds(new Set([rootNode.id]))
      setExpandedNodeIds(new Set())
      setPan({ x: 120, y: 40 })
      setZoom(0.88)
    }
  }, [rootNode])

  // Synchronize external expansion trigger from side panel
  useEffect(() => {
    if (!externalExpandTrigger) return
    const { nodeId, action } = externalExpandTrigger
    if (action === "expand") {
      handleExpandNode(nodeId)
    } else if (action === "collapse") {
      handleCollapseNode(nodeId)
    }
  }, [externalExpandTrigger])

  // Build full adjacency map for instant progressive lookup
  const { adjacencyMap, reverseAdjacencyMap, allNeighborsMap } = useMemo(() => {
    const adj = new Map<string, string[]>()
    const rev = new Map<string, string[]>()
    const all = new Map<string, string[]>()

    nodes.forEach((n) => {
      adj.set(n.id, [])
      rev.set(n.id, [])
      all.set(n.id, [])
    })

    edges.forEach((e) => {
      if (adj.has(e.source)) adj.get(e.source)!.push(e.target)
      if (rev.has(e.target)) rev.get(e.target)!.push(e.source)
      if (all.has(e.source) && !all.get(e.source)!.includes(e.target)) {
        all.get(e.source)!.push(e.target)
      }
      if (all.has(e.target) && !all.get(e.target)!.includes(e.source)) {
        all.get(e.target)!.push(e.source)
      }
    })

    // If edges are sparse, wire sequential hop levels gracefully
    nodes.forEach((n) => {
      if ((all.get(n.id) || []).length === 0) {
        const nextHopNodes = nodes.filter((cand) => cand.hop === n.hop + 1)
        nextHopNodes.forEach((child) => {
          if (!all.get(n.id)!.includes(child.id)) all.get(n.id)!.push(child.id)
          if (!all.get(child.id)!.includes(n.id)) all.get(child.id)!.push(n.id)
        })
      }
    })

    return { adjacencyMap: adj, reverseAdjacencyMap: rev, allNeighborsMap: all }
  }, [nodes, edges])

  // ─── 3. EXPAND / COLLAPSE HANDLERS ────────────────────────────────────────
  const handleExpandNode = useCallback(
    (nodeId: string) => {
      const neighbors = allNeighborsMap.get(nodeId) || []
      const maxHop = activeHopFilter === "all" ? 4 : activeHopFilter

      setVisibleNodeIds((prev) => {
        const next = new Set(prev)
        neighbors.forEach((nbrId) => {
          const nbrNode = nodes.find((n) => n.id === nbrId)
          if (nbrNode && nbrNode.hop <= maxHop) {
            next.add(nbrId)
          }
        })
        return next
      })

      setExpandedNodeIds((prev) => {
        const next = new Set(prev)
        next.add(nodeId)
        return next
      })
    },
    [allNeighborsMap, activeHopFilter, nodes],
  )

  const handleCollapseNode = useCallback(
    (nodeId: string) => {
      if (nodeId === rootNode?.id) {
        // Reset to only root
        setVisibleNodeIds(new Set([rootNode.id]))
        setExpandedNodeIds(new Set())
        return
      }

      // Find descendants that are uniquely reachable through this node
      const children = adjacencyMap.get(nodeId) || []
      setVisibleNodeIds((prev) => {
        const next = new Set(prev)
        children.forEach((cId) => {
          // Keep if child is connected to other visible nodes
          const otherParents = (reverseAdjacencyMap.get(cId) || []).filter(
            (p) => p !== nodeId && prev.has(p),
          )
          if (otherParents.length === 0) {
            next.delete(cId)
          }
        })
        return next
      })

      setExpandedNodeIds((prev) => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    },
    [rootNode, adjacencyMap, reverseAdjacencyMap],
  )

  const handleExpandAll = useCallback(() => {
    const maxHop = activeHopFilter === "all" ? 4 : activeHopFilter
    const allFilteredIds = nodes.filter((n) => n.hop <= maxHop).map((n) => n.id)
    setVisibleNodeIds(new Set(allFilteredIds))
    setExpandedNodeIds(new Set(allFilteredIds))
  }, [nodes, activeHopFilter])

  const handleReset = useCallback(() => {
    if (rootNode) {
      setVisibleNodeIds(new Set([rootNode.id]))
      setExpandedNodeIds(new Set())
      onNodeClick(rootNode)
      setPan({ x: 120, y: 40 })
      setZoom(0.88)
    }
  }, [rootNode, onNodeClick])

  // Filter visible nodes list (stable, no duplicates)
  const currentVisibleNodes = useMemo(() => {
    const maxHop = activeHopFilter === "all" ? 4 : activeHopFilter
    const nodeMap = new Map<string, GraphNode>()
    nodes.forEach((n) => {
      if (visibleNodeIds.has(n.id) && n.hop <= maxHop) {
        nodeMap.set(n.id, n) // Deduplication by stable id
      }
    })
    return Array.from(nodeMap.values())
  }, [nodes, visibleNodeIds, activeHopFilter])

  // Active selected node
  const activeNode = useMemo(() => {
    if (selectedId) {
      const match = nodes.find((n) => n.id === selectedId)
      if (match) return match
    }
    return rootNode || currentVisibleNodes[0] || null
  }, [selectedId, nodes, rootNode, currentVisibleNodes])

  // Calculate unexpanded neighbor counts for each visible node
  const unexpandedNeighborCounts = useMemo(() => {
    const counts = new Map<string, number>()
    const maxHop = activeHopFilter === "all" ? 4 : activeHopFilter

    currentVisibleNodes.forEach((n) => {
      const allNbrs = allNeighborsMap.get(n.id) || []
      const unrevealed = allNbrs.filter((nbrId) => {
        const targetNode = nodes.find((cand) => cand.id === nbrId)
        return targetNode && targetNode.hop <= maxHop && !visibleNodeIds.has(nbrId)
      })
      counts.set(n.id, unrevealed.length)
    })
    return counts
  }, [currentVisibleNodes, allNeighborsMap, nodes, activeHopFilter, visibleNodeIds])

  // ─── 4. PATH HIGHLIGHTING ENGINE ──────────────────────────────────────────
  // Compute ancestor path to root and downstream descendants
  const { highlightedNodeIds, highlightedEdgeKeys } = useMemo(() => {
    const focusId = hoveredNodeId || selectedId
    const nodeIds = new Set<string>()
    const edgeKeys = new Set<string>()

    if (!focusId) return { highlightedNodeIds: nodeIds, highlightedEdgeKeys: edgeKeys }

    nodeIds.add(focusId)

    // Traverse ancestors back to root
    const queueUp = [focusId]
    const visitedUp = new Set([focusId])
    while (queueUp.length > 0) {
      const curr = queueUp.shift()!
      const parents = reverseAdjacencyMap.get(curr) || []
      parents.forEach((p) => {
        if (visibleNodeIds.has(p)) {
          nodeIds.add(p)
          edgeKeys.add(`${p}->${curr}`)
          if (!visitedUp.has(p)) {
            visitedUp.add(p)
            queueUp.push(p)
          }
        }
      })
    }

    // Traverse immediate forward descendants
    const children = adjacencyMap.get(focusId) || []
    children.forEach((c) => {
      if (visibleNodeIds.has(c)) {
        nodeIds.add(c)
        edgeKeys.add(`${focusId}->${c}`)
      }
    })

    return { highlightedNodeIds: nodeIds, highlightedEdgeKeys: edgeKeys }
  }, [hoveredNodeId, selectedId, reverseAdjacencyMap, adjacencyMap, visibleNodeIds])

  // ─── 5. LAYOUT ALGORITHMS & SECTOR GROUPING ───────────────────────────────
  const { nodePositions, sectorLanes } = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>()
    const lanes: SectorLaneBox[] = []

    if (currentVisibleNodes.length === 0) {
      return { nodePositions: posMap, sectorLanes: lanes }
    }

    // Root only centered
    if (currentVisibleNodes.length === 1 && rootNode) {
      posMap.set(rootNode.id, { x: 380, y: 320 })
      return { nodePositions: posMap, sectorLanes: lanes }
    }

    if (layoutMode === "hierarchical") {
      // ─── HIERARCHICAL SECTOR-BASED PIPELINE (Default) ────────────────────
      // Columns = Hop Levels (0 to 4)
      // Rows / Clusters = Sectors
      const hopXCoords: Record<number, number> = {
        0: 160,
        1: 440,
        2: 740,
        3: 1040,
        4: 1320,
      }

      // Group nodes by Sector, preserving sector ordering
      const sectorGroups = new Map<SectorCategory, GraphNode[]>()
      currentVisibleNodes.forEach((node) => {
        const sector = classifyNodeSector(node)
        const arr = sectorGroups.get(sector) || []
        arr.push(node)
        sectorGroups.set(sector, arr)
      })

      // Sort sectors with Energy/Commodities and Macro first
      const orderedSectors = Array.from(sectorGroups.keys()).sort((a, b) => {
        if (a === "Energy and Commodities") return -1
        if (b === "Energy and Commodities") return 1
        if (a === "Aviation and Transportation") return -1
        if (b === "Aviation and Transportation") return 1
        return a.localeCompare(b)
      })

      let currentYOffset = 110
      const lanePaddingY = 32

      orderedSectors.forEach((sec) => {
        const secNodes = sectorGroups.get(sec) || []
        // Group sector nodes by hop
        const hopSubgroups = new Map<number, GraphNode[]>()
        secNodes.forEach((n) => {
          const arr = hopSubgroups.get(n.hop) || []
          arr.push(n)
          hopSubgroups.set(n.hop, arr)
        })

        // Find max count in any single hop column for this sector
        let maxColCount = 1
        hopSubgroups.forEach((list) => {
          if (list.length > maxColCount) maxColCount = list.length
        })

        const sectorRowHeight = Math.max(130, maxColCount * 115)
        const laneMinY = currentYOffset - 25
        const laneMaxY = currentYOffset + sectorRowHeight - 15

        let laneMinX = Infinity
        let laneMaxX = -Infinity

        // Position nodes inside this sector
        hopSubgroups.forEach((colNodes, hopLevel) => {
          const x = hopXCoords[hopLevel] ?? 200 + hopLevel * 290
          const cnt = colNodes.length
          const verticalStep = sectorRowHeight / (cnt + 1)

          colNodes.forEach((node, idx) => {
            const y = currentYOffset + (idx + 1) * verticalStep - 20
            posMap.set(node.id, { x, y })
            if (x < laneMinX) laneMinX = x
            if (x > laneMaxX) laneMaxX = x
          })
        })

        if (secNodes.length > 0 && laneMinX !== Infinity) {
          lanes.push({
            sector: sec,
            minY: laneMinY,
            maxY: laneMaxY,
            minX: Math.max(80, laneMinX - 110),
            maxX: laneMaxX + 130,
            nodeCount: secNodes.length,
          })
        }

        currentYOffset += sectorRowHeight + lanePaddingY
      })

      // Ensure root node stays positioned gracefully at Hop 0
      if (rootNode && !posMap.has(rootNode.id)) {
        posMap.set(rootNode.id, { x: 160, y: currentYOffset / 2 })
      }
    } else if (layoutMode === "radial") {
      // ─── RADIAL RIPPLE LAYOUT ─────────────────────────────────────────────
      // Root at center, concentric rings by hop level
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2

      if (rootNode) {
        posMap.set(rootNode.id, { x: centerX, y: centerY })
      }

      const hopRadii: Record<number, number> = { 1: 180, 2: 320, 3: 450, 4: 580 }
      const hopGroups = new Map<number, GraphNode[]>()

      currentVisibleNodes.forEach((n) => {
        if (n.id !== rootNode?.id) {
          const arr = hopGroups.get(n.hop) || []
          arr.push(n)
          hopGroups.set(n.hop, arr)
        }
      })

      hopGroups.forEach((group, hopLevel) => {
        const radius = hopRadii[hopLevel] || hopLevel * 140 + 70
        // Sort group by sector for sector coherence along circumference
        group.sort((a, b) => classifyNodeSector(a).localeCompare(classifyNodeSector(b)))
        const count = group.length
        group.forEach((node, idx) => {
          const angle = (idx / count) * 2 * Math.PI - Math.PI / 2
          posMap.set(node.id, {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          })
        })
      })
    } else {
      // ─── FORCE-DIRECTED EQUILIBRIUM LAYOUT ─────────────────────────────────
      // Spring simulation based on edges and sector cluster gravity
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2

      // Initialize with circular spread
      currentVisibleNodes.forEach((node, idx) => {
        if (node.id === rootNode?.id) {
          posMap.set(node.id, { x: centerX, y: centerY })
        } else {
          const angle = (idx / currentVisibleNodes.length) * 2 * Math.PI
          const r = 160 + node.hop * 110
          posMap.set(node.id, {
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
          })
        }
      })

      // Run 50 iterations of simple force physics
      for (let iter = 0; iter < 50; iter++) {
        const forces = new Map<string, { fx: number; fy: number }>()
        currentVisibleNodes.forEach((n) => forces.set(n.id, { fx: 0, fy: 0 }))

        // Node-node repulsion
        for (let i = 0; i < currentVisibleNodes.length; i++) {
          for (let j = i + 1; j < currentVisibleNodes.length; j++) {
            const idA = currentVisibleNodes[i].id
            const idB = currentVisibleNodes[j].id
            const posA = posMap.get(idA)!
            const posB = posMap.get(idB)!
            const dx = posB.x - posA.x
            const dy = posB.y - posA.y
            const dist = Math.hypot(dx, dy) || 1
            if (dist < 320) {
              const rep = (320 - dist) / dist * 6
              forces.get(idA)!.fx -= dx * rep * 0.1
              forces.get(idA)!.fy -= dy * rep * 0.1
              forces.get(idB)!.fx += dx * rep * 0.1
              forces.get(idB)!.fy += dy * rep * 0.1
            }
          }
        }

        // Edge spring attraction
        edges.forEach((e) => {
          if (posMap.has(e.source) && posMap.has(e.target)) {
            const posA = posMap.get(e.source)!
            const posB = posMap.get(e.target)!
            const dx = posB.x - posA.x
            const dy = posB.y - posA.y
            const dist = Math.hypot(dx, dy) || 1
            const desiredDist = 180
            const spring = (dist - desiredDist) * 0.04
            forces.get(e.source)!.fx += (dx / dist) * spring
            forces.get(e.source)!.fy += (dy / dist) * spring
            forces.get(e.target)!.fx -= (dx / dist) * spring
            forces.get(e.target)!.fy -= (dy / dist) * spring
          }
        })

        // Apply forces (pin root close to center)
        currentVisibleNodes.forEach((n) => {
          if (n.id !== rootNode?.id) {
            const f = forces.get(n.id)!
            const pos = posMap.get(n.id)!
            pos.x = Math.max(120, Math.min(canvasWidth - 120, pos.x + f.fx * 0.3))
            pos.y = Math.max(80, Math.min(canvasHeight - 80, pos.y + f.fy * 0.3))
          }
        })
      }
    }

    return { nodePositions: posMap, sectorLanes: lanes }
  }, [currentVisibleNodes, rootNode, layoutMode, canvasWidth, canvasHeight, edges])

  // ─── 6. VISIBLE EDGES BETWEEN VISIBLE NODES ────────────────────────────────
  const visualLinks = useMemo(() => {
    const visibleIdSet = new Set(currentVisibleNodes.map((n) => n.id))
    const links: {
      key: string
      source: string
      target: string
      relationship: string
      weight: number
      color: string
      type: "observed" | "inferred"
      evidenceId?: string
    }[] = []

    const seenEdges = new Set<string>()

    // 1. Direct explicit graph edges
    edges.forEach((e) => {
      if (visibleIdSet.has(e.source) && visibleIdSet.has(e.target)) {
        const edgeKey = `${e.source}->${e.target}`
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey)
          const isObserved = e.type === "observed"
          links.push({
            key: edgeKey,
            source: e.source,
            target: e.target,
            relationship: e.relationship || "IMPACTS",
            weight: e.weight || 1.0,
            color: isObserved ? "#2563eb" : "#8b5cf6",
            type: isObserved ? "observed" : "inferred",
            evidenceId: e.evidence_id,
          })
        }
      }
    })

    // 2. Synthesize link if parent expanded node to child without explicit edge
    if (links.length === 0 && currentVisibleNodes.length > 1 && rootNode) {
      currentVisibleNodes.forEach((n) => {
        if (n.id !== rootNode.id && n.hop === 1) {
          links.push({
            key: `${rootNode.id}->${n.id}`,
            source: rootNode.id,
            target: n.id,
            relationship: "TRANSMITS_TO",
            weight: 0.9,
            color: "#2563eb",
            type: "observed",
          })
        }
      })
    }

    return links
  }, [edges, currentVisibleNodes, rootNode])

  // ─── 7. FIT TO SCREEN ──────────────────────────────────────────────────────
  const handleFitToScreen = useCallback(() => {
    if (currentVisibleNodes.length === 0) return

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    currentVisibleNodes.forEach((n) => {
      const pos = nodePositions.get(n.id)
      if (pos) {
        if (pos.x < minX) minX = pos.x
        if (pos.x > maxX) maxX = pos.x
        if (pos.y < minY) minY = pos.y
        if (pos.y > maxY) maxY = pos.y
      }
    })

    if (minX === Infinity) return

    const cardWidth = 200
    const cardHeight = 80
    minX -= cardWidth / 2 + 60
    maxX += cardWidth / 2 + 60
    minY -= cardHeight / 2 + 60
    maxY += cardHeight / 2 + 60

    const graphW = Math.max(100, maxX - minX)
    const graphH = Math.max(100, maxY - minY)

    const scaleX = canvasWidth / graphW
    const scaleY = canvasHeight / graphH
    const newZoom = Math.min(1.2, Math.max(0.4, Math.min(scaleX, scaleY) * 0.88))

    const newPanX = (canvasWidth - graphW * newZoom) / 2 - minX * newZoom
    const newPanY = (canvasHeight - graphH * newZoom) / 2 - minY * newZoom

    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [currentVisibleNodes, nodePositions, canvasWidth, canvasHeight])

  // Canvas zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(2.0, Math.round((z + 0.12) * 100) / 100))
  const handleZoomOut = () => setZoom((z) => Math.max(0.35, Math.round((z - 0.12) * 100) / 100))

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking background
    if ((e.target as HTMLElement).tagName === "svg" || (e.target as HTMLElement).id === "graph-bg-rect") {
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
    setZoom((z) => Math.min(2.0, Math.max(0.35, z * zoomFactor)))
  }

  // Search matches
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return nodes.filter((n) => n.label.toLowerCase().includes(q) || (n.ticker && n.ticker.toLowerCase().includes(q)))
  }, [searchQuery, nodes])

  const handleSelectSearchedNode = (node: GraphNode) => {
    // Reveal if hidden
    setVisibleNodeIds((prev) => new Set(prev).add(node.id))
    onNodeClick(node)
    setSearchOpen(false)
    setSearchQuery("")

    const pos = nodePositions.get(node.id)
    if (pos) {
      setPan({
        x: canvasWidth / 2 - pos.x * zoom,
        y: canvasHeight / 2 - pos.y * zoom,
      })
    }
  }

  return (
    <div
      ref={containerRef}
      className={`graph-canvas-wrapper ${isExpandedProp ? "expanded" : ""}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 640,
        height: isExpandedProp ? "calc(100vh - 110px)" : 640,
        borderRadius: 16,
        overflow: "hidden",
        background: "#fafbfc",
        border: "1px solid #dce5ee",
        boxShadow: "0 4px 24px rgba(15, 23, 42, 0.05)",
        cursor: isDraggingCanvas ? "grabbing" : "grab",
        userSelect: "none",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ─── FLOATING CONTROL TOOLBAR (TOP-LEFT) ─────────────────────────── */}
      <div
        className="graph-toolbar-pill"
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 40,
          display: "inline-flex",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.96)",
          backdropFilter: "blur(14px)",
          borderRadius: 24,
          padding: "4px 10px",
          border: "1px solid #dce5ee",
          boxShadow: "0 6px 20px rgba(15, 23, 42, 0.08)",
          gap: 6,
        }}
      >
        {/* Zoom Controls */}
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In (+)"
          style={{
            width: 26,
            height: 26,
            display: "grid",
            placeItems: "center",
            border: 0,
            background: "transparent",
            color: "#0f172a",
            cursor: "pointer",
            borderRadius: 6,
          }}
        >
          <ZoomIn size={14} />
        </button>

        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out (–)"
          style={{
            width: 26,
            height: 26,
            display: "grid",
            placeItems: "center",
            border: 0,
            background: "transparent",
            color: "#0f172a",
            cursor: "pointer",
            borderRadius: 6,
          }}
        >
          <ZoomOut size={14} />
        </button>

        <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", minWidth: 32, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>

        {/* Reset to Root Only */}
        <button
          type="button"
          onClick={handleReset}
          title="Reset to Root Event only"
          style={{
            padding: "4px 8px",
            border: 0,
            background: "transparent",
            color: "#0f172a",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>

        {/* Fit to Screen */}
        <button
          type="button"
          onClick={handleFitToScreen}
          title="Fit graph to canvas"
          style={{
            padding: "4px 8px",
            border: 0,
            background: "transparent",
            color: "#0f172a",
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 6,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Maximize size={12} />
          <span>Fit</span>
        </button>

        <div style={{ width: 1, height: 16, background: "#e2e8f0", margin: "0 2px" }} />

        {/* Expand All / Collapse All */}
        {visibleNodeIds.size < nodes.length ? (
          <button
            type="button"
            onClick={handleExpandAll}
            title="Reveal all connected sectors and downstream nodes"
            style={{
              padding: "4px 10px",
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Sparkles size={12} color="#2563eb" />
            <span>Expand All ({nodes.length})</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            title="Collapse back to root event"
            style={{
              padding: "4px 9px",
              border: "1px solid #dce5ee",
              background: "#f8fafc",
              color: "#475569",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>Collapse to Root</span>
          </button>
        )}

        <div style={{ width: 1, height: 16, background: "#e2e8f0", margin: "0 2px" }} />

        {/* Layout Modes: Hierarchical (Default), Radial, Force */}
        <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 8, padding: 2 }}>
          {(
            [
              { id: "hierarchical", label: "Hierarchical", icon: GitBranch },
              { id: "radial", label: "Radial", icon: Compass },
              { id: "force", label: "Force-Directed", icon: Activity },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setLayoutMode(mode.id)}
              title={`Switch layout: ${mode.label}`}
              style={{
                border: 0,
                background: layoutMode === mode.id ? "#ffffff" : "transparent",
                color: layoutMode === mode.id ? "#2563eb" : "#64748b",
                fontWeight: layoutMode === mode.id ? 700 : 500,
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: layoutMode === mode.id ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s ease",
              }}
            >
              <mode.icon size={11} />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Fullscreen Toggle */}
        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            title={isExpandedProp ? "Exit Fullscreen" : "Fullscreen Canvas"}
            style={{
              width: 26,
              height: 26,
              display: "grid",
              placeItems: "center",
              border: 0,
              background: "transparent",
              color: "#475569",
              cursor: "pointer",
              borderRadius: 6,
            }}
          >
            {isExpandedProp ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>

      {/* ─── SEARCH & QUICK NAV (TOP-CENTER) ─────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 40,
        }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.94)",
              backdropFilter: "blur(12px)",
              borderRadius: 20,
              padding: "4px 12px",
              border: "1px solid #dce5ee",
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
              gap: 6,
            }}
          >
            <Search size={13} color="#64748b" />
            <input
              type="text"
              placeholder="Find entity or sector..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              style={{
                border: 0,
                outline: "none",
                background: "transparent",
                fontSize: 11.5,
                color: "#0f172a",
                width: 140,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ border: 0, background: "none", cursor: "pointer", padding: 0, color: "#94a3b8" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {searchOpen && searchMatches.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 36,
                left: 0,
                width: 240,
                background: "#ffffff",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 25px rgba(15,23,42,0.12)",
                zIndex: 50,
                padding: 4,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {searchMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectSearchedNode(m)}
                  style={{
                    width: "100%",
                    border: 0,
                    background: "transparent",
                    textAlign: "left",
                    padding: "7px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 11.5,
                    color: "#1e293b",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontSize: 9.5, color: "#64748b", background: "#f8fafc", padding: "2px 6px", borderRadius: 4 }}>
                    Hop {m.hop}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── LEGEND DROPDOWN (TOP-RIGHT) ─────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 40,
        }}
      >
        <button
          type="button"
          onClick={() => setLegendOpen(!legendOpen)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(12px)",
            borderRadius: 20,
            padding: "5px 12px",
            border: "1px solid #dce5ee",
            boxShadow: "0 6px 18px rgba(15, 23, 42, 0.08)",
            fontSize: 11.5,
            fontWeight: 600,
            color: "#0f172a",
            cursor: "pointer",
          }}
        >
          <Layers size={13} color="#2563eb" />
          <span>Legend & Sectors</span>
          <ChevronDown size={12} color="#64748b" />
        </button>

        {legendOpen && (
          <div
            style={{
              position: "absolute",
              top: 38,
              right: 0,
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
              padding: 14,
              minWidth: 260,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 11,
              color: "#334155",
              zIndex: 50,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>
              Entity Classification
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "#dc2626" }} />
              <span>Root Market Shock (Hop 0)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "#0284c7" }} />
              <span>Direct Sector Transmission (Hop 1)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "#7c3aed" }} />
              <span>Macroeconomic Contagion (Hop 2)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: "#16a34a" }} />
              <span>Company / Asset Impact (Hop 3–4)</span>
            </div>

            <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />
            <div style={{ fontWeight: 800, fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>
              Transmission Causality
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 22, height: 2.5, background: "#2563eb" }} />
              <span>Observed Ground Truth (Fact)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 22, height: 2, background: "#8b5cf6", borderTop: "2px dashed #8b5cf6" }} />
              <span>Inferred Model Hypothesis</span>
            </div>

            <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />
            <div style={{ fontWeight: 800, fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>
              Progressive Expansion
            </div>
            <p style={{ margin: 0, fontSize: 10.5, color: "#64748b", lineHeight: 1.45 }}>
              Click any node or its <strong>+N</strong> badge to progressively reveal connected sectors and companies.
            </p>
          </div>
        )}
      </div>

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
          {/* Subtle Dot Grid */}
          <pattern id="dot-grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="1.15" fill="#94a3b8" opacity="0.25" />
          </pattern>

          {/* Arrowhead Markers */}
          <marker id="arrow-blue-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 1.5 L 9 5 L 0 8.5 Z" fill="#2563eb" />
          </marker>
          <marker id="arrow-purple-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 1.5 L 9 5 L 0 8.5 Z" fill="#8b5cf6" />
          </marker>
          <marker id="arrow-dimmed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M 0 1.5 L 9 5 L 0 8.5 Z" fill="#cbd5e1" />
          </marker>

          {/* Drop Shadows */}
          <filter id="node-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.08" />
          </filter>
          <filter id="node-glow-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#3b82f6" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Background Clickable Area */}
        <rect id="graph-bg-rect" width={canvasWidth} height={canvasHeight} fill="url(#dot-grid-pattern)" />

        {/* Zoom & Pan Container */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* ─── LAYER 1: SECTOR BACKGROUND LANES (Hierarchical Mode) ───────── */}
          {layoutMode === "hierarchical" && (
            <g className="sector-lanes-layer">
              {sectorLanes.map((lane) => {
                const cfg = SECTOR_CONFIGS[lane.sector] || SECTOR_CONFIGS["Corporate & Diversified"]
                const laneW = Math.max(300, lane.maxX - lane.minX)
                const laneH = Math.max(100, lane.maxY - lane.minY)

                return (
                  <g key={`lane-${lane.sector}`}>
                    {/* Sector Background Region */}
                    <rect
                      x={lane.minX}
                      y={lane.minY}
                      width={laneW}
                      height={laneH}
                      rx="14"
                      fill={cfg.bgColor}
                      stroke={cfg.borderColor}
                      strokeWidth="1.2"
                      strokeDasharray="6 4"
                      style={{ transition: "all 0.3s ease" }}
                    />

                    {/* Sector Lane Heading Tag */}
                    <g transform={`translate(${lane.minX + 16}, ${lane.minY + 16})`}>
                      <rect
                        x="0"
                        y="-12"
                        width={Math.max(140, cfg.shortName.length * 7.5 + 24)}
                        height="24"
                        rx="6"
                        fill="#ffffff"
                        stroke={cfg.borderColor}
                        strokeWidth="1.2"
                        filter="url(#node-card-shadow)"
                      />
                      <circle cx="10" cy="0" r="3.5" fill={cfg.color} />
                      <text
                        x="20"
                        y="4"
                        fontSize="10"
                        fontWeight="800"
                        fill={cfg.color}
                        letterSpacing="0.03em"
                        textTransform="uppercase"
                      >
                        {cfg.shortName}
                      </text>
                    </g>
                  </g>
                )
              })}
            </g>
          )}

          {/* ─── LAYER 2: DIRECTED EDGES & RELATIONSHIP LABELS ────────────── */}
          <g className="edges-layer">
            {visualLinks.map((link) => {
              const srcPos = nodePositions.get(link.source)
              const tgtPos = nodePositions.get(link.target)
              if (!srcPos || !tgtPos) return null

              const isHighlighted = highlightedEdgeKeys.has(link.key)
              const isDimmed = highlightedEdgeKeys.size > 0 && !isHighlighted

              // Connect from right of source to left of target in hierarchical mode
              const cardW = 190
              const cardH = 74

              let x1 = srcPos.x + cardW / 2
              let y1 = srcPos.y
              let x2 = tgtPos.x - cardW / 2
              let y2 = tgtPos.y

              if (layoutMode === "radial" || layoutMode === "force") {
                // Angle based connection
                const angle = Math.atan2(tgtPos.y - srcPos.y, tgtPos.x - srcPos.x)
                x1 = srcPos.x + Math.cos(angle) * (cardW / 2.2)
                y1 = srcPos.y + Math.sin(angle) * (cardH / 2.2)
                x2 = tgtPos.x - Math.cos(angle) * (cardW / 2.2)
                y2 = tgtPos.y - Math.sin(angle) * (cardH / 2.2)
              }

              // Smooth Bezier Curve
              const dx = Math.abs(x2 - x1) * 0.5
              const pathD =
                layoutMode === "hierarchical"
                  ? `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
                  : `M ${x1} ${y1} L ${x2} ${y2}`

              const midX = (x1 + x2) / 2
              const midY = (y1 + y2) / 2

              const markerId = isDimmed
                ? "arrow-dimmed"
                : link.type === "observed"
                  ? "arrow-blue-solid"
                  : "arrow-purple-solid"

              const labelWidth = Math.max(90, link.relationship.length * 6.5 + 20)

              return (
                <g key={`edge-${link.key}`} style={{ opacity: isDimmed ? 0.25 : 1.0, transition: "opacity 0.2s ease" }}>
                  {/* Outer edge glow when highlighted */}
                  {isHighlighted && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={link.color}
                      strokeWidth="7"
                      opacity="0.25"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Main Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={link.color}
                    strokeWidth={isHighlighted ? "2.6" : "1.8"}
                    strokeDasharray={link.type === "inferred" ? "5 4" : undefined}
                    markerEnd={`url(#${markerId})`}
                  />

                  {/* Flow animation indicator along active edge */}
                  {isHighlighted && (
                    <circle r="3.2" fill="#ffffff" stroke={link.color} strokeWidth="1.8">
                      <animateMotion path={pathD} dur="2.4s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Relationship Label Pill */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-labelWidth / 2}
                      y="-10"
                      width={labelWidth}
                      height="20"
                      rx="5"
                      fill="#ffffff"
                      stroke={isHighlighted ? link.color : "#dce5ee"}
                      strokeWidth={isHighlighted ? "1.6" : "1"}
                      filter="url(#node-card-shadow)"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill={isHighlighted ? link.color : "#334155"}
                      letterSpacing="0.02em"
                    >
                      {link.relationship.replace(/_/g, " ")}
                    </text>
                  </g>
                </g>
              )
            })}
          </g>

          {/* ─── LAYER 3: PROGRESSIVE ENTERPRISE NODE CARDS ────────────────── */}
          <g className="nodes-layer">
            {currentVisibleNodes.map((node) => {
              const pos = nodePositions.get(node.id)
              if (!pos) return null

              const isRoot = node.id === rootNode?.id
              const isSelected = selectedId === node.id || (!selectedId && isRoot)
              const isHovered = hoveredNodeId === node.id
              const isHighlighted = highlightedNodeIds.has(node.id)
              const isDimmed = highlightedNodeIds.size > 0 && !isHighlighted

              const unexpandedCount = unexpandedNeighborCounts.get(node.id) || 0
              const isExpandable = unexpandedCount > 0
              const sector = classifyNodeSector(node)
              const secCfg = SECTOR_CONFIGS[sector] || SECTOR_CONFIGS["Corporate & Diversified"]
              const entityType = getEntityType(node)

              const cardW = 194
              const cardH = 76

              // Sentiment styling
              const sentimentSign =
                node.sentiment === "positive" ? "+" : node.sentiment === "negative" ? "–" : "~"
              const sentimentColor =
                node.sentiment === "positive"
                  ? "#16a34a"
                  : node.sentiment === "negative"
                    ? "#dc2626"
                    : "#64748b"
              const sentimentBg =
                node.sentiment === "positive"
                  ? "#dcfce7"
                  : node.sentiment === "negative"
                    ? "#fee2e2"
                    : "#f1f5f9"

              return (
                <g
                  key={`node-${node.id}`}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onNodeClick(node)
                    // If node has unexpanded neighbors, expand on click
                    if (isExpandable) {
                      handleExpandNode(node.id)
                    }
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{
                    cursor: "pointer",
                    opacity: isDimmed ? 0.3 : 1.0,
                    transition: "opacity 0.2s ease",
                  }}
                >
                  {/* ─── Pulsing Beacon for Root Event on Initial State ─── */}
                  {isRoot && visibleNodeIds.size === 1 && (
                    <g>
                      <circle cx="0" cy="0" r="105" fill="none" stroke="#2563eb" strokeWidth="2" opacity="0.35">
                        <animate attributeName="r" values="90;120;90" dur="2.4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.45;0.05;0.45" dur="2.4s" repeatCount="indefinite" />
                      </circle>
                    </g>
                  )}

                  {/* Card Background Container */}
                  <rect
                    x={-cardW / 2}
                    y={-cardH / 2}
                    width={cardW}
                    height={cardH}
                    rx="12"
                    fill="#ffffff"
                    stroke={
                      isSelected
                        ? "#2563eb"
                        : isHovered
                          ? "#3b82f6"
                          : isRoot
                            ? "#b45309"
                            : "#dce5ee"
                    }
                    strokeWidth={isSelected ? "2.4" : isRoot ? "2" : "1.4"}
                    filter={isSelected ? "url(#node-glow-shadow)" : "url(#node-card-shadow)"}
                  />

                  {/* Left Accent Color Strip */}
                  <path
                    d={`M ${-cardW / 2} ${-cardH / 2 + 12} A 12 12 0 0 1 ${-cardW / 2 + 5} ${-cardH / 2} L ${-cardW / 2 + 5} ${cardH / 2} A 12 12 0 0 1 ${-cardW / 2} ${cardH / 2 - 12} Z`}
                    fill={isRoot ? "#dc2626" : secCfg.accentColor}
                  />

                  {/* ─── Top Row: Type Badge + Sentiment ─── */}
                  <g transform={`translate(${-cardW / 2 + 14}, ${-cardH / 2 + 16})`}>
                    {/* Entity Type Pill */}
                    <rect
                      x="0"
                      y="-8"
                      width={isRoot ? 82 : node.ticker ? 64 : 54}
                      height="16"
                      rx="4"
                      fill={isRoot ? "#fef2f2" : "#f1f5f9"}
                      stroke={isRoot ? "#fecaca" : "#e2e8f0"}
                      strokeWidth="1"
                    />
                    <text
                      x="6"
                      y="4"
                      fontSize="8.5"
                      fontWeight="800"
                      fill={isRoot ? "#b91c1c" : "#475569"}
                      letterSpacing="0.02em"
                      textTransform="uppercase"
                    >
                      {isRoot ? "ROOT SHOCK" : node.ticker ? `$${node.ticker}` : entityType}
                    </text>
                  </g>

                  {/* Sentiment Dot & Magnitude */}
                  <g transform={`translate(${cardW / 2 - 18}, ${-cardH / 2 + 16})`}>
                    <circle cx="0" cy="0" r="8" fill={sentimentBg} stroke={sentimentColor} strokeWidth="1.2" />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="900"
                      fill={sentimentColor}
                    >
                      {sentimentSign}
                    </text>
                  </g>

                  {/* ─── Middle Row: Node Label ─── */}
                  <text
                    x={-cardW / 2 + 14}
                    y={5}
                    fontSize="11.5"
                    fontWeight="700"
                    fill="#0f172a"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label}
                  </text>

                  {/* ─── Bottom Row: Sector Tag & Hop Distance ─── */}
                  <g transform={`translate(${-cardW / 2 + 14}, ${cardH / 2 - 12})`}>
                    <text fontSize="9.5" fontWeight="600" fill="#64748b">
                      {secCfg.shortName.length > 18 ? `${secCfg.shortName.slice(0, 16)}…` : secCfg.shortName} · Hop {node.hop}
                    </text>
                  </g>

                  {/* ─── Expand / Collapse Indicator Pill ─── */}
                  {isExpandable ? (
                    <g
                      transform={`translate(${cardW / 2 - 28}, ${cardH / 2 - 14})`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleExpandNode(node.id)
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x="-16"
                        y="-10"
                        width="36"
                        height="18"
                        rx="9"
                        fill="#eff6ff"
                        stroke="#3b82f6"
                        strokeWidth="1.2"
                      />
                      <text
                        x="2"
                        y="3"
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="800"
                        fill="#1d4ed8"
                      >
                        +{unexpandedCount}
                      </text>
                    </g>
                  ) : expandedNodeIds.has(node.id) && !isRoot ? (
                    <g
                      transform={`translate(${cardW / 2 - 20}, ${cardH / 2 - 14})`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCollapseNode(node.id)
                      }}
                      title="Collapse this branch"
                      style={{ cursor: "pointer" }}
                    >
                      <circle cx="0" cy="0" r="7.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                      <Minus size={9} color="#64748b" style={{ transform: "translate(-4.5px, -4.5px)" }} />
                    </g>
                  ) : null}

                  {/* Click to Expand Prompt for Root on Initial View */}
                  {isRoot && visibleNodeIds.size === 1 && (
                    <g transform={`translate(0, ${cardH / 2 + 22})`}>
                      <rect
                        x="-86"
                        y="-11"
                        width="172"
                        height="22"
                        rx="11"
                        fill="#2563eb"
                        filter="url(#node-card-shadow)"
                      />
                      <text
                        x="0"
                        y="4"
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="800"
                        fill="#ffffff"
                        letterSpacing="0.02em"
                      >
                        ⚡ Click to Reveal Network ({nodes.length - 1})
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </g>
        </g>
      </svg>
    </div>
  )
}
