# Product Context

## The Problem

1.  **Surveillance Capitalism:** Users generate valuable data but get $0.
2.  **Bot Fraud:** Developers paying for "user acquisition" often pay for bot farms.
3.  **Data Quality:** AI companies need clean, verified human behavior data, not synthetic noise.

## The Solution: Quality-Based Economy

DataClaus introduces a marketplace where **Quality Score determines Revenue**.

- **High Quality (Real Human):** High reward.
- **Low Quality (Bot/Script):** Zero reward or penalty.

## User Journey (The Data Flow)

1.  **Generation:** User shakes their phone or scrolls in an app using `@dataclaus/react-native`.
2.  **Transmission:** Data flows to the App Developer's backend, then via `@dataclaus/node` to DataClaus API.
3.  **Ingestion:** DataClaus API (Go) validates the HMAC signature and pushes raw data to Kafka.
4.  **Analysis:** Python Worker consumes from Kafka, runs `IsolationForest` to detect anomalies (Jitter, timing variance).
5.  **Monetization:**
    - If valid, the system matches the data with a "Buyer Campaign".
    - Price is calculated.
    - **Ledger Update:** Buyer wallet decremented; Developer & User wallets incremented.
6.  **Visualization:** User sees their earnings increase in real-time on the Dashboard.

## Core Entities (The 5 Kingdoms)

1.  **IAM:** Developers (Clients) and End Users (Data Providers).
2.  **Finance:** Wallets (Dev, User, Buyer) and Ledger Transactions.
3.  **Marketplace:** Data Buyers (Advertisers) and Campaigns (Bids).
4.  **Analytics:** Scored Events (Metadata of processed data).
5.  **Raw Data:** Sensor logs (Ephemeral/Kafka).
