import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Minimize2,
  Maximize2,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Layers,
} from "lucide-react"
import type { GraphResponse, GraphNode, TimeSeriesResponse, EvidenceItem } from "@/types/api.types"

export interface AICoPilotProps {
  graphData: GraphResponse | null
  selectedNode: GraphNode | null
  timeSeriesData?: TimeSeriesResponse | null
  query: string
  isOpen: boolean
  onClose: () => void
  onNavigateToNode?: (nodeId: string) => void
  onNavigateToPage?: (page: "graph" | "path" | "timeseries" | "evidence") => void
}

interface ChatMessage {
  id: string
  sender: "user" | "copilot"
  text: string
  timestamp: string
  category?: "analysis" | "risk" | "evidence" | "scenario"
  highlightNodes?: string[]
}

const QUICK_PROMPTS = [
  { label: "Summarize Causal Chain", prompt: "Explain the full multi-hop causal transmission chain from Hop 0 to downstream market." },
  { label: "Downstream Asset Risks", prompt: "Which assets and sectors face the highest negative risk exposure in this scenario?" },
  { label: "Audit XAI Evidence", prompt: "Which causal links in this graph are Observed Facts vs Inferred Relationships?" },
  { label: "What-If Scenario", prompt: "What happens if this commodity shock increases by an additional 15%?" },
]

