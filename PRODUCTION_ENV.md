# UniPortal Production Environment Configuration Guide

This document provides a detailed technical overview of the production frontend and backend environment configurations for **UniPortal V3**.

---

## 🏛️ System Architecture Overview

UniPortal V3 operates on a high-performance modular architecture designed for security, scalability, and multi-tenant isolation:

* **Frontend:** React 19, Vite, Tailwind CSS, Framer Motion, and Axios client.
* **Backend Runtime:** Node.js (ESM) + Express server with Socket.io real-time engine, supplemented by an optional Django REST Framework API engine for administrative microservices.
* **Database:** PostgreSQL 15 (ACID-compliant relational store with Sequelize ORM and Django ORM support; SQLite3 supported for local/standalone fallback).
* **Identity & Authentication:** Dual-layer security supporting custom JWT tokens (`jsonwebtoken`) and Firebase Identity & Access Management (Firebase Auth + Firebase Admin SDK).
* **Contextual AI:** Google Gemini Pro (`@google/generative-ai` & `@google/genai`).

---

## 💻 Frontend Production Environment

The frontend is built using **Vite**. In Vite, environment variables prefixed with `VITE_` are embedded into the client bundle at **build time** (`npm run build`).

### 1. Frontend Environment Variables

| Variable | Type | Description | Production Example |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | String (URL) | Primary HTTP REST API base endpoint consumed by Axios (`src/api/axios.ts`). | `https://uniportal-backend.onrender.com` |
| `VITE_SOCKET_URL` | String (URL) | WebSocket server endpoint for real-time Socket.io heartbeat connection. | `https://uniportal-backend.onrender.com` |
| `VITE_FIREBASE_API_KEY` | String | Firebase Web API Key for client authentication. | `AIzaSyB...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | String | Firebase Authentication domain. | `uniportal-app.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | String | Firebase Project ID. | `uniportal-app` |
| `VITE_FIREBASE_STORAGE_BUCKET` | String | Firebase Cloud Storage bucket URL. | `uniportal-app.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | String | Firebase Cloud Messaging (FCM) sender ID. | `123456789012` |
| `VITE_FIREBASE_APP_ID` | String | Firebase Web Application ID. | `1:123456789012:web:abc123def456` |
| `VITE_ADMIN_PATH` | String | Obfuscated route path for entry into administrative core. | `lukke-core-admin-002` |
| `GEMINI_API_KEY` | String | Optional direct Gemini client key (if client-side AI execution is enabled). | `AIzaSyD...` |

### 2. Frontend Build & Serving Mechanism

* **Static Asset Compilation:** Executing `npm run build` generates optimized static assets inside the `dist/` directory.
* **SPA Routing & Fallback:** In production, single-page application (SPA) client routes (e.g., `/admin`, `/portal`, `/auth`) are handled by routing requests to `dist/index.html`.
  * Render Static Site (`render.yaml`): Rewrites `/*` to `/index.html`.
  * Express Backend (`server.js`): Uses `app.use(express.static('dist'))` and `app.get('*', ...)` fallback.
  * Vercel (`vercel.json`): Configured with rewriting rule `{"source": "/(.*)", "destination": "/index.html"}`.

---

## ⚙️ Backend Production Environment

The backend server relies on runtime environment variables loaded via process environment or `.env` file (`dotenv`).

### 1. Node.js Express Backend Configuration (`server.js`)

| Variable | Type | Default / Required | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `production` | Enables production mode optimizations. |
| `PORT` | Integer | `5000` | HTTP application port for Express server & Socket.io listener. |
| `WS_PORT` | Integer | `8080` | Separate WebSocket listener port (optional fallback). |
| `CORS_ORIGIN` | String / CS List | `*` | Allowed CORS origins. In production, set to frontend URL (e.g. `https://uniportal-frontend.onrender.com`). |
| `DATABASE_URL` | String (URI) | Required | PostgreSQL connection URI (e.g., `postgres://user:pass@host:5432/uniportal`). |
| `JWT_SECRET` | String | Required | Secret key used for signing and verifying backend JWT tokens. |
| `SERVICE_ACCOUNT_PATH` | String (Path) | `./serviceAccountKey.json` | Relative path to Firebase Admin SDK JSON credentials file. |
| `GOOGLE_AI_KEY` | String | Required for AI | Google Gemini API key for intelligent AI tutoring endpoints. |
| `EMAIL_USER` | String (Email) | Optional | Gmail/SMTP sender address for official registration & receipt emails. |
| `EMAIL_PASS` | String | Optional | SMTP app password for automated mailer. |
| `ADMIN_EMAIL` | String (Email) | `admin_user@example.com` | Initial administrator email address for database seed. |
| `ADMIN_PASSWORD` | String | `AdminPassword123!` | Initial administrator password for database seed. |

### 2. Django API Engine Configuration (`backend/server/settings.py`)

For deployments utilizing the Django REST API backend:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `DJANGO_SECRET_KEY` | String | Set in production | Django secret key for cryptographic signing. |
| `DJANGO_DEBUG` | Boolean | `False` in prod | Debug flag. Must be set to `False` in production. |
| `DJANGO_ALLOWED_HOSTS` | CS List | `localhost,127.0.0.1` | Host/domain names that the Django backend can serve. |
| `DATABASE_URL` | String (URI) | `sqlite:///uniportal.sqlite` | Relational database connection string. |

---

## 🚀 Hosting & Infrastructure Environments

UniPortal supports multi-platform cloud deployments with standardized configuration manifests included in the repository:

### 1. Render Infrastructure Blueprint (`render.yaml`)
Render provisions three connected resources via Blueprint:
* **Backend Web Service (`uniportal-backend`):** Docker runtime running `server.js` on port `5000`. Connected to `uniportal-db` via `DATABASE_URL` and accepts `CORS_ORIGIN` from `uniportal-frontend`.
* **Frontend Static Site (`uniportal-frontend`):** Vite static site built with `npm run build` from `./dist`, configured with SPA rewrite rules (`/*` -> `/index.html`), automatically receiving `VITE_API_URL` and `VITE_SOCKET_URL` pointing to `uniportal-backend`.
* **PostgreSQL Database (`uniportal-db`):** Managed PostgreSQL database.

### 2. Docker & Containerization (`Dockerfile` & `docker-compose.yml`)
* **Multi-stage Build:** Utilizes `node:20-slim` image with C/C++ compilation tools for native modules (`sqlite3`).
* **Container Expose:** Port `5000`.
* **Execution Command:** `npm run server` (starts `server.js`).

### 3. Railway (`railway.json`)
* Uses Docker build provider (`railway.json` with `watchPatterns`).
* Links directly to Railway PostgreSQL plugin via `${{Postgres.DATABASE_URL}}`.

### 4. Fly.io (`fly.toml`)
* Region-aware configuration (`primary_region = "iad"`).
* Runs app on port `5000` with HTTP force-HTTPS middleware.
* Secrets configured via `fly secrets set`.

### 5. Vercel (`vercel.json`)
* Client-side static hosting configuration with catch-all rewriting to `index.html`.

---

## 🛡️ Production Security & Operational Best Practices

1. **Secret Management:** Ensure `JWT_SECRET`, `GOOGLE_AI_KEY`, `EMAIL_PASS`, and database credentials are stored in secure environment managers (e.g., Render Environment Secrets, Fly Secrets, Railway Variables) and never committed to version control.
2. **CORS Restrictions:** Set `CORS_ORIGIN` explicitly to the deployed frontend domain in production (`https://<your-static-site>.onrender.com`).
3. **Database Migration:** Run `npm run migrate:pg` when transitioning from local development SQLite store to production PostgreSQL cluster.
4. **Logging & Auditing:** Production error and transaction logs are stored in `logs/error.log` and `logs/combined.log` using Winston, while critical tenant operations record immutable audit entries in the `AuditLogs` table.
