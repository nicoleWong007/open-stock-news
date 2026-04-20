# Oak Invest Agent — 设计文档

> 遵循霍华德·马克斯投资理念的智能投资分析 Agent

## 1. 概述

### 1.1 产品定位

个人投资者自用 CLI 工具。基于橡树资本霍华德·马克斯的《投资最重要的事》和《周期》两本著作核心理念，结合橡树资本官方最新 10 篇投资备忘录，对用户关注的股票（美股、A 股、港股）进行深度分析，给出符合价值投资和周期定位理念的投资建议。

### 1.2 核心设计原则

- **第二层思维**：不满足于表面共识，追求更深层的洞察
- **风险优先**：关注永久损失概率而非波动率
- **周期定位**：判断当前在各类周期中的位置，调整攻守策略
- **安全边际**：只在价格显著低于内在价值时买入
- **防御性投资**：避免重大损失优于追求最大化收益

### 1.3 技术栈

| 层次 | 技术选型 |
|------|---------|
| 语言 | TypeScript (Node.js) |
| Agent 框架 | pi-mono (`@mariozechner/pi-ai` + `@mariozechner/pi-agent-core`) |
| 终端 UI | `@mariozechner/pi-tui` |
| 美股数据 | `yahoo-finance2` |
| A 股/港股数据 | Python `akshare` 子进程桥接 |
| 宏观数据 | FRED API / akshare |
| 新闻情绪 | NewsAPI / 东方财富新闻 |
| 邮件通知 | `nodemailer` + `node-cron` |
| CLI 框架 | `commander` |

## 2. 系统架构

```
┌─────────────────────────────────────────────────┐
│              CLI Layer (commander + pi-tui)      │  ← 命令行入口 + 报告渲染
├─────────────────────────────────────────────────┤
│           Agent Orchestrator                     │
│         (pi-agent-core Agent)                    │  ← 投资决策协调
├──────────┬──────────┬───────────────────────────┤
│  Cycle   │  Risk    │  Valuation                │  ← 三大分析引擎
│  Engine  │  Engine  │  Engine                    │
├──────────┴──────────┴───────────────────────────┤
│              Tool Layer                          │  ← 数据获取工具集
│  StockData │ Macro │ Sentiment │ Valuation       │
├─────────────────────────────────────────────────┤
│          Knowledge Base                          │
│  Fixed (书籍概念) + Dynamic (橡树memo)            │
├─────────────────────────────────────────────────┤
│          pi-ai (LLM Abstraction)                 │  ← 多 LLM 后端
│  OpenAI │ Claude │ Gemini │ Ollama               │
├─────────────────────────────────────────────────┤
│          Data Sources                            │
│  TS: yahoo-finance2 │ FRED │ NewsAPI             │
│  Python: akshare (A 股/港股/宏观)                │
├─────────────────────────────────────────────────┤
│          Output Layer                            │
│  CLI Report │ Email (nodemailer)                 │
└─────────────────────────────────────────────────┘
```

## 3. 项目结构

