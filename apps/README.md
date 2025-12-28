# DataClaus Complete Pipeline

This directory contains the full DataClaus data economy pipeline.

## 🏗️ Architecture

```
┌─────────────────────┐
│   📱 Mobile App     │
│   (demo-mobile)     │
│                     │
│ Uses SDK to collect │
│ real sensor data    │
└─────────┬───────────┘
          │ POST /dataclaus/events
          ▼
┌─────────────────────┐
│   🖥️ Dev Backend    │
│   (demo-backend)    │
│                     │
│ Uses SDK for HMAC   │
│ signing & forwarding│
└─────────┬───────────┘
          │ POST /v1/ingest/batch (HMAC signed)
          ▼
┌─────────────────────┐
│   ⚙️ DataClaus API  │
│   (dataclaus-api)   │
│                     │
│ Validates HMAC &    │
│ publishes to Kafka  │
└─────────┬───────────┘
          │ Kafka: ingest.raw_data
          ▼
┌─────────────────────┐
│   🤖 AI Worker      │
│   (ai-worker)       │
│                     │
│ ML quality scoring  │
│ & database writes   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   🗄️ PostgreSQL     │
│   (scored_events)   │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   🌐 Dashboard      │
│   (dataclaus-web)   │
│                     │
│ Admin/Dev/User UI   │
│ Analytics & Wallets │
└─────────────────────┘
```

## 📦 Components

| Component         | Path                 | Stack          | Port |
| ----------------- | -------------------- | -------------- | ---- |
| **Mobile App**    | `apps/demo-mobile`   | Expo + SDK     | –    |
| **Dev Backend**   | `apps/demo-backend`  | Node + SDK     | 4000 |
| **DataClaus API** | `apps/dataclaus-api` | Go + Echo      | 3000 |
| **AI Worker**     | `apps/ai-worker`     | Python + Kafka | –    |
| **Dashboard**     | `apps/dataclaus-web` | Next.js        | 3000 |

## 📚 SDKs

| SDK                  | Path                        | Usage                    |
| -------------------- | --------------------------- | ------------------------ |
| **Node SDK**         | `packages/sdk-node`         | Server-side HMAC signing |
| **React Native SDK** | `packages/sdk-react-native` | Mobile sensor collection |

## 🚀 Quick Start

### 1. Start Infrastructure

```bash
docker compose up -d  # PostgreSQL, Kafka, Zookeeper
```

### 2. Start DataClaus API (Go)

```bash
cd apps/dataclaus-api
go run cmd/api/main.go
```

### 3. Start AI Worker (Python)

```bash
cd apps/ai-worker
pip install -r requirements.txt
python src/worker.py
```

### 4. Start Dev Backend (Node)

```bash
cd apps/demo-backend
npm install
npm start
```

### 5. Start Dashboard (Next.js)

```bash
cd apps/dataclaus-web
npm run dev
```

### 6. Start Mobile App (Expo)

```bash
cd apps/demo-mobile
npm install
npx expo start
```

## 🔧 SDK Usage

### Node SDK (Developer Backend)

```typescript
import { DataClausClient } from '@dataclaus/sdk-node';

const client = new DataClausClient({
  apiKey: 'dc_your_key',
  hmacSecret: 'your_secret',
  developerId: 'dev_123',
  apiUrl: 'http://localhost:3000',
});

// Send sensor events
await client.ingestBatch(events);
```

### React Native SDK (Mobile App)

```typescript
import { DataClausCollector, useSensorTracking } from '@dataclaus/sdk-react-native';

// Initialize collector
const collector = new DataClausCollector({
  backendUrl: 'http://your-backend:4000',
  userId: 'user_123',
});

// Start collection
collector.start();

// Track sensor data
collector.trackAccelerometer({ x, y, z });
collector.trackGyroscope({ x, y, z });

// Stop and flush
collector.stop();
```

## 🐍 AI Worker Customization

The AI Worker uses a mock scoring function. Replace it with your ML model:

```python
# apps/ai-worker/src/worker.py

def calculate_quality_score(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Replace this with your ML model!

    Input: Sensor event with accelerometer/gyroscope data
    Output: Quality metrics (score, is_human, jitter, etc.)
    """
    # Your ML logic here
    model = load_your_model()
    score = model.predict(event)

    return {
        "quality_score": score,
        "is_human": score > 0.5,
        "jitter": ...,
        "time_variance": ...,
        "payout": score * 0.001,
    }
```

## 📊 Data Flow

1. **Mobile App** collects accelerometer & gyroscope via SDK
2. **SDK batches** events (20 events or 3 seconds)
3. **Dev Backend** receives batch, signs with HMAC via SDK
4. **DataClaus API** validates signature, publishes to Kafka
5. **AI Worker** consumes Kafka, runs ML scoring
6. **scored_events** table updated with quality metrics
7. **Wallets credited** based on quality score
8. **Dashboard** displays analytics & earnings

## 🔐 Security

- **HMAC-SHA256** signatures on all API requests
- **API Keys** for developer authentication
- **JWT Tokens** for user authentication
- **bcrypt** password hashing

## 📈 Future Enhancements

- [ ] Real ML model for fraud detection
- [ ] Touch biometrics analysis
- [ ] Session behavior patterns
- [ ] On-device ML preprocessing
- [ ] Real-time quality feedback
