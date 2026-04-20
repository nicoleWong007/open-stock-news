# Oak Invest Agent — Autoplan Review Report

> Branch: main | Base: main | Platform: GitHub (nicoleWong007/open-stock-news)
> Design doc: `docs/superpowers/specs/2026-04-20-oak-invest-agent-design.md`
> Review date: 2026-04-20

---

## CEO Review

### Mode: SELECTIVE EXPANSION

Hold current scope as baseline, surface expansion opportunities individually.

### Competitive Landscape

| Competitor | Language | Stars | Differentiator |
|---|---|---|---|
| **Finclaw** | Python (nanobot) | 11 | Proactive monitoring, chat app integration |
| **bull.sh** | Python (Claude) | 12 | SEC filings + sentiment, REPL |
| **TickerToThesis** | Python | N/A | 6 parallel analysts with debate, includes Howard Marks deep value agent |
| **value-investing-ai-agent** | Python (LangGraph) | 16 | Phil Town / Buffett style, Alpha Vantage |
| **Investment-Research-Memory-Agent** | TypeScript (Mastra) | 0 | Persistent memory across sessions |

Key insight: The landscape is almost entirely Python-based. A TypeScript investment analysis CLI is genuinely differentiated. pi-mono is a legitimate, actively maintained framework (1.9M weekly downloads for pi-ai, 1.8M for pi-agent-core).

### Step 0: Scope Challenge

**What's already solved?** The design builds nothing that exists. Greenfield.

**Minimum viable change:**
1. Config + CLI skeleton
2. One data source (yahoo-finance2 for US stocks)
3. Agent with knowledge base + 3-4 tools
4. Terminal report output

Everything else (akshare bridge, cycle engine scoring, risk engine, email, macro data) layers on top. The design is well-layered for incremental delivery.

**Complexity check:** The plan touches ~30+ files and introduces 9+ tools, 3 engines, 4 data sources, and a Python subprocess bridge. That's significant. But the architecture is modular enough that each piece can be built and tested independently.

**The 30-file count is fine** because the modules are genuinely independent. No circular dependencies in the architecture diagram. Each engine is self-contained with its own types.ts.

### CEO Findings

#### Finding 1: The Knowledge Base is the Moat (not the engines)

The cycle scorer, risk assessor, and valuation engine are all compute-able from public data. Anyone can build them. What makes this tool unique is the Howard Marks knowledge layer: structured concepts from two books + dynamic memo ingestion + prompt construction that embeds the philosophy into every analysis.

**Recommendation:** Invest disproportionately in the knowledge base quality. The `knowledge/` directory structure is good. Consider adding:
- Per-concept scoring rubrics (what data triggers what advice)
- Memo-to-principle cross-references (which memo illustrates which concept)
- Decision trees, not just checklists (if X and Y but not Z, then...)

**Decision: AUTO-APPROVED** (completeness principle — high-value, low-cost expansion)

#### Finding 2: Missing "So What?" Layer

The design produces CycleScore, RiskReport, and ValuationReport. But it doesn't specify how these combine into an actionable recommendation. The agent is supposed to synthesize them, but the synthesis logic is entirely delegated to the LLM.

This is both a strength (flexibility) and a risk (inconsistency). Consider adding a structured `DecisionMatrix` that pre-computes a baseline recommendation from the three scores, which the LLM can then refine.

**Decision: AUTO-APPROVED** — add a `DecisionMatrix` in the principles/ knowledge and a `generate_recommendation` tool that combines the three reports with explicit rules. The LLM refines, not generates from scratch.

#### Finding 3: Python Bridge is an Innovation Token

The Python akshare bridge is the highest-risk, highest-friction component. It requires:
- Python runtime installed
- akshare pip package
- stdin/stdout JSON protocol
- Error handling for Python crashes, timeouts, encoding issues

This is spending an innovation token on infrastructure, not product differentiation.