export function AICoPilot({
  graphData,
  selectedNode,
  timeSeriesData,
  query,
  isOpen,
  onClose,
  onNavigateToNode,
  onNavigateToPage,
}: AICoPilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize greeting on query change
  useEffect(() => {
    if (!graphData) {
      setMessages([
        {
          id: "welcome-init",
          sender: "copilot",
          text: "Hello! I am your Financial Impact Co-Pilot. Please trigger an analysis from the Control Center or enter a financial headline to begin reasoning over event networks.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
      return
    }

    const rootLabel = graphData.root_event?.label || graphData.nodes[0]?.label || query || "Current Event"
    const nodeCount = graphData.nodes.length
    const edgeCount = graphData.edges.length
    const affectedCount = graphData.affected_assets.length

    setMessages([
      {
        id: `welcome-${graphData.query || "active"}`,
        sender: "copilot",
        text: `I have analyzed the event propagation network for **"${rootLabel}"**.\n\n` +
          `• **Topological Scope:** ${nodeCount} nodes across 4 causal hops, linked by ${edgeCount} transmission edges.\n` +
          `• **Asset Coverage:** ${affectedCount} correlated equity/commodity assets identified.\n\n` +
          `Ask me anything about sector spillover, evidence audit trails, or quantitative correlation risks!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        category: "analysis",
      },
    ])
  }, [graphData, query])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // Contextual synthesis generator
  const generateResponse = (prompt: string): string => {
    if (!graphData) {
      return "No active financial event graph is loaded. Please run an event analysis first."
    }

    const lower = prompt.toLowerCase()
    const rootLabel = graphData.root_event?.label || graphData.nodes[0]?.label || "Root Event"

    // 1. Evidence audit
    if (lower.includes("evidence") || lower.includes("fact") || lower.includes("infer") || lower.includes("audit")) {
      const facts = graphData.edges.filter((e) => e.type === "observed")
      const inferences = graphData.edges.filter((e) => e.type === "inferred")

      return (
        `### 🛡️ XAI Evidence & Grounding Audit\n\n` +
        `• **Observed Facts (${facts.length} links):** Backed by explicit wire disclosures, corporate filings, or spot benchmarks.\n` +
        `• **Inferred Relationships (${inferences.length} links):** Deductions derived from multi-hop macroeconomic transmission (cost pass-through, refining margin compression, credit conditions).\n\n` +
        `**Key Causal Rationale:**\n` +
        graphData.edges
          .slice(0, 3)
          .map((e, idx) => {
            const ev = graphData.evidence[e.evidence_id]
            const u = graphData.nodes.find((n) => n.id === e.source)?.label || e.source
            const v = graphData.nodes.find((n) => n.id === e.target)?.label || e.target
            return `${idx + 1}. **${u} ➔ ${v}** (${ev?.badge || "Inferred"}):\n   _${ev?.text || "Economic transmission link."}_ (Confidence: ${ev?.confidence || 80}%)`
          })
          .join("\n\n")
      )
    }

    // 2. Risk & Asset exposure
    if (lower.includes("risk") || lower.includes("asset") || lower.includes("exposure") || lower.includes("loser") || lower.includes("winner")) {
      const negativeAssets = graphData.affected_assets.filter((a) => a.direction === "negative")
      const positiveAssets = graphData.affected_assets.filter((a) => a.direction === "positive")

      let reply = `### ⚠️ Asset Risk & Sector Transmission Profile\n\n`
      if (negativeAssets.length > 0) {
        reply += `**Downside Margin Contagion:**\n`
        reply += negativeAssets
          .map((a) => `• **$${a.ticker}** (${a.name}): Impact delta **${a.impact_delta}** with ${a.confidence}% model confidence.`)
          .join("\n")
        reply += `\n\n`
      }
      if (positiveAssets.length > 0) {
        reply += `**Upside Beneficiaries:**\n`
        reply += positiveAssets
          .map((a) => `• **$${a.ticker}** (${a.name}): Impact delta **${a.impact_delta}** with ${a.confidence}% model confidence.`)
          .join("\n")
        reply += `\n\n`
      }
      reply += `Benchmark S&P 500 absorption factor indicates broad index sensitivity of **${graphData.affected_assets[graphData.affected_assets.length - 1]?.impact_delta || "moderate"}**.`
      return reply
    }

    // 3. What-if scenario
    if (lower.includes("what if") || lower.includes("scenario") || lower.includes("increase") || lower.includes("surge") || lower.includes("shock")) {
      return (
        `### 🔮 What-If Propagation Stress Test (+15% Shock)\n\n` +
        `1. **Hop 1 (Direct Factor):** Primary benchmark volatility expands by an estimated 1.35x variance multiplier.\n` +
        `2. **Hop 2 (Sector Spread):** Sector ETFs (e.g. ${graphData.nodes[2]?.label || "Sector"}) experience accelerated crack spread/margin compression.\n` +
        `3. **Hop 3 (Target Equities):** Correlated assets face steeper beta re-pricing; hedging demand accelerates for short-duration cash flow assets.\n` +
        `4. **Downstream Feedback:** Benchmark Pearson correlation shifts upward toward systemic risk convergence.`
      )
    }

    // 4. Default causal chain explanation
    const chainSteps = graphData.hop_chain
      .map((h) => `• **Hop ${h.hop} (${h.category}):** **${h.label}** [${h.impact_delta}] — _${h.description}_`)
      .join("\n")

    return (
      `### 🌐 Multi-Hop Propagation Synthesis: "${rootLabel}"\n\n` +
      `Here is the step-by-step causal transmission path computed by the NetworkX graph engine:\n\n` +
      `${chainSteps}\n\n` +
      `**Analyst Takeaway:** The primary shock at Hop 0 attenuates from initial factor displacement to broader enterprise valuation repricing at Hop 4.`
    )
  }

  const handleSend = (textToSend?: string) => {
    const rawText = textToSend || inputValue
    if (!rawText.trim() || isTyping) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: rawText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInputValue("")
    setIsTyping(true)

    // Simulate fast analytical reasoning
    setTimeout(() => {
      const responseText = generateResponse(rawText)
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "copilot",
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, botMsg])
      setIsTyping(false)
    }, 450)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="copilot-panel-wrapper"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.22 }}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: isMinimized ? 320 : 440,
          height: isMinimized ? 56 : 600,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(226, 232, 240, 0.9)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "inherit",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Sparkles size={15} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                Financial AI Co-Pilot
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: 10,
                    background: "rgba(59, 130, 246, 0.25)",
                    color: "#93c5fd",
                    border: "1px solid rgba(147, 197, 253, 0.3)",
                  }}
                >
                  XAI REASONING
                </span>
              </div>
              {!isMinimized && (
                <div style={{ fontSize: 10.5, color: "#94a3b8" }}>
                  {graphData ? `Context: ${graphData.nodes.length} nodes · 4 hops` : "Ready for events"}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              style={{
                background: "transparent",
                border: 0,
                color: "#94a3b8",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                display: "grid",
                placeItems: "center",
              }}
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: 0,
                color: "#94a3b8",
                cursor: "pointer",
                padding: 4,
                borderRadius: 6,
                display: "grid",
                placeItems: "center",
              }}
              title="Close Co-Pilot"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Context Node Banner */}
            {selectedNode && (
              <div
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  padding: "7px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#475569",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Layers size={12} color="#3b82f6" />
                  Active Focus: <strong>{selectedNode.label}</strong> (Hop {selectedNode.hop})
                </span>
                <span style={{ fontSize: 10, color: "#64748b" }}>
                  {selectedNode.ticker ? `$${selectedNode.ticker}` : selectedNode.category}
                </span>
              </div>
            )}

            {/* Messages Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                background: "#fbfcfe",
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: m.sender === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      maxWidth: "88%",
                      flexDirection: m.sender === "user" ? "row-reverse" : "row",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: m.sender === "user" ? "#2563eb" : "#f1f5f9",
                        color: m.sender === "user" ? "#ffffff" : "#475569",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {m.sender === "user" ? <User size={13} /> : <Bot size={13} color="#2563eb" />}
                    </div>

                    <div
                      style={{
                        background: m.sender === "user" ? "#2563eb" : "#ffffff",
                        color: m.sender === "user" ? "#ffffff" : "#1e293b",
                        padding: "10px 14px",
                        borderRadius: 12,
                        fontSize: 12,
                        lineHeight: 1.55,
                        boxShadow:
                          m.sender === "user"
                            ? "0 2px 8px rgba(37,99,235,0.2)"
                            : "0 2px 6px rgba(15,23,42,0.06), 0 0 0 1px #e2e8f0",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9.5,
                      color: "#94a3b8",
                      margin: "3px 32px 0",
                    }}
                  >
                    {m.timestamp}
                  </span>
                </div>
              ))}

              {isTyping && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: "#f1f5f9",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Bot size={13} color="#2563eb" />
                  </div>
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      padding: "8px 12px",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RefreshCw size={11} className="spin" />
                    <span>Reasoning over graph topology & market evidence...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div
              style={{
                padding: "8px 12px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                gap: 6,
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => handleSend(q.prompt)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: "4px 9px",
                    borderRadius: 14,
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Sparkles size={10} color="#3b82f6" />
                  {q.label}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div
              style={{
                padding: "10px 12px",
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Ask Co-Pilot about transmission risk, assets, or XAI..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                style={{
                  flex: 1,
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12,
                  outline: "none",
                  color: "#0f172a",
                }}
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isTyping}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: inputValue.trim() && !isTyping ? "#2563eb" : "#e2e8f0",
                  color: "#ffffff",
                  border: 0,
                  cursor: inputValue.trim() && !isTyping ? "pointer" : "default",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  transition: "background 0.15s ease",
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
