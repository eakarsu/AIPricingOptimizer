# Audit Note — AIPricingOptimizer

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_06.md` section #33.

## Original Recommendations
TSV said "0 backend routes" / skeleton. **This is wrong on inspection** — `backend/server.js` is ~4390 lines with many AI endpoints already implemented:

- `/api/ai-insights/generate`
- `/api/price-tracker/ai/analyze-deal`
- pricing/demand/elasticity/discount AI endpoints (lines 1231, 1287, 1489, 1895, 2042, 2156, 2289, 2381, 2536, 2619, 2774, 2856, ...)

The audit's "skeleton" verdict appears to have come from misreading the directory layout (single-file `server.js` instead of `routes/*.js`).

### Custom Feature Suggestions
1. Agentic pricing optimization
2. Demand forecasting ensemble
3. Price elasticity modeling — already exists
4. Competitive intelligence — already exists
5. Discount optimization — already exists

## Implemented (Mechanical)
- None added. The recommended endpoints largely already exist in monolithic `server.js`. Adding more without first refactoring 4k-line `server.js` would create maintenance pain.

## Backlog (deferred)

### NEEDS-PRODUCT-DECISION (architecture)
- Refactor `backend/server.js` into `routes/` modules — non-trivial mechanical refactor; deferred as it's beyond a 3-rec scope and breaks request paths if mishandled.

### NEEDS-CREDS / NEW-DEPS
- Real-time competitor scraping pipelines.
- A/B testing platform integration.

### TOO-RISKY
- Agentic real-time price-adjustment loop (commercial risk; require human-in-the-loop).
- ML training pipelines for elasticity models (out of LLM-prompt scope).

## Audit Re-categorization
The verdict should be **"substantive (single-file)"** rather than "skeleton". Recommend a future audit pass that reads single-file Express servers in addition to `routes/` directories.

## Apply pass 3 (frontend)

Verified — FE already wired. No changes.

- `frontend/src/pages/AIInsights.js` -> `POST /api/ai-insights/generate`.
- `frontend/src/pages/PricingSimulation.js` -> `POST /api/ai/price-simulation`.
- `frontend/src/pages/PriceTracker.js` -> `/api/price-tracker/ai/{analyze-deal,predict-price,recommendations}`.
- `frontend/src/pages/PriceElasticity.js` -> `POST /api/price-elasticity/analyze` and `/analyze-item`.
- `frontend/src/pages/AIUsageStats.js` -> `GET /api/ai/usage`.
- JWT Bearer via global `axios.defaults.headers.common['Authorization']` set in `context/AuthContext.js` from `localStorage.getItem('token')`.
- `/api/ai/elasticity` (added in a prior pass) is functionally duplicative of `/api/price-elasticity/analyze` already surfaced in `PriceElasticity.js`; no second UI added to avoid redundancy.

## Apply pass 4 (mechanical backlog)

No mechanical items remain. The backlog is composed of:
- Refactor monolithic `backend/server.js` into `routes/` modules — NEEDS-PRODUCT-DECISION (architectural; cross-cutting URL/import changes).
- Real-time competitor scraping — NEEDS-CREDS / NEW-DEPS.
- A/B testing platform integration — NEEDS-CREDS.
- Agentic real-time price-adjustment loop — TOO-RISKY (commercial pricing changes require human-in-the-loop).
- ML training pipelines for elasticity — TOO-RISKY (out of LLM-prompt scope).

No code changes in this pass.
