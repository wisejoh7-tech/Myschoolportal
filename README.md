# 🎓 UniPortal V3 - The Best Educational Management System

A high-performance, real-time school portal built for professional environments. Powered by Node.js, React, PostgreSQL, and AI.

## 🌟 Top-Tier Features

- **🛡️ Iron-Clad Security:** Dual-layer authentication with Firebase Identity and Backend JWT verification.
- **🐘 Relational Mastery:** Full PostgreSQL database with Sequelize ORM for ACID-compliant transactions.
- **🤖 Contextual AI:** Google Gemini-powered tutor that understands student academic records and financial status.
- **📡 Real-Time Heartbeat:** Socket.io integration for instant treasury verification and registry updates.
- **📊 Admin Command Center:** Professional CRM-style dashboard for managing thousands of students and millions in revenue.
- **🪵 Forensic Logging:** Winston-powered logging for every critical action (Payments, Grades, Attendance).
- **🐋 Dockerized:** Production-ready `docker-compose` setup for one-click global deployment.

## 🛠️ Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS + Framer Motion
- **Backend:** Node.js (ESM) + Express
- **Database:** PostgreSQL 15
- **Real-time:** Socket.io
- **Identity:** Firebase Auth + Admin SDK
- **AI:** Google Generative AI (Gemini Pro)

## 🚀 One-Click Start (Docker)

Ensure Docker Desktop is running, then:
```bash
docker-compose up --build
```

## 🛠️ Manual Development

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   - Create `.env` based on `.env.example`.
   - Add your `GOOGLE_AI_KEY` and `DATABASE_URL`.
   - Place `serviceAccountKey.json` in the root (if using Firebase Admin Service Account).

3. **Launch Everything:**
   ```bash
   npm run dev:all
   ```

---

## 🌐 Deploying to Cloud & Hosting Platforms

### 0. ☁️ Deploying to Amazon Web Services (AWS)

UniPortal V3 provides turnkey infrastructure and configuration for deploying to **AWS**:
- **Frontend:** AWS S3 + CloudFront (React, Vite, TypeScript, HTTPS API requests, SPA routing with OAC).
- **Backend:** AWS App Runner or AWS ECS Fargate (Node.js/Express or Django REST Framework).
- **Database:** Amazon RDS (PostgreSQL 15 with automated backups and SSL).

#### Quick AWS Deployment Options:
1. **AWS CloudFormation:** Deploy `aws/cloudformation-template.yaml` to provision S3, CloudFront, RDS PostgreSQL, and App Runner in one command.
2. **Terraform IaC:** Apply modular Terraform in `aws/terraform/`.
3. **Automated CI/CD:** Ready-to-use GitHub Actions workflow in `.github/workflows/deploy-aws.yml`.
4. **S3 Deploy Script:** Run `./scripts/deploy_s3_cloudfront.sh` to compile frontend and sync to S3 with cache invalidation.

📖 For complete architectural diagrams, step-by-step instructions, and environment configurations, read the **[AWS Deployment Guide](AWS_DEPLOYMENT_GUIDE.md)**.

---

### 1. 🚀 Deploying to Render

This repository includes a `render.yaml` Blueprint for automated provisioning of both the Web Service and PostgreSQL database on Render.

#### Option A: One-Click Infrastructure via Render Blueprints (Recommended)
1. Push your repository to GitHub or GitLab.
2. Log in to your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** -> **Blueprint**.
4. Connect your repository. Render will automatically detect `render.yaml` and configure:
   - Web Service: `uniportal` (Docker runtime)
   - Database: `uniportal-db` (PostgreSQL 15)
5. Set any missing environment variables in the Render Dashboard (e.g., `GOOGLE_AI_KEY`, `VITE_API_URL`, `ADMIN_PASSWORD`).
6. Click **Apply**.

#### Option B: Manual Service Creation on Render
1. **Provision PostgreSQL Database:**
   - Go to **New +** -> **PostgreSQL Database**.
   - Name: `uniportal-db`.
   - Copy the **Internal Database URL** or **External Connection String**.