**Recommendation:** Phase it. Ship US-only first with yahoo-finance2. Add akshare as a clear Phase 2. The design already separates data sources behind `MarketDataSource` interface, so this is clean.

**Decision: AUTO-APPROVED** — mark akshare bridge as Phase 2 in implementation plan.

#### Finding 4: No Observability / Cost Tracking

LLM calls cost money. Each `analyze` command makes 5-10 tool calls, each potentially triggering an LLM round trip. The design has no:
- Token usage tracking
- Cost estimation per analysis
- Rate limiting
- Caching strategy (if I analyze AAPL twice in 5 minutes, do I re-fetch everything?)

pi-ai has built-in token/cost tracking. The design should surface this.

**Decision: AUTO-APPROVED** — add cost display to output, add TTL-based cache to data sources.

#### Finding 5: Memo Scraping Fragility

The `update-memos` command scrapes oaktreecapital.com with cheerio. HTML scraping breaks when the site changes. No error handling specified for:
- Site structure changes
- Rate limiting / blocking
- Network failures mid-scrape
- Invalid HTML

**Decision: AUTO-APPROVED** — add retry logic, diff detection (only re-scrape if page hash changed), graceful degradation (use cached memos if scrape fails).

---

## Eng Review

### Architecture Assessment

The layered architecture is clean:

```
CLI → Agent → [Engines] → [Tools] → [Data Sources]
                   ↕
              Knowledge Base
```

No circular dependencies. Each layer only depends on the layer below. Good.

### Data Flow Diagram

```
User types: oak-invest analyze AAPL 000001.SZ
         │
         ▼
  ┌─────────────┐
  │  Commander   │  Parse args, validate symbols
  │  CLI Parser  │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Agent       │  Build system prompt from knowledge layers
  │  Initialize  │  Load config, register tools
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  LLM Call 1  │  "Analyze AAPL, 000001.SZ with cycle score X"
  │  (Planning)  │  → LLM decides which tools to call
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     ┌──────────────┐
  │ Tool Calls   │────▶│ yahoo-finance │  get_stock_price(AAPL)
  │ (Parallel)   │     │ get_financials│  get_financials(AAPL)
  │              │────▶│ akshare       │  get_stock_price(000001.SZ)
  │              │     │ bridge        │  get_financials(000001.SZ)
  │              │────▶│ FRED          │  get_macro_data(interest_rate)
  │              │     │ get_macro_data│  get_macro_data(CPI)
  └──────┬──────┘     └──────────────┘
         │
         ▼
  ┌─────────────┐
  │ Engine Calls │  calculate_cycle_score(data)
  │              │  calculate_risk(data)
  │              │  calculate_intrinsic_value(data)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  LLM Call N  │  Synthesize all data → final recommendation
  │  (Synthesis) │
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Report      │  Format to terminal (pi-tui + chalk + cli-table3)
  │  Output      │  OR send via email (nodemailer)
  └─────────────┘
```

### Error Path Analysis

| Failure | Current Handling | Gap | Fix |
|---|---|---|---|
| yahoo-finance2 API rate limit | Not specified | Analysis hangs/crashes | Add retry with backoff, return cached data |
| akshare Python crash | Not specified | Bridge hangs on stdout | Add timeout (10s), spawn fresh process each call |
| FRED API key missing | Not specified | Macro data silently empty | Validate config at startup, warn on missing keys |
| LLM API error | pi-agent-core handles | Tool execution may succeed but synthesis fails | Catch agent errors, output raw data as fallback |
| Invalid symbol format | Not specified | Wrong data source selected | Validate symbol format with regex before routing |
| Network timeout | Not specified | Any data fetch can hang | Default 30s timeout on all HTTP calls |
| Python not installed | Not specified | akshare bridge fails silently | Check `python_path` in config, warn if missing, disable A-share features |

### Testing Strategy

The design mentions no testing strategy. Required:

