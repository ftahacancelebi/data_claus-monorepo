# Active Context

## Current Focus

We are initializing the **DataHub API (Go)** using the new technology stack (Echo + GORM). The previous plan involving manual SQL/sqlc has been deprecated in favor of GORM for faster iteration in the Capstone context.

## Active Decisions

1.  **GORM Adoption:** We are moving to GORM to simplify database interactions and schema management (`AutoMigrate`) for the simulation.
2.  **Ad-Tech Simulation:** We are explicitly modeling "Data Buyers" and "Campaigns" in the database to close the economic loop (Money comes from Buyers, not thin air).
3.  **Simulation Mode:** We are skipping real payment gateways. Ledger balances are internal numbers for the demo.

## Recent Changes

- Defined `go.mod` dependencies including Echo v4 and GORM.
- Established the 5-module database schema (IAM, Finance, Marketplace, Analytics, End Users).

## Immediate Next Steps

### Phase 1: Foundation (Go Backend Core)

1.  **Issue 1: Database & Configuration Setup**

    - Initialize GORM with PostgreSQL and set up environment configuration.
    - Branch: `feat/db-setup`

2.  **Issue 2: Core Domain Models**

    - Define Go structs (`User`, `Wallet`, `Campaign`, `LedgerTransaction`) and enable `AutoMigrate`.
    - Branch: `feat/core-models`

3.  **Issue 3: API Server & Middleware**
    - Setup Echo server with Zerolog, Recovery, CORS, and Validation middleware.
    - Branch: `feat/api-server`

### Phase 2: Ingestion & Messaging

4.  **Issue 4: Kafka Infrastructure & Producer**

    - Setup Kafka in Docker and implement the Go Producer.
    - Branch: `feat/kafka-producer`

5.  **Issue 5: Ingest Endpoint**
    - Create the `/v1/ingest` endpoint to push events to Kafka.
    - Branch: `feat/ingest-endpoint`