2. **Provision Web Service:**
   - Go to **New +** -> **Web Service**.
   - Select **Build and deploy from a Git repository**.
   - Select **Docker** runtime.
   - Build Context: `.`
   - Dockerfile Path: `Dockerfile`
   - Add Environment Variables:
     - `PORT`: `5000`
     - `DATABASE_URL`: *(Your Render PostgreSQL connection string)*
     - `JWT_SECRET`: *(Random secret key)*
     - `GOOGLE_AI_KEY`: *(Your Gemini API Key)*
     - `VITE_API_URL`: `https://<your-render-app-name>.onrender.com`
     - `VITE_SOCKET_URL`: `https://<your-render-app-name>.onrender.com`

---

### 2. 🚂 Deploying to Railway

This repository includes `railway.json` pre-configured to build using the root `Dockerfile` and start the server seamlessly.

#### Step-by-Step Deployment on Railway:

1. **Create a Railway Project:**
   - Log in to [Railway](https://railway.app/).
   - Click **New Project** -> **Deploy from GitHub repo**.
   - Select your UniPortal repository.

2. **Add PostgreSQL Database Plugin:**
   - In your Railway project canvas, click **New** -> **Database** -> **Add PostgreSQL**.
   - Railway will automatically provision a PostgreSQL instance and generate a `DATABASE_URL` environment variable.

3. **Link Web Service to Database & Set Environment Variables:**
   - Click on your app service in Railway.
   - Go to **Variables** and add / reference:
     - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` *(or the PostgreSQL connection string generated by Railway)*
     - `PORT`: `5000`
     - `NODE_ENV`: `production`
     - `JWT_SECRET`: *(Secret key for JWT tokens)*
     - `GOOGLE_AI_KEY`: *(Gemini API Key)*
     - `ADMIN_EMAIL`: `admin_user@example.com`
     - `ADMIN_PASSWORD`: *(Your secure admin password)*
     - `VITE_API_URL`: `https://<your-railway-domain>.up.railway.app`
     - `VITE_SOCKET_URL`: `https://<your-railway-domain>.up.railway.app`

4. **Generate Railway Domain:**
   - Go to your service's **Settings** tab -> **Networking** -> **Generate Domain** (e.g. `uniportal-production.up.railway.app`).
   - Re-deploy if necessary so client-side Vite variables take effect.

---

### 3. 🎈 Deploying to Fly.io

This repository includes a `fly.toml` configuration ready for Fly.io deployment using the application's multi-stage Docker build.

#### Step-by-Step Deployment on Fly.io:

1. **Install Flyctl & Authenticate:**
   - Install the Fly CLI: `curl -L https://fly.io/install.sh | sh` (or `brew install flyctl`).
   - Log in to Fly.io:
     ```bash
     fly auth login
     ```

2. **Create Managed Fly Postgres Database:**
   - Provision a PostgreSQL database instance on Fly.io:
     ```bash
     fly postgres create --name uniportal-db
     ```

3. **Launch / Register Application:**
   - Run `fly launch` in the repository root. When prompted:
     - Keep existing `fly.toml` configuration if prompted.
     - Attach the Postgres database created in step 2 (or run `fly postgres attach uniportal-db`). Attaching automatically sets the `DATABASE_URL` secret.

4. **Set Environment Secrets:**
   - Configure required secrets using `fly secrets set`:
     ```bash
     fly secrets set JWT_SECRET="your-jwt-secret-key" GOOGLE_AI_KEY="your-gemini-key" ADMIN_EMAIL="admin_user@example.com" ADMIN_PASSWORD="your-secure-admin-password"
     ```

5. **Deploy the Application:**
   - Deploy your application:
     ```bash
     fly deploy
     ```
   - Open your app in the browser: `fly open`.

---

## 🐘 Migrating Local `uniportal.sqlite` to PostgreSQL (Render / Railway / Fly.io)

To migrate existing local SQLite records (`uniportal.sqlite`) to your deployed PostgreSQL database on Render or Railway:

1. Obtain your PostgreSQL Connection String (e.g. `postgres://user:pass@host:5432/uniportal`).
2. Run the migration script:
   ```bash
   npm run migrate:pg -- --target-db-url="postgres://user:password@host:5432/uniportal"
   ```
   *Or set `DATABASE_URL` in your environment before running `npm run migrate:pg`.*

The script will synchronize schemas, copy records across all models (`Users`, `Payments`, `Attendances`, `Applications`, `EntranceExamQuestions`, `EntranceExamSubmissions`), convert data types safely, and output a migration verification summary.

---
**Institutional Registry • Digital Confirmation • 2026**
