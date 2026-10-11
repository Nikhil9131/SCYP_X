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
  { label: "Explain in Simple Terms", prompt: "Explain this event in simple language." },
  { label: "Oil Impact on Inflation", prompt: "How can rising crude oil prices affect inflation?" },
  { label: "Why Interest Rates Shift", prompt: "Why might interest-rate expectations change?" },
  { label: "Indirect Sectors Affected", prompt: "Which sectors could be affected indirectly?" },
  { label: "Path: Oil to Real Estate", prompt: "Show the path from oil prices to real estate." },
  { label: "Evidence Audit", prompt: "What evidence supports this relationship?" },
  { label: "Uncertain Relationships", prompt: "Which relationships are uncertain?" },
  { label: "Mitigating Factors", prompt: "What other factors could reduce this impact?" },
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
        text: `I have analyzed the financial impact graph for **"${rootLabel}"**.\n\n` +
          `• **Topology:** ${nodeCount} financial entities across 4 causal hops, connected by ${edgeCount} dependency edges.\n` +
          `• **Asset Universe:** ${affectedCount} correlated instruments & sectors modeled across monetary policy, banking, real estate, energy, and transportation.\n\n` +
          `Ask me anything about causal pathways, evidence backing, interest rates, or mitigating factors!`,
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

    // 1. "Explain this event in simple language."
    if (lower.includes("simple") || lower.includes("simple language") || lower.includes("explain this event")) {
      return (
        `### 💡 Simple Explanation of the Event\n\n` +
        `• **What happened?** OPEC+ announced a 1.2 million barrel-per-day oil production cut. Less oil supply in the market causes global crude oil prices to jump 12%.\n` +
        `• **Why does it matter?** Oil powers transportation and manufacturing. When fuel costs surge, it becomes more expensive to transport food, fly planes, and run factories.\n` +
        `• **The chain reaction:** Higher costs push up inflation numbers. In response, the Federal Reserve and central banks must keep interest rates higher for longer. Higher interest rates make borrowing money and mortgages more expensive, which slows down real estate and puts pressure on banks and the stock market.`
      )
    }

    // 2. "How can rising crude oil prices affect inflation?"
    if (lower.includes("affect inflation") || (lower.includes("oil") && lower.includes("inflation"))) {
      return (
        `### 📈 How Crude Oil Prices Transmit to Inflation (Path A)\n\n` +
        `• **Direct CPI Basket Contribution:** Energy commodities directly constitute ~7.2% of the Consumer Price Index (CPI) basket. Historically, every 10% sustained rise in crude oil adds 0.25–0.30 percentage points to headline CPI within 4–6 weeks.\n` +
        `• **Refining Crack Spread Pass-Through:** Crude oil is refined into gasoline, diesel, and jet fuel. Diesel powers freight trucks, railways, and cargo ships, so shipping freight tariffs increase universally.\n` +
        `• **Secondary Core Pass-Through:** Grocers, retailers, and industrial fabricators absorb or pass along transportation surcharges to end consumer goods.`
      )
    }

    // 3. "Why might interest-rate expectations change?"
    if (lower.includes("interest-rate") || lower.includes("interest rate") || lower.includes("expectations change")) {
      return (
        `### 🏛️ Why Interest-Rate Expectations Change\n\n` +
        `• **Central Bank Mandate:** Central banks (like the Fed) target 2.0% inflation and price stability.\n` +
        `• **Risk of De-Anchoring:** When headline inflation rises due to energy shocks, businesses and workers start expecting higher future prices, risking a wage-price spiral.\n` +
        `• **Policy Postponement:** To anchor inflation expectations, central banks delay anticipated rate cuts or raise policy rates. Bond markets adjust by pricing out rate cuts, shifting short-term and terminal Fed Funds projections higher.`
      )
    }

    // 4. "Which sectors could be affected indirectly?"
    if (lower.includes("indirect") || lower.includes("sectors could be affected")) {
      return (
        `### 🏭 Sectors Indirectly Affected\n\n` +
        `• **Airlines & Logistics (DAL):** Fuel represents 30–35% of total airline operating expenses. Rising jet fuel directly compresses EBIT operating margins.\n` +
        `• **Commercial Banking (XLF):** Higher rates increase deposit funding costs ('deposit beta') and flatten the yield curve, compressing bank Net Interest Margins (NIM).\n` +
        `• **Real Estate & Housing (XLRE):** Mortgage rates track the 10-year Treasury yield. Higher monthly mortgage payments price out home buyers and expand REIT cap rates.\n` +
        `• **Industrial Manufacturing (XLI):** Electricity tariffs and petrochemical feedstocks raise unit manufacturing costs for chemicals, plastics, and capital goods.`
      )
    }

    // 5. "Show the path from oil prices to real estate."
    if (lower.includes("real estate") || (lower.includes("path") && lower.includes("oil"))) {
      return (
        `### 🛣️ Propagation Pathway: Crude Oil ➔ Real Estate\n\n` +
        `1. **Crude Oil Prices (CL=F):** OPEC supply cut drives prompt crude benchmarks +12% higher.\n` +
        `2. **Inflation Expectations (CPI):** Energy costs directly elevate headline consumer inflation expectations.\n` +
        `3. **Interest-Rate Expectations:** Central banks delay rate cuts, maintaining a restrictive policy rate stance.\n` +
        `4. **Borrowing Costs & Mortgage Rates:** 30-Year fixed mortgage rates price off benchmark 10-Year Treasury yields.\n` +
        `5. **Real Estate Sector (XLRE):** Mortgage rates rise, reducing buyer affordability, depressing transaction volume, and expanding commercial property capitalization rates.`
      )
    }

    // 6. "What evidence supports this relationship?"
    if (lower.includes("evidence supports") || lower.includes("evidence") || lower.includes("audit")) {
      const facts = graphData.edges.filter((e) => e.type === "observed")
      const inferences = graphData.edges.filter((e) => e.type === "inferred")

      return (
        `### 📜 Evidence Grounding Audit\n\n` +
        `• **Observed Facts (${facts.length} links):**\n` +
        `  - _EIA Petroleum Status Report:_ Confirms OECD physical crude drawdowns from OPEC quota reductions.\n` +
        `  - _Bureau of Labor Statistics (BLS):_ Validates ~7.2% direct energy weighting in headline CPI calculations.\n` +
        `  - _SEC 10-K Disclosures (Delta Air Lines):_ Confirms fuel expense represents 30–35% of airline operational cost.\n` +
        `  - _Freddie Mac PMMS Survey:_ Confirms >0.90 correlation between 10-Year Treasury yields and mortgage rates.\n\n` +
        `• **Inferred Relationships (${inferences.length} links):**\n` +
        `  - Derived via macroeconomic models (deposit beta migration, REIT capitalization rate expansion, equity discount rate CAPM).`
      )
    }

    // 7. "Which relationships are uncertain?"
    if (lower.includes("uncertain") || lower.includes("limitations")) {
      return (
        `### ⚠️ Uncertainties & Limitations in the Model\n\n` +
        `• **Observed vs. Inferred:** Upstream commodity and fuel price increases are observed facts, but downstream bank credit losses and equity index multiples are inferred macroeconomic correlations.\n` +
        `• **Not Guaranteed:** Correlation does not guarantee causation. Fiscal stimulus, corporate hedging, or currency swings can break expected transmission chains.\n` +
        `• **Attenuating Confidence:** Upstream shock links carry 88–95% model confidence, whereas 4th-hop downstream market index impacts carry ~68–74% confidence due to macroeconomic noise.`
      )
    }

    // 8. "What other factors could reduce this impact?"
    if (lower.includes("reduce") || lower.includes("mitigat") || lower.includes("counter")) {
      return (
        `### 🛡️ Factors That Could Reduce This Impact\n\n` +
        `• **Non-OPEC Production Surge:** U.S. shale and South American producers can expand drilling output to capture elevated prices, alleviating physical supply deficits.\n` +
        `• **Strategic Petroleum Reserve (SPR) Releases:** Governments can release emergency crude reserves into spot markets to cushion prompt pricing spikes.\n` +
        `• **Corporate Financial Hedging:** Major airlines and chemical producers with existing fuel swap/collar derivatives can buffer cost shocks for 6–12 months.\n` +
        `• **Demand Destruction:** Higher retail pump prices can reduce discretionary consumer driving and travel, creating natural self-correcting price resistance.`
      )
    }

    // Default synthesis
    const chainSteps = graphData.hop_chain
      .map((h) => `• **Hop ${h.hop} (${h.category}):** **${h.label}** [${h.impact_delta}] — _${h.description}_`)
      .join("\n")

    return (
      `### 🌐 Multi-Hop Propagation Synthesis: "${rootLabel}"\n\n` +
      `Here is the step-by-step causal transmission path computed across sectors:\n\n` +
      `${chainSteps}\n\n` +
      `**Analyst Takeaway:** The initial commodity shock at Hop 0 transmits through inflation and policy rates into asset valuations at Hop 4.`
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
