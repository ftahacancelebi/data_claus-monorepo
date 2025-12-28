# DataClaus Pipeline - Complete Flow

## Architecture Overview

```
┌─────────────────┐     ┌────────────────────┐     ┌───────────────────┐
│   Mobile App    │────▶│   Demo Backend     │────▶│   DataClaus API   │
│ (SDK React      │     │ (Your Node.js)     │     │   (Go Server)     │
│  Native)        │     │ Uses SDK-Node      │     │   Port 3000       │
│                 │     │ Port 4000          │     │                   │
└─────────────────┘     └────────────────────┘     └───────────────────┘
                                                           │
                                                           ▼
                                                   ┌───────────────────┐
                                                   │      Kafka        │
                                                   │ Topic: ingest.    │
                                                   │   raw_data        │
                                                   └───────────────────┘
                                                           │
                                                           ▼
                                                   ┌───────────────────┐
                                                   │   AI Worker       │
                                                   │   (Python)        │
                                                   │   Scores data     │
                                                   └───────────────────┘
                                                           │
                                                           ▼
                                                   ┌───────────────────┐
                                                   │    PostgreSQL     │
                                                   │  scored_events    │
                                                   └───────────────────┘
```

## Ingest Request Format (Go API expects this)

### Headers Required:

```
X-API-Key: <your_api_key>
X-Signature: HMAC-SHA256(body_json, api_key) as hex
Content-Type: application/json
```

**Important:** The API Key IS also the HMAC secret!

### POST /v1/ingest (Single Event)

```json
{
  "event_id": "evt_1234567890_abc", // string, required
  "developer_id": "dev_abc123", // string, required (NOT UUID)
  "user_id": "user_xyz789", // string, required (NOT UUID)
  "event_type": "accelerometer", // string, required
  "timestamp": "2025-12-27T00:30:00Z", // ISO8601, required
  "payload": {
    // object, required
    "accelerometer": { "x": 0.1, "y": 0.2, "z": 9.8 }
  },
  "session_id": "session_123", // optional
  "campaign_id": "campaign_456" // optional
}
```

### POST /v1/ingest/batch (Multiple Events)

```json
{
  "events": [
    {
      /* same as single event */
    },
    {
      /* ... */
    }
  ],
  "session": {
    "session_id": "session_123",
    "start_time": "2025-12-27T00:25:00Z",
    "active_seconds": 300
  }
}
```

## Running the Full Stack

### 1. Start Infrastructure (Docker)

```bash
docker compose up -d postgres kafka zookeeper
```

### 2. Start Go API

```bash
cd apps/dataclaus-api
go run cmd/api/main.go
# Runs on http://localhost:3000
```

### 3. Start Dashboard (Next.js)

```bash
cd apps/dataclaus-web
npm run dev
# Runs on http://localhost:3001
```

### 4. Create API Key via Dashboard

1. Go to http://localhost:3001
2. Register as "Developer"
3. Go to Dashboard > API Keys
4. Generate a new key
5. **COPY THE RAW KEY** (shown only once!)
6. Note your Developer UUID from your profile

### 5. Configure Demo Backend

```bash
cd apps/demo-backend
cp .env.example .env
# Edit .env with your API key and developer ID
```

### 6. Start Demo Backend

```bash
cd apps/demo-backend
npm start
# Runs on http://localhost:4000
# Should show "SDK Enabled: true"
```

### 7. Start AI Worker (Python)

```bash
cd apps/ai-worker
pip3 install -r requirements.txt
python3 src/worker.py
# Consumes from Kafka, writes scores to PostgreSQL
```

### 8. Start Mobile App

```bash
cd apps/demo-mobile
npx expo start
# Scan QR with Expo Go app
```

## HMAC Signature Generation

The signature is calculated as:

```javascript
// Node.js
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', apiKey) // apiKey is the secret
  .update(JSON.stringify(body)) // body as JSON string
  .digest('hex');
```

```python
# Python
import hmac
import hashlib
import json
signature = hmac.new(
    api_key.encode(),
    json.dumps(body).encode(),
    hashlib.sha256
).hexdigest()
```

```go
// Go
h := hmac.New(sha256.New, []byte(apiKey))
h.Write(body)
signature := hex.EncodeToString(h.Sum(nil))
```