1. **Unit tests**: Each engine (cycle scorer, risk assessor, valuation) with mocked data
2. **Integration tests**: Data source adapters with recorded responses (nock for HTTP)
3. **Agent tests**: Prompt → expected tool call sequence (mock LLM)
4. **E2E tests**: `oak-invest analyze AAPL` → expect report format

Priority: Engine unit tests first (pure functions, easy to test), data source integration tests second.

### Missing Specifications

1. **TypeScript strictness**: No tsconfig specified. Must be `strict: true`.
2. **Build system**: No mention of build tool (tsup? tsx? ts-node?). Recommend `tsx` for dev, `tsup` for build.
3. **Package manager**: No mention. npm? pnpm? bun? Recommend pnpm for monorepo friendliness.
4. **No test framework specified**: Recommend vitest.
5. **No linting/formatting specified**: ESLint + Prettier.
6. **Cache TTL**: Data should be cached. Stock quotes: 1 min. Financials: 1 day. Macro: 1 week. Memos: 1 day.
7. **Concurrent analysis**: What happens when analyzing 10 symbols? Sequential LLM calls or parallel? The agent framework handles this, but the design should specify.

---

## DX Review

### Developer Personas

1. **Contributor (open source)**: Wants to add a new indicator, fix a bug, add a data source
2. **User extending**: Wants to customize knowledge base, add personal investment rules

### Onboarding Flow (ideal)

```bash
git clone https://github.com/nicoleWong007/open-stock-news.git
cd open-stock-news
# In oak-invest/ subdirectory
pnpm install
cp .env.example .env  # Add API keys
pnpm test             # Verify setup
pnpm dev analyze AAPL # First run
```

### DX Gaps

| Gap | Impact | Fix |
|---|---|---|
| No `oak-invest init` command spec | User doesn't know what to put in config.yaml | Auto-generate config from .env.example, prompt for API keys |
| No development mode spec | Must rebuild after every change | Add `pnpm dev` with tsx watch |
| Python bridge setup not documented | A-share/HK users hit wall silently | Add setup diagnostic command: `oak-invest doctor` |
| No example output shown | Users don't know what they'll get | Add example reports to README |
| Config validation errors not specified | YAML typo = silent failure | Validate with zod at startup, exit with clear error |
| Knowledge base format not documented | Contributors can't add principles | Add CONTRIBUTING.md with knowledge format spec |

### CLI Design Assessment

The command set is good:

- `analyze` — core use case. Clear.
- `chat` — interactive follow-up. Smart.
- `cycle-check` — standalone quick check. Useful.
- `daily-report` — automated workflow. Good.
- `update-memos` — maintenance. Necessary.

**Missing commands:**
- `oak-invest doctor` — validate setup (API keys, Python bridge, config)
- `oak-invest config` — view/edit config interactively

### Magical Moments

1. First `oak-invest analyze AAPL` should show the agent thinking in real-time (pi-tui streaming)
2. `oak-invest cycle-check` should display a visual gauge/meter in the terminal
3. The report should use color coding: green for buy signals, red for risk warnings

---

## Implementation Phases

### Phase 1: Foundation (MVP)

```
oak-invest analyze AAPL  # Works end-to-end for US stocks only
```

- Project scaffold (package.json, tsconfig, build)
- Config system (zod schema, YAML loader, ~/.oak-invest/)
- CLI skeleton (commander)
- One data source: yahoo-finance2
- Agent with system prompt + 3 tools (get_stock_price, get_financials, get_valuation)
- Knowledge base: books/ + maxims.md (static)
- Terminal report output (chalk + cli-table3)
- `oak-invest init` command
- `oak-invest doctor` command
- Tests: engine unit tests, data source integration tests

### Phase 2: Engines + Knowledge

```
oak-invest cycle-check   # Cycle engine works
oak-invest analyze AAPL --detailed  # Full 3-engine analysis
```