```
oak-invest/
├── src/
│   ├── index.ts                    # CLI 入口 (commander)
│   ├── commands/
│   │   ├── analyze.ts              # analyze 命令
│   │   ├── chat.ts                 # chat 交互命令
│   │   ├── cycle-check.ts          # cycle-check 命令
│   │   ├── daily-report.ts         # daily-report 命令
│   │   └── update-memos.ts         # update-memos 命令
│   │
│   ├── agent/
│   │   ├── agent.ts                # pi-agent-core Agent 初始化
│   │   ├── tools.ts                # 所有 Tool 定义和注册
│   │   └── system-prompt.ts        # 系统提示词构建（分层加载知识）
│   │
│   ├── engines/
│   │   ├── cycle-engine/
│   │   │   ├── cycle-scorer.ts     # 周期定位评分 (0-10)
│   │   │   ├── indicators/
│   │   │   │   ├── economic.ts     # 经济周期指标
│   │   │   │   ├── profit.ts       # 利润周期指标
│   │   │   │   ├── psychology.ts   # 心理钟摆指标
│   │   │   │   ├── risk-attitude.ts# 风险态度指标
│   │   │   │   └── credit.ts       # 信贷周期指标
│   │   │   └── types.ts            # 类型定义
│   │   │
│   │   ├── risk-engine/
│   │   │   ├── risk-assessor.ts    # 风险评估核心
│   │   │   ├── downside.ts         # 下行保护分析
│   │   │   ├── permanent-loss.ts   # 永久损失概率计算
│   │   │   └── types.ts            # 类型定义
│   │   │
│   │   └── valuation-engine/
│   │       ├── intrinsic-value.ts  # 内在价值估算
│   │       ├── margin-safety.ts    # 安全边际计算
│   │       ├── credit-spread.ts    # 信用利差分析
│   │       └── types.ts            # 类型定义
│   │
│   ├── data/
│   │   ├── sources/
│   │   │   ├── yahoo-finance.ts    # 美股数据源 (yahoo-finance2)
│   │   │   ├── akshare-bridge.ts   # Python akshare 桥接（stdin/stdout）
│   │   │   ├── fred.ts             # FRED 宏观数据
│   │   │   └── news.ts             # 新闻/情绪数据
│   │   └── types.ts                # 统一数据类型
│   │
│   ├── knowledge/
│   │   ├── loader.ts               # 知识库加载器
│   │   ├── memo-updater.ts         # 橡树 memo 自动抓取
│   │   └── prompt-builder.ts       # Prompt 分层构建
│   │
│   ├── output/
│   │   ├── report-formatter.ts     # 报告格式化（终端）
│   │   ├── email-sender.ts         # 邮件发送
│   │   └── html-report.ts          # HTML 报告生成
│   │
│   └── config/
│       ├── schema.ts               # 配置 schema (zod)
│       └── loader.ts               # 配置加载 (~/.oak-invest/config.yaml)
│
├── knowledge/                       # 固化知识库（git-tracked）
│   ├── books/
│   │   ├── the-most-important-thing.md
│   │   └── mastering-the-market-cycle.md
│   ├── memos/                       # 动态更新（橡树 memo）
│   │   ├── meta.json
│   │   └── *.md
│   ├── principles/
│   │   ├── risk-framework.md
│   │   ├── cycle-positioning.md
│   │   ├── valuation-rules.md
│   │   ├── contrarian-checklist.md
│   │   └── decision-matrix.md
│   └── maxims.md
│
├── python/
│   └── akshare_bridge.py           # 独立 Python 桥接服务
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 4. 数据源层

### 4.1 TypeScript 原生数据源

| 数据源 | npm 包 | 获取内容 |
|--------|--------|---------|
| 美股 | `yahoo-finance2` | 实时/历史股价、财报、估值指标（PE/PB/EV/EBITDA） |
| 宏观 | FRED API (HTTP) | 利率、CPI、PMI、M2、失业率 |
| 新闻 | NewsAPI / 东方财富 | 个股新闻、市场情绪 |

### 4.2 Python 桥接数据源 (akshare)

通过子进程 HTTP 桥接模式通信：

```typescript
// akshare-bridge.ts
interface AkshareRequest {
  function: string;       // akshare 函数名
  args: Record<string, any>;
}

interface AkshareResponse {
  success: boolean;
  data: any[];
  error?: string;
}

async function callAkshare(req: AkshareRequest): Promise<AkshareResponse> {
  // 使用 stdin/stdout JSON 桥接模式
  // 启动 python3 python/akshare_bridge.py，通过 stdin 写入 JSON 请求，从 stdout 读取 JSON 响应
  // 无需 HTTP 服务，进程即用即退
}
```

**A 股数据**（通过 akshare）：
- 实时/历史行情（日K、周K、月K）
- 财报数据（营收、净利润、ROE、资产负债率）
- 估值指标（PE、PB、PS）
- 北向资金流入/流出
- 行业/概念板块涨跌

**港股数据**（通过 akshare）：
- 实时/历史行情
- AH 溢价指数
- 南向资金流向
- 港股通标的

### 4.3 数据统一抽象

所有数据源通过统一接口暴露：

```typescript
interface MarketDataSource {
  getQuote(symbol: string): Promise<StockQuote>;
  getHistoricalPrices(symbol: string, range: string): Promise<OHLCV[]>;
  getFinancials(symbol: string): Promise<FinancialReport>;
  getValuationMetrics(symbol: string): Promise<ValuationMetrics>;
}

interface MacroDataSource {
  getIndicator(name: string): Promise<MacroDataPoint[]>;
  getInterestRate(): Promise<InterestRateData>;
  getCPI(): Promise<CPIData>;
}
```

符号格式统一：
- 美股: `AAPL`, `MSFT`
- A 股: `000001.SZ`, `600519.SH`
- 港股: `0700.HK`, `9988.HK`

## 5. 知识库

### 5.1 固化知识（来自两本著作）

**《投资最重要的事》核心概念**（编码为结构化 markdown）：

1. 第二层思维 (Second-Level Thinking)
2. 市场效率的局限
3. 价值与价格的关系
4. 风险的真正含义（永久损失概率，非波动率）
5. 风险的反常性（感知风险低 = 实际风险高）
6. 周期意识
7. 钟摆意识
8. 逆向投资
9. 安全边际
10. 防御性投资
11. 耐心与机会主义
12. 认知边界
13. 市场定位感
14. 运气的作用
15. 避免陷阱

**《周期》核心概念**：

1. 周期的本质（因果链驱动）
2. 经济周期
3. 利润周期
4. 投资者心理钟摆
5. 风险态度周期
6. 信贷周期（最关键的周期）
7. 周期定位方法
8. 应对策略（准备而非预测）

### 5.2 动态知识（橡树资本 Memo）

**更新逻辑**：

```
oak-invest update-memos:
  1. 抓取 https://www.oaktreecapital.com/insights/memo 页面
  2. 解析 memo 列表（标题、日期、URL）
  3. 与本地 meta.json 比对，识别新增/变更
  4. 逐篇抓取全文 → 转为 markdown（使用 cheerio 解析 HTML）
  5. 存储到 knowledge/memos/ 目录
  6. 仅保留最新 10 篇，旧文件归档
  7. 更新 meta.json（时间戳、memo 列表、内容 hash）
