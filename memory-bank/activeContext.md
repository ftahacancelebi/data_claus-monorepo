# Active Context

## Current Focus

**MAJOR REFACTORING:** Converting the frontend from mock data to real backend API connections.

The previous frontend was visually complete but used hardcoded mock data. We are now:
1. Wiring up all pages to call the Go backend API
2. Fixing UI issues (modal centering)
3. Ensuring the complete data flow works: Mobile SDK → API → Kafka → AI Worker → Database → Dashboard

## Active Decisions

1. **API Keys = Applications:** In the backend, cada "Application" is represented as an API Key with a name. The frontend's "My Apps" page now correctly maps to the developer's API keys.

2. **Real Data First:** All dashboard pages now attempt to fetch real data from the backend API. If the backend is unavailable, they show helpful error messages.

3. **No More Mock Data:** Removed hardcoded values like `$45,231.89`. Statistics now come from `/analytics/dashboard` endpoint.

## Recent Changes (2024-12-28)

### Frontend Pages Updated to Use Real API:
- ✅ `my-apps/page.tsx` - Fetches API keys, creates new apps via API
- ✅ `developer-dashboard.tsx` - Fetches dashboard stats and apps from API
- ✅ `wallet/page.tsx` - Fetches wallets, transactions, revenue config
- ✅ `onboarding-tour.tsx` - Fixed modal centering (no more transform issues)
- ✅ Created `progress.tsx` component

### Backend Connection:
- Frontend proxy configured: `/api/*` → `http://localhost:3000`
- All API endpoints defined in `src/lib/api.ts`
- Types defined in `src/lib/types.ts`

## To Make It Work

### 1. Start Infrastructure
```bash
cd /Users/tahacancelebi/data_claus-monorepo
docker-compose up -d
```

### 2. Start Go Backend
```bash
go run apps/dataclaus-api/cmd/api
```

### 3. Frontend Already Running
The Next.js dev server is running on `http://localhost:3001`

### 4. (Optional) Start AI Worker
```bash
cd apps/ai-worker
pip install -r requirements.txt
python src/worker.py
```

## Known Issues

1. **Progress Component Created:** Was missing, now added to `src/components/ui/progress.tsx`
2. **Charts Show Empty Data:** Real chart data requires events to flow through the system
3. **No WebSocket Yet:** Dashboard doesn't auto-refresh; requires page reload

## Next Steps

1. **Test Full Flow:** Send test data via curl → verify it appears in dashboard
2. **Add Application Entity (Optional):** If we need more app metadata beyond just API key name
3. **Real-time Updates:** Add WebSocket or polling for live dashboard updates
4. **Complete App Details Page:** Wire up the `[id]/page.tsx` to show real app stats

---
*Last Updated: 2024-12-28 01:00*
