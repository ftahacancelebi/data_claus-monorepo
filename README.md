# DataClaus - Data Marketplace Platform

> **For Investment Presentations & Demo**

## 🎯 What is DataClaus?

DataClaus is a **privacy-first data marketplace** that enables mobile app developers to monetize anonymized user behavioral data while ensuring users get paid for their data contributions.

### Key Value Propositions:

- **For Developers**: Earn revenue from anonymized behavioral data your app already collects
- **For Users**: Get paid $0.001-$0.01 per quality data point
- **For Data Buyers**: Access verified, high-quality behavioral data for analytics/ML
- **For Everyone**: AI-powered fraud detection ensures only authentic human data

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATACLAUS PLATFORM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│   │  Mobile SDK  │────▸│   REST API   │────▸│    Kafka     │    │
│   │  (React/iOS) │     │   (Go/Echo)  │     │   (Events)   │    │
│   └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                     │              │
│     HMAC Signed         API Keys &               Event           │
│     Requests            Applications            Streaming         │
│                                                     │              │
│                              ▼                     ▼              │
│                    ┌──────────────┐     ┌──────────────┐         │
│                    │  PostgreSQL  │◀────│  AI Worker   │         │
│                    │  (Ledger DB) │     │  (Python/ML) │         │
│                    └──────────────┘     └──────────────┘         │
│                              │                     │              │
│                          Ledger               Fraud              │
│                        Transactions          Detection           │
│                              │                                    │
│                              ▼                                    │
│                    ┌──────────────────────────────────┐          │
│                    │       Developer Dashboard         │          │
│                    │         (Next.js 15)             │          │
│                    │  • Real-time Stats • API Keys    │          │
│                    │  • Revenue Tracking • Analytics  │          │
│                    └──────────────────────────────────┘          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Demo Mode)

### 1. Start All Services

```bash
# Start infrastructure (PostgreSQL + Kafka)
docker-compose up -d

# Wait for services
sleep 10

# Start Go backend (new terminal)
go run apps/dataclaus-api/cmd/api

# Frontend is already on http://localhost:3001
cd apps/dataclaus-web && npm run dev
```

### 2. Run End-to-End Test

```bash
./scripts/e2e-test.sh
```

This will:
- Create a test developer
- Create an application with API key
- Test HMAC authentication
- Verify the full data pipeline

---

## 🔐 Security: HMAC Authentication

Every SDK request is signed using **HMAC-SHA256**:

```javascript
// Mobile SDK signs every request
const payload = JSON.stringify(eventData);
const signature = CryptoJS.HmacSHA256(payload, API_KEY).toString();

fetch('https://api.dataclaus.com/v1/ingest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-Signature': signature
  },
  body: payload
});
```

This ensures:
- ✅ Request integrity (tamper-proof)
- ✅ API key ownership verification
- ✅ Replay attack protection (with timestamps)

---

## 📱 Application Management

Each application gets its own:
- **Unique API Key**: For SDK authentication
- **Statistics Dashboard**: Events, users, revenue
- **Revenue Settings**: Configurable user share (50-90%)

### API Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/developers/:id/applications` | Create app (returns API key) |
| GET | `/developers/:id/applications` | List all apps |
| GET | `/applications/:id` | Get app details |
| GET | `/applications/:id/stats` | Get app statistics |
| PUT | `/applications/:id` | Update app |
| DELETE | `/applications/:id` | Deactivate app |

---

## 💰 Revenue Sharing Model

```
┌─────────────────────────────────────────┐
│           Revenue Distribution          │
├─────────────────────────────────────────┤
│                                         │
│   Data Buyer pays $1.00                 │
│            ↓                            │
│   ┌─────────────────────────────┐       │
│   │ Users:     70% = $0.70      │       │
│   │ Developer: 25% = $0.25      │       │
│   │ Platform:   5% = $0.05      │       │
│   └─────────────────────────────┘       │
│                                         │
│   * User share configurable (50-90%)    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🤖 AI Fraud Detection

Our **Isolation Forest** model detects bot traffic:

- **Jitter Analysis**: Human touch has natural variance
- **Time Variance**: Consistent timing patterns = bot
- **Quality Score**: 0-1 score for each data point

Only verified human data gets processed.

---

## 📊 Demo URLs

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3001 | Developer Portal |
| Backend API | http://localhost:3000 | REST API |
| Kafka UI | http://localhost:8090 | Message Queue Monitor |
| Database | localhost:5432 | PostgreSQL |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | Next.js 15, React 19 | Modern, fast, SEO-friendly |
| Backend | Go, Echo, GORM | High performance, type safety |
| Database | PostgreSQL | ACID for financial ledger |
| Queue | Apache Kafka | Event streaming at scale |
| ML | Python, Scikit-learn | Fraud detection |
| Auth | HMAC-SHA256 | SDK-level security |

---

## 📈 Investor Metrics (Demo Data)

After running the E2E test:

```
Total Events Processed: varies
Active Applications: varies
Data Quality Score: 75-95%
Revenue per 1000 events: ~$5.00
```

---

## 🎬 Demo Script for Investors

1. **Open Dashboard** → Show beautiful UI at localhost:3001
2. **Create Application** → Click "Create New App", show API key generation
3. **Run E2E Test** → `./scripts/e2e-test.sh` → Show all tests pass
4. **Show Kafka** → Open localhost:8090 → Show real-time event flow
5. **Explain Revenue** → Click Finances → Show revenue split visualization

---

## 📞 Contact

**Ready to discuss investment or partnership?**

This platform demonstrates:
- Full-stack engineering with modern technologies
- Real-time event processing at scale
- AI/ML integration for fraud detection
- Production-ready security (HMAC)
- Clean, investor-ready UI/UX

*Built with ❤️ for the future of ethical data monetization*