```

`meta.json` 结构：
```json
{
  "last_updated": "2026-04-20T10:00:00Z",
  "memos": [
    {
      "title": "What's Going on in Private Credit?",
      "date": "2026-04-09",
      "url": "https://www.oaktreecapital.com/insights/memo/...",
      "local_path": "knowledge/memos/2026-04-whats-going-on-in-private-credit.md",
      "content_hash": "sha256:..."
    }
  ]
}
```

### 5.3 Prompt 构建

系统提示词分层加载，总量约 20-30k tokens：

```
System Prompt =
  [身份层] 角色定义 + 投资理念概述 (~500 tokens)
  + [核心原则层] 从 books/*.md 加载的精炼摘要 (~3,000 tokens)
  + [决策规则层] 从 principles/*.md 加载的可执行规则 (~2,000 tokens)
  + [Memo 上下文层] 从 memos/*.md 加载的最新观点摘要 (~5,000 tokens)
  + [格言层] 从 maxims.md 加载的经典格言 (~500 tokens)
  + [当前市场上下文] 实时周期评分 + 宏观数据 (~1,000 tokens)
```

## 6. 分析引擎

### 6.1 周期引擎 (Cycle Engine)

来自《周期》的核心逻辑。

**五维评分体系**：

| 维度 | 指标 | 权重 | 数据源 |
|------|------|------|--------|
| 经济周期 | GDP增速、PMI、失业率 | 15% | FRED / akshare |
| 利润周期 | 盈利增速、利润率趋势 | 15% | yahoo-finance2 / akshare |
| 心理钟摆 | VIX/波动率、恐惧贪婪指数 | 20% | yahoo-finance2 / 新闻情绪 |
| 风险态度 | 信用利差、IPO 活跃度 | 20% | FRED / 市场数据 |
| 信贷周期 | 贷款标准、违约率、流动性 | 30% | FRED / 宏观数据 |

**输出**：`CycleScore` (0-10)

- 0-3: 极度悲观（历史上往往是买入良机）
- 4-5: 偏悲观
- 6: 中性
- 7-8: 偏乐观
- 9-10: 极度乐观（历史上往往是风险信号）

**定位规则**（来自 Marks 的周期哲学）：
- 评分越低 → 越应进取（价值机会多）
- 评分越高 → 越应防守（安全边际要求更高）
- 评分极端时 → 逆向操作信号

### 6.2 风险引擎 (Risk Engine)

来自《投资最重要的事》的风险哲学。

**风险评估维度**：

1. **永久损失概率**
   - 基本面恶化概率（财务健康度、行业趋势）
   - 估值过高风险（价格 vs 内在价值偏离度）
   - 流动性风险（成交量、市值）
   - 杠杆风险（资产负债率、利息覆盖倍数）

2. **风险反常性检测**
   - 感知风险 vs 实际风险背离度
   - 信用利差处于历史分位数
   - "风险已消失"舆论检测

3. **下行场景分析**
   - 最坏情况损失估算（历史回撤参考）
   - 恢复所需时间估算
   - 替代历史模拟

**输出**：`RiskReport`
```typescript
interface RiskReport {
  overallRisk: 'low' | 'medium' | 'high' | 'very_high';
  permanentLossProbability: number;    // 0-100%
  riskPerversityAlert: boolean;        // 感知风险低但实际高
  downsideScenarios: {
    bear: { loss: number; probability: number };
    severe: { loss: number; probability: number };
    worst: { loss: number; probability: number };
  };
  keyRiskFactors: string[];
}
```

### 6.3 估值引擎 (Valuation Engine)

**估值方法**：

1. **内在价值估算**
   - 简化 DCF（基于未来 5 年盈利增长预测）
   - 相对估值（行业 PE/PB 中位数比较）
   - 资产价值（PB、清算价值参考）

2. **安全边际**
   - 最低要求折扣：30%（不确定时提高至 40-50%）
   - 内在价值区间（保守值 - 乐观值）
   - 当前价格在区间中的位置

3. **信用利差适当性**（适用于债券/信用分析）
   - 利差 vs 历史违约率 × 损失严重度
   - 利差是否补偿了实际风险

**输出**：`ValuationReport`
```typescript
interface ValuationReport {
  intrinsicValueRange: { low: number; mid: number; high: number };
  currentPrice: number;
  marginOfSafety: number;             // 百分比，正=低估，负=高估
  marginOfSafetyAdequate: boolean;     // >= 30%
  valuationLevel: 'deep_value' | 'value' | 'fair' | 'expensive' | 'very_expensive';
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'sell';
}
```

### 6.4 决策协调器

使用 `pi-agent-core` 的 Agent 实例作为决策中枢：

```typescript
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';

const investmentAgent = new Agent({
  initialState: {
    systemPrompt: buildSystemPrompt(),  // 分层加载的知识库
    model: getModel(config.llm.default_provider, config.llm.default_model),
    tools: registerAllTools(),          // 9 个 Tool
  },
});

// 订阅事件流
investmentAgent.subscribe((event) => {
  handleAgentEvent(event);              // 实时输出到终端
});

// 执行分析
await investmentAgent.prompt(
  `分析以下股票: ${symbols.join(', ')}。` +
  `当前周期评分: ${cycleScore}。` +
  `请按照 Howard Marks 的投资理念给出分析建议。`
);
```

**Tool 注册表**：

| Tool | 功能 | 引擎 |
|------|------|------|
| `get_stock_price` | 获取实时/历史股价 | 数据层 |
| `get_financials` | 获取财报数据 | 数据层 |
| `get_valuation` | 获取估值指标 | 数据层 |
| `get_macro_data` | 获取宏观经济指标 | 数据层 |
| `get_news_sentiment` | 获取新闻和情绪 | 数据层 |
| `get_northbound_flow` | 获取北向/南向资金 | 数据层 |
| `calculate_cycle_score` | 计算周期定位评分 | 周期引擎 |
| `calculate_risk` | 计算风险指标 | 风险引擎 |
| `calculate_intrinsic_value` | 估算内在价值 | 估值引擎 |

## 7. CLI 命令

### 7.1 命令列表

```bash
# 分析股票
oak-invest analyze <symbols...>
oak-invest analyze --watchlist <name>

# 交互式对话
oak-invest chat [question]

# 周期检查
oak-invest cycle-check

# 每日报告
oak-invest daily-report [--email]

# 更新橡树 memo
oak-invest update-memos

# 初始化配置
oak-invest init
```

### 7.2 配置文件

路径: `~/.oak-invest/config.yaml`

```yaml
llm:
  default_provider: openai
  default_model: gpt-4o
  providers:
    openai:
      api_key_env: OPENAI_API_KEY
    anthropic:
      api_key_env: ANTHROPIC_API_KEY
    ollama:
      base_url: http://localhost:11434

watchlists:
  default:
    - AAPL
    - MSFT
    - 000001.SZ
    - 0700.HK
    - 9988.HK

email:
  enabled: true
  smtp_host: smtp.gmail.com
  smtp_port: 587
  from: oak-invest@example.com
  to: user@example.com
  schedule: "0 18 * * 1-5"

data_sources:
  python_bridge: true
  python_path: python3
```

## 8. 输出

### 8.1 终端报告

格式化的 ASCII 表格报告，包含：
- 市场周期定位总览
- 个股详细分析（价格、估值、风险、建议）
- 操作建议和理由

### 8.2 邮件通知

- 使用 `nodemailer` 发送 HTML 格式报告
- `node-cron` 定时触发（默认工作日 18:00）
- 报告内容同终端版，增加图表链接

## 9. 依赖清单

### 9.1 核心 npm 包

| 包名 | 用途 |
|------|------|
| `@mariozechner/pi-ai` | LLM 多后端抽象 |
| `@mariozechner/pi-agent-core` | Agent 运行时 |
| `@mariozechner/pi-tui` | 终端 UI |
| `yahoo-finance2` | 美股数据 |
| `commander` | CLI 框架 |
| `zod` | 配置/schema 验证 |
| `js-yaml` | YAML 配置解析 |
| `nodemailer` | 邮件发送 |
| `node-cron` | 定时任务 |
| `cheerio` | HTML 解析（memo 抓取） |
| `chalk` | 终端颜色 |
| `cli-table3` | 终端表格 |

### 9.2 Python 依赖

| 包名 | 用途 |
|------|------|
| `akshare` | A 股/港股/宏观数据 |

## 10. 非目标（明确排除）

- **自动交易执行**：只提供分析建议，不执行交易
- **回测系统**：不做历史策略回测
- **实时行情推送**：按需获取，不做 WebSocket 推送
- **多用户/SaaS**：个人工具，不考虑多租户
- **加密货币**：只覆盖股票市场
- **技术分析**：不依赖 K 线形态、均线等技术指标（与 Marks 理念不符）
