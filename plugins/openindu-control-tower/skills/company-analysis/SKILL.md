---
name: company-analysis
description: Research and analyze a company for a decision-ready profile or recurring daily company-observation column. Use for company research, industry dynamics, competitive position, or daily company analysis. Do not use as a substitute for personalized investment, legal, or tax advice.
---

# Company Analysis

Produce an evidence-led assessment of a company. Make clear what is an externally verifiable fact, what is an analytical inference, and what remains unknown.

## Establish the research boundary

Identify the legal entity or business unit, geography, reporting cut-off date, and intended reader. For a listed company, distinguish the calendar year from its fiscal year. Do not silently substitute a parent company's results for a subsidiary's results.

Use current primary sources for time-sensitive claims: regulatory filings, annual or interim reports, investor-relations material, official releases, and official product or policy documents. Use credible secondary sources only for context that primary sources cannot provide. Cite every material external claim with a direct link and publication date. If a source is unavailable or a figure cannot be reconciled, say so rather than estimating it.

## Analyze from outside in

Use these layers, scaling depth to the reader's need:

1. **Industry and value chain** — demand, regulation, technology shifts, value-chain position, and customer segments.
2. **Business model** — what is sold, who pays, pricing power, recurring versus one-off revenue, delivery model, and switching costs.
3. **Products and moat** — product relevance, technology, data, IP, certification, installed base, brand, channel, ecosystem, or scale advantages.
4. **Operations and financial quality** — multi-period growth, margins, order book where relevant, cash conversion, working capital, capital intensity, and customer or supplier concentration.
5. **Strategy and organization** — capital allocation, R&D, acquisitions, geographic priorities, execution record, and management incentives.
6. **Valuation and downside** — only when appropriate for a public company; state valuation date, method, assumptions, and thesis-breaking risks. Never present it as personalized investment advice.

## Technical-community mode

When the audience is an engineering or open-source industrial community, do not stop at a market or management summary. Rebalance the report toward **30% market/company context, 50% technology and engineering analysis, and 20% ecosystem or project implications**. Answer what the company is building, where each capability sits in the stack, how it reaches a factory or field system, and what an engineer could verify or reuse.

Add the following technical views:

- **Technology route:** distinguish product announcement, commercially available capability, customer case, and scalable production evidence.
- **Stack map:** map AI/Agent, industrial software, edge/data, control/OT, and physical asset layers; show data and control boundaries.
- **Engineering deployment:** required data, protocols, compute location, latency, offline behavior, permissions, audit, rollback, safety and cybersecurity constraints.
- **Product and alternative matrix:** compare the company's approach with open-source, cloud, domestic, or peer alternatives without assuming feature equivalence.
- **Community implications:** identify what should be adopted, integrated, tested, or explicitly kept out of a physical control loop. For openIndu, connect findings to device data models, PLC/HMI/CAD/IR generation, RAG/MCP, edge gateways, and verification.

Do not allow financial tables or press-release chronology to crowd out these views. Every major technical claim should state its evidence level and whether it is independently verified.

## Apply three complementary lenses

### Porter’s Five Forces

Assess rivalry, threat of entrants, substitutes, supplier power, and buyer power. For each, give observed evidence, its strength, and the implication for long-term profitability. Identify the one or two forces that most shape the company's economics.

### SWOT to strategy

List material strengths and weaknesses that are internal, and opportunities and threats that are external. Translate them into choices: use strengths to capture opportunities, use strengths to mitigate threats, and flag weakness-threat combinations needing avoidance, investment, or narrower scope.

### DuPont for public-company financials

When comparable statements exist, decompose return on equity:

`ROE = net profit margin × total-asset turnover × equity multiplier`

Use at least three reporting periods where available and compare with relevant peers when practical. Explain whether ROE changes arise from profitability, asset efficiency, or leverage; do not treat a leverage-driven gain as an operating gain. For banks, insurers, and businesses where this decomposition is unsuitable, use sector-appropriate metrics and state the substitution.

## Write the deliverable

Lead with a short decision-ready conclusion, then provide supporting evidence. Separate factual sections from assessment. Use calibrated language such as “suggests”, “management expects”, and “not independently verified” where appropriate.

For a full report, use:

1. Executive conclusion and research boundary
2. Company snapshot and latest developments
3. Technology route and product/stack map
4. Engineering deployment, interoperability, safety, and cybersecurity
5. Industry and Five Forces
6. Business model, products, and moat
7. Strategy and SWOT
8. Financial and DuPont analysis
9. Community or product-line implications
10. Key risks, open questions, and monitoring indicators
11. Sources

For a technical-community report, the acceptance bar is: a reader can identify the technology layers, the data/control path, the deployment prerequisites, the maturity of each claim, and at least three concrete engineering follow-ups.

For the recurring **每日公司观察** column, retain the same evidence standard in a compact structure:

1. Date, company, scope, and information cut-off
2. One-sentence verdict
3. Three material developments or operating signals
4. One industry or competitive insight using Five Forces or SWOT
5. One financial-quality signal; use DuPont only when public data supports it
6. Two to four risks or items to monitor
7. Source links

Do not invent a daily cadence, select a company, publish externally, or trigger scheduled work without explicit authorization. When the request specifies only a company name, deliver that analysis and ask before making it part of a recurring series.
