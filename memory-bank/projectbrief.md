# Project Brief: DataClaus

## Vision

**"Big Tech Knows When You’re Awake. We Make Sure You Get Paid for It."**

DataClaus is a decentralized data economy platform designed to disrupt surveillance capitalism. It enables users to monetize their behavioral data (sensor data, usage patterns) directly, while providing Developers and AI Companies with high-quality, fraud-verified datasets.

## Core Objective (Capstone Context)

This project is a **Capstone Project (Bitirme Projesi)**.

- **Goal:** Demonstrate a sophisticated, working end-to-end architecture (Mobile -> API -> AI -> Ledger -> Dashboard).
- **Simulation Mode:** Real payment gateways (Stripe/Crypto) and complex IAM are simulated to focus on the data flow, architecture, and "AI Quality Engine" logic.
- **Key Metric:** Success is defined by a working demo where shaking a phone triggers a real-time graph update and a wallet balance increase on the dashboard.

## Scope

1.  **Mobile SDK (React Native):** Collects sensor data (accelerometer, touch biometrics) efficiently.
2.  **Node.js SDK (The Envoy):** Proxies data from the developer's backend to DataClaus, handling cryptographic signing (HMAC).
3.  **DataHub API (The Brain - Go):** High-performance ingestion point using **Echo** and **GORM**.
4.  **AI Quality Engine (The Worker - Python):** Unsupervised learning (Isolation Forest) to detect bots vs. humans.
5.  **Ledger System:** A "Quality = Money" financial backend tracking rewards for Developers and End Users.
6.  **Ad-Tech Layer:** A simulated marketplace where "Buyers" bid on data streams.

## Technical Constraints

- **Backend:** Go 1.25 (Echo Framework).
- **Database:** PostgreSQL managed via **GORM** (ORM).
- **Messaging:** Apache Kafka.
- **Fraud Detection:** Python (Scikit-learn) via Worker service.
- **Monorepo:** Nx.
