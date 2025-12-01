# Technical Context

## Core Stack

### Backend (DataHub API) - `apps/dataclaus-api`

- **Language:** Go 1.25
- **Web Framework:** `github.com/labstack/echo/v4` (v4.13.4)
- **ORM:** `gorm.io/gorm` (v1.31.1) with `gorm.io/driver/postgres` (v1.6.0)
- **Logging:** `github.com/rs/zerolog` (v1.34.0)
- **Validation:** `github.com/go-playground/validator/v10` (v10.28.0)
- **Utilities:** `github.com/google/uuid`, `github.com/joho/godotenv`
- **Testing:** `github.com/stretchr/testify`

### Worker (AI Engine)

- **Language:** Python 3.9+
- **Libraries:** `confluent-kafka`, `scikit-learn`, `pandas`, `numpy`, `psycopg2` (or `sqlalchemy` for DB access).

### SDKs

- **Node SDK:** TypeScript, `crypto` (for HMAC).
- **React Native SDK:** TypeScript, `react-native-sensors`, `react-native-device-info`.

### Infrastructure (Local Development)

- **Containerization:** Docker & Docker Compose.
- **Services:**
  - PostgreSQL 16 (Database)
  - Apache Kafka & Zookeeper (Message Queue)
  - Kafka UI (Debugging)

## Monorepo Structure (Nx)

- `apps/dataclaus-api`: The Go Backend.
- `apps/datahub-frontend`: Next.js Dashboard.
- `libs/sdk-node`: The Developer SDK.
- `libs/sdk-react-native`: The Mobile SDK.
- `libs/shared-types`: Common TypeScript definitions (Proto/JSON).

## Development Setup

- **Dependency Management:** `go mod tidy` for Go, `pnpm` for JS/TS.
- **Env Variables:** managed via `.env` files loaded by `godotenv`.