- Cycle engine (5 indicators, scoring)
- Risk engine (permanent loss, downside scenarios)
- Valuation engine (DCF, relative, margin of safety)
- Decision matrix principle
- All 9 tools registered
- Memo updater (oak-invest update-memos)
- Dynamic knowledge loading from memos/

### Phase 3: Multi-Market + Output

```
oak-invest analyze 000001.SZ 0700.HK  # A-share and HK stocks
oak-invest daily-report --email         # Email reports
```

- Python akshare bridge
- A-share data adapter
- HK stock data adapter
- Macro data (FRED)
- News sentiment
- Email output (nodemailer + node-cron)
- `oak-invest chat` interactive mode

### Phase 4: Polish

- Caching layer (TTL-based)
- Cost tracking display
- pi-tui rich terminal UI (replace chalk/cli-table3)
- Performance optimization (parallel data fetching)
- Error recovery and graceful degradation
- Comprehensive test coverage
- README with example outputs
- CONTRIBUTING.md

---

## Taste Decisions (surfaced for approval)

### 1. akshare bridge: Phase 2, not Phase 1

**What the design says:** akshare is listed as a core data source.
**What I recommend:** Ship US-only first. akshare adds Python dependency, subprocess complexity, and A-share specific error handling.
**If we're wrong, the cost is:** Users without US stocks have no data in Phase 1. Mitigated by yahoo-finance2 supporting some international quotes.
**Completeness:** Phase 1 = 7/10 (US market fully covered), Phase 2 = 9/10 (all three markets)

### 2. Decision Matrix: Explicit, not just LLM

**What the design says:** Agent synthesizes recommendations via LLM.
**What I recommend:** Add a pre-computed decision matrix as a baseline, LLM refines it.
**Reason:** LLM-only recommendations are non-deterministic. A matrix ensures consistency across runs.
**Completeness:** Without = 6/10, With = 9/10

### 3. pi-tui: Use from Day 1, not Phase 4

**What the design says:** pi-tui for terminal UI.
**What I recommend:** Use pi-tui from Phase 1 for the streaming agent output. Don't start with chalk/cli-table3 and migrate later.
**Reason:** Migration is wasted work. pi-tui is the design's stated choice.
**Completeness:** With = 9/10, Without = 5/10 (tech debt from day one)

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/autoplan` | Scope & strategy | 1 | PASS | 5 findings (knowledge moat, missing synthesis, python bridge phasing, no cost tracking, memo fragility) |
| Eng Review | `/autoplan` | Architecture & tests | 1 | PASS WITH CONCERNS | 7 error path gaps, no test strategy, 7 missing specs |
| Design Review | `/autoplan` | UI/UX gaps | 0 | SKIPPED | CLI tool, no web UI |
| DX Review | `/autoplan` | Developer experience | 1 | PASS WITH CONCERNS | 6 DX gaps, 2 missing commands |

**VERDICT:** PASS — design is solid, well-structured, and differentiated. Implementation should proceed with the 4-phase plan. Three taste decisions surfaced for user approval.

---

## Decision Audit Trail

| # | Decision | Principle | Classification |
|---|---|---|---|
| 1 | Knowledge base is the moat | P1 Completeness | Mechanical |
| 2 | Add DecisionMatrix | P1 Completeness | Taste |
| 3 | Python bridge to Phase 2 | P3 Pragmatic | Taste |
| 4 | Add cost tracking | P1 Completeness | Mechanical |
| 5 | Memo scrape retry logic | P1 Completeness | Mechanical |
| 6 | pi-tui from Day 1 | P5 Explicit | Taste |
| 7 | Error path fixes | P1 Completeness | Mechanical |
| 8 | Add oak-invest doctor | P1 Completeness | Mechanical |
| 9 | 4-phase delivery plan | P6 Bias toward action | Mechanical |

**Taste decisions requiring user input: #2, #3, #6**
