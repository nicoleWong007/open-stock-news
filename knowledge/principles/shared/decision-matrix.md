# Decision Matrix

Pre-computed baseline recommendations combining cycle, risk, and valuation signals. The LLM refines these outputs — it does not generate recommendations from scratch.

## Input Signals

1. **Cycle Score** (0-10): From the 5-dimensional cycle positioning system
2. **Risk Level** (low/medium/high/very_high): From the risk assessment framework
3. **Valuation Level** (deep_value/value/fair/expensive/very_expensive): From the valuation rules

## Decision Matrix

### Cycle Score 0-3 (Favorable)

| Risk \ Valuation | Deep Value | Value | Fair | Expensive | Very Expensive |
|-----------------|-----------|-------|------|-----------|----------------|
| Low | **Strong Buy** | Strong Buy | Buy | Hold | Hold |
| Medium | Strong Buy | Buy | Buy | Hold | Reduce |
| High | Buy | Buy | Hold | Reduce | Sell |
| Very High | Hold | Hold | Reduce | Sell | Sell |

### Cycle Score 4-5 (Moderately Favorable)

| Risk \ Valuation | Deep Value | Value | Fair | Expensive | Very Expensive |
|-----------------|-----------|-------|------|-----------|----------------|
| Low | Strong Buy | Buy | Buy | Hold | Reduce |
| Medium | Buy | Buy | Hold | Reduce | Reduce |
| High | Buy | Hold | Hold | Reduce | Sell |
| Very High | Hold | Reduce | Reduce | Sell | Sell |

### Cycle Score 6 (Neutral)

| Risk \ Valuation | Deep Value | Value | Fair | Expensive | Very Expensive |
|-----------------|-----------|-------|------|-----------|----------------|
| Low | Buy | Buy | Hold | Hold | Reduce |
| Medium | Buy | Hold | Hold | Reduce | Reduce |
| High | Hold | Hold | Reduce | Reduce | Sell |
| Very High | Reduce | Reduce | Sell | Sell | Sell |

### Cycle Score 7-8 (Elevated)

| Risk \ Valuation | Deep Value | Value | Fair | Expensive | Very Expensive |
|-----------------|-----------|-------|------|-----------|----------------|
| Low | Buy | Hold | Hold | Reduce | Sell |
| Medium | Hold | Hold | Reduce | Reduce | Sell |
| High | Hold | Reduce | Reduce | Sell | Sell |
| Very High | Reduce | Sell | Sell | Sell | Sell |

### Cycle Score 9-10 (Danger Zone)

| Risk \ Valuation | Deep Value | Value | Fair | Expensive | Very Expensive |
|-----------------|-----------|-------|------|-----------|----------------|
| Low | Hold | Hold | Reduce | Sell | Sell |
| Medium | Hold | Reduce | Sell | Sell | Sell |
| High | Reduce | Sell | Sell | Sell | Sell |
| Very High | Sell | Sell | Sell | Sell | Sell |

## Recommendation Definitions

- **Strong Buy**: Significant undervaluation + favorable cycle + low risk. Allocate aggressively.
- **Buy**: Attractive risk-reward. Increase position or initiate with meaningful size.
- **Hold**: Fair risk-reward. Maintain current position. Do not add.
- **Reduce**: Unfavorable risk-reward. Trim position, tighten stop-losses.
- **Sell**: Significant overvaluation + unfavorable cycle + high risk. Exit position.

## Refinement Rules for LLM

The matrix provides a baseline. The LLM should refine based on:

1. **Catalysts**: Near-term catalysts (earnings, events) can shift recommendation one level
2. **Conviction**: Higher conviction in analysis allows acting on tighter margins
3. **Portfolio context**: Correlation with existing holdings affects sizing, not direction
4. **Time horizon**: Longer horizons allow acting on deeper value even in unfavorable cycles
5. **Alternative opportunities**: If better opportunities exist, recommendation can be downgraded

The LLM must explain any deviation from the matrix recommendation with explicit reasoning.
