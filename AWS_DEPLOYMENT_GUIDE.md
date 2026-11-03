# ☁️ UniPortal AWS Cloud Deployment Guide

This guide provides end-to-end instructions for deploying **UniPortal V3** onto Amazon Web Services (AWS) using industry best practices:

- **Frontend:** Amazon S3 + Amazon CloudFront (Origin Access Control, TLS/HTTPS, Single-Page Application routing).
- **Backend:** AWS App Runner or AWS ECS Fargate (Containerized Node.js/Express or Django REST Framework).
- **Database:** Amazon RDS for PostgreSQL 15 (Encrypted storage, automated backups, multi-AZ option).
- **API Communication:** Secure HTTPS REST endpoints with proxying and zero CORS friction.

---

## 🏛️ High-Level AWS Architecture

```
                                      ┌──────────────────────────────┐
                                      │        Internet Users        │
                                      └──────────────┬───────────────┘
                                                     │ HTTPS (443)
                                                     ▼
                                      ┌──────────────────────────────┐
                                      │      Amazon CloudFront       │
                                      │         Distribution         │
                                      └──────┬────────────────┬──────┘
                                             │                │
                    ┌────────────────────────┘                └────────────────────────┐
                    │ Default Behavior (Static)                                        │ Path Pattern /api/*
                    ▼                                                                  ▼
        ┌─────────────────────────┐                                        ┌─────────────────────────┐
        │        Amazon S3        │                                        │     AWS App Runner      │
        │  Static Website Bucket  │                                        │   or AWS ECS (Fargate)  │
        │  (OAC Protected, React) │                                        │ (Node.js / Django API)  │
        └─────────────────────────┘                                        └───────────┬─────────────┘
                                                                                       │
                                                                                       │ PostgreSQL Port 5432
                                                                                       │ SSL encrypted
                                                                                       ▼
                                                                           ┌─────────────────────────┐
                                                                           │  Amazon RDS PostgreSQL  │
                                                                           │      (Multi-AZ DB)      │
                                                                           └─────────────────────────┘
```

---

## 🚀 Quick Deployment Options

### Option 1: Infrastructure-as-Code with AWS CloudFormation (Recommended)

The repository provides a complete CloudFormation template at `aws/cloudformation-template.yaml` that provisions:
1. VPC, subnets, and security groups.
2. Amazon RDS PostgreSQL 15 database.
3. Amazon S3 frontend bucket with CloudFront Origin Access Control (OAC).
4. Amazon CloudFront distribution with SPA routing (403/404 -> `/index.html`) and `/api/*` forwarding.
5. AWS App Runner backend service connected to RDS.

#### Deploy via AWS CLI:
```bash
aws cloudformation deploy \
  --template-file aws/cloudformation-template.yaml \
  --stack-name uniportal-production \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      DBMasterUsername=uniadmin \
      DBMasterUserPassword="YourSecurePassword123!" \
      JwtSecret="your-random-32-char-jwt-secret-key" \
      GoogleAiKey="your-gemini-key"
```

Once deployment completes, retrieve the output URLs:
```bash
aws cloudformation describe-stacks \
  --stack-name uniportal-production \
  --query "Stacks[0].Outputs" \
  --output table
```

---

### Option 2: Terraform IaC

The Terraform configuration resides in `aws/terraform/`.

1. Initialize Terraform:
   ```bash
   cd aws/terraform
   terraform init
   ```

2. Review and Apply:
   ```bash
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

Outputs will display your S3 bucket name, CloudFront domain name, RDS endpoint, and App Runner URL.

---

## 📦 Step-by-Step Manual Deployment Guide

### 1. 🐘 Database Setup: Amazon RDS PostgreSQL

1. Open the [Amazon RDS Console](https://console.aws.amazon.com/rds).
2. Click **Create database**:
   - Engine: **PostgreSQL** (Version 15.x recommended).
   - Template: **Production** or **Free tier**.
   - DB instance identifier: `uniportal-postgres`.
   - Master username: `postgres` or `uniadmin`.
   - Master password: Enter a strong password.
   - Instance configuration: `db.t4g.micro` (or larger depending on workload).
   - Storage: 20 GB gp3 with autoscaling.
   - Connectivity: Virtual Private Cloud (VPC) with database subnet group. Ensure security group permits inbound traffic on port `5432` from your App Runner / ECS security group.
   - Additional Configuration -> Initial database name: `uniportal`.
3. Note your RDS **Endpoint** (e.g., `uniportal-postgres.c123456789.us-east-1.rds.amazonaws.com`).

---

### 2. 🚀 Backend Deployment: AWS App Runner or AWS ECS

#### Option A: AWS App Runner (Fastest & Fully Managed)

AWS App Runner provides seamless auto-scaling container execution with direct GitHub integration or Amazon ECR.

##### Method 1: Using Source Code (GitHub Integration)
1. In [AWS App Runner Console](https://console.aws.amazon.com/apprunner), click **Create service**.
2. Select **Source code repository** and connect your GitHub repository.
3. Select branch: `main` or `master`.
4. Deployment settings: **Automatic** (deploys on push).
5. Build settings: Select **Use a configuration file** (`apprunner.yaml` in repo root).
6. Under **Environment variables**, supply:
   - `DATABASE_URL`: `postgres://<username>:<password>@<rds-endpoint>:5432/uniportal`
   - `JWT_SECRET`: A secure random string.
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `GOOGLE_AI_KEY`: Your Gemini API key.
7. Under **Health check**, set:
   - Protocol: `HTTP`
   - Path: `/api/health`
8. Click **Create & deploy**.

##### Method 2: Container Image from Amazon ECR
1. Build and push container to Amazon ECR:
   ```bash
   # Log in to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

   # Build & push Node.js backend
   docker build -t uniportal-node .
   docker tag uniportal-node:latest <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/uniportal-node:latest
   docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/uniportal-node:latest
   ```
2. In App Runner, select **Container registry** -> **Amazon ECR** -> select image `<ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/uniportal-node:latest`.
3. Set Port to `5000` and health check to `/api/health`.

#### Option B: AWS ECS Fargate

Task definition templates are provided in:
- `aws/ecs-task-definition-node.json` (Node.js Express + Sequelize)
- `aws/ecs-task-definition-django.json` (Django REST Framework + Gunicorn)

1. Register task definition:
   ```bash
   aws ecs register-task-definition --cli-input-json file://aws/ecs-task-definition-node.json
   ```
2. Create an ECS Fargate Service attached to an Application Load Balancer (ALB) listening on port 5000 with target health check `/api/health`.

---

### 3. 🌐 Frontend Deployment: Amazon S3 + CloudFront

The React 19 + Vite + TypeScript frontend compiles to optimized static assets in `dist/`.

#### Step 1: Create Amazon S3 Bucket
1. Open [Amazon S3 Console](https://s3.console.aws.amazon.com/s3/).
2. Create a bucket (e.g. `uniportal-production-frontend-12345`).
3. Keep **Block all public access** enabled (CloudFront Origin Access Control will access it privately).
4. Enable **Bucket Versioning** and server-side encryption (SSE-S3).

#### Step 2: Build the Frontend
Configure the API endpoint URL to point to your backend or CloudFront `/api` path:
```bash
# In .env or shell environment
export VITE_API_URL="https://<your-app-runner-url>.awsapprunner.com"
export VITE_SOCKET_URL="https://<your-app-runner-url>.awsapprunner.com"

npm ci
npm run build
```

#### Step 3: Deploy Assets Using the Automated Script
Execute the provided S3 deployment script:
```bash
export S3_BUCKET="uniportal-production-frontend-12345"
export CLOUDFRONT_DISTRIBUTION_ID="E12345EXAMPLE" # Optional for cache invalidation
./scripts/deploy_s3_cloudfront.sh
```

#### Step 4: Configure CloudFront Distribution
1. In [CloudFront Console](https://console.aws.amazon.com/cloudfront), create a distribution:
   - **Origin domain:** Select your S3 bucket.
   - **Origin access:** Select **Origin access control settings (recommended)** and create an OAC.
   - **Viewer protocol policy:** **Redirect HTTP to HTTPS**.
   - **Allowed HTTP methods:** `GET, HEAD, OPTIONS`.
   - **Default root object:** `index.html`.
2. Add a second Origin for Backend API:
   - **Origin domain:** Your App Runner or ALB domain (e.g., `<id>.us-east-1.awsapprunner.com`).
   - **Protocol:** HTTPS only.
3. Add Cache Behavior for API routing:
   - **Path pattern:** `/api/*`
   - **Target origin:** Backend API Origin.
   - **Viewer protocol policy:** Redirect HTTP to HTTPS.
   - **Allowed HTTP methods:** `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`.
   - **Cache policy:** `CachingDisabled`.
   - **Origin request policy:** `AllViewerExceptHostHeader`.
4. Configure **Custom Error Responses** for Single-Page Application (SPA) routing:
   - Error code: `403` -> Response page path: `/index.html` -> HTTP response code: `200`.
   - Error code: `404` -> Response page path: `/index.html` -> HTTP response code: `200`.
5. Update S3 Bucket Policy (CloudFront provides the policy statement to allow `s3:GetObject` from the distribution's ARN).

---

## 🔄 Automated CI/CD with GitHub Actions

A ready-to-use continuous deployment workflow is provided in `.github/workflows/deploy-aws.yml`.

To enable automated deployments on `git push main`:
1. Add the following secrets in GitHub Repository **Settings** -> **Secrets and variables** -> **Actions**:
   - `AWS_ACCESS_KEY_ID`: IAM user access key with S3, CloudFront, ECR, and App Runner permissions.
   - `AWS_SECRET_ACCESS_KEY`: IAM user secret key.
   - `AWS_REGION`: e.g. `us-east-1`.
   - `AWS_S3_BUCKET`: Your S3 bucket name.
   - `AWS_CLOUDFRONT_DISTRIBUTION_ID`: Your CloudFront distribution ID.
   - `AWS_APPRUNNER_SERVICE_ARN`: Your App Runner service ARN.

---

## 🐘 Database Migration from SQLite to Amazon RDS

To migrate your local `uniportal.sqlite` data to Amazon RDS PostgreSQL:

```bash
npm run migrate:pg -- --target-db-url="postgres://<user>:<password>@<rds-endpoint>:5432/uniportal"
```

The migration script:
1. Validates connection and schema compatibility.
2. Synchronizes all tables (`Users`, `Payments`, `FeeInvoices`, `Receipts`, `AcademicResults`, `BankStatements`, etc.).
3. Copies all existing SQLite records and converts data types cleanly.
4. Outputs verification confirmation.

---

## 🩺 Verifying Health & Operational Status

Test the deployed backend directly:
```bash
curl -I https://<your-app-runner-url>/api/health
```

Expected JSON response:
```json
{
  "status": "healthy",
  "service": "uniportal-node-server",
  "database": "connected",
  "timestamp": "2026-03-31T00:00:00.000Z",
  "uptimeSeconds": 124.5
}
```
