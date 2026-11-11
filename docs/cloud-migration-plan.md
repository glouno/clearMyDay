# ClearMyDay Cloud Migration Plan (Option 2)

Target: move everything off Vercel+Supabase to a single cloud, default **Azure**, using:

- **Next.js app** on Azure App Service (or containers later).
- **Managed PostgreSQL** (Azure Database for PostgreSQL).
- No Redis initially.

AWS/GCP equivalents are noted per step.

---

## 1. Clarify goals and constraints

- **Goals**
  - Host frontend + API on a cloud provider (Azure default).
  - Replace Supabase Postgres with managed Postgres in that cloud.
  - Keep architecture simple and cheap for low continuous load.
- **Constraints**
  - Prefer startup credits, avoid paid extras (no Redis unless needed).
  - Keep migration reversible / low-risk.
  - No user-visible breakage of subscription URLs if possible.

---

## 2. Inventory current architecture (what to migrate)

- **Compute**
  - Next.js App Router on Vercel.
  - API routes:
    - **`POST /api/generate-calendar`**
    - **`GET /api/calendar/[token]`**
    - **`POST /api/analyze-events`**
- **External dependencies**
  - Supabase Postgres:
    - `calendar_tokens`
    - `caldav_cache`
    - `analyze_events_cache`
  - Sorbonne CalDAV endpoints (external HTTP).
- **Config/secrets**
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - Any Sorbonne URLs and auth (currently constants but should move to env later).

You dont need to change ICS/CalDAV/React logic for the migration.

---

## 3. Choose primary cloud + region

- **Azure**
  - Choose 1 region (e.g. `westeurope`).
- **AWS equivalent**
  - Region (e.g. `eu-west-1`), services: Elastic Beanstalk or ECS + RDS Postgres.
- **GCP equivalent**
  - Region (e.g. `europe-west1`), services: Cloud Run or App Engine + Cloud SQL Postgres.

Decide: **Azure** is the default; others remain backup options.

---

## 4. Provision core infrastructure (Azure-first)

### 4.1 Resource group

- **Azure**
  - Create a Resource Group (e.g. `rg-clearmyday-prod`).

### 4.2 Managed Postgres

- **Azure**
  - Create **Azure Database for PostgreSQL  Flexible Server**:
    - Small dev/test SKU (cheap; covered by credits).
    - Public access initially (IP-restricted); later consider private endpoints.
- **AWS**
  - Amazon RDS for PostgreSQL.
- **GCP**
  - Cloud SQL for PostgreSQL.

### 4.3 Application hosting

- **Azure (recommended first)**: **App Service (Linux, Node)**:
  - App Service Plan: smallest plan adequate for Node (Basic/low Standard).
  - Web App: `clearmyday-app`.
- **Later / alternative**
  - Azure Container Apps with containerized Next.js.
- **AWS alt**
  - Elastic Beanstalk Node app, or ECS Fargate + ALB.
- **GCP alt**
  - Cloud Run (container) or App Engine standard (Node).

---

## 5. Plan database schema & migration off Supabase

### 5.1 Extract schema from Supabase

Tasks:

- Connect to Supabase Postgres using standard Postgres tooling.
- Export schema (DDL) for:
  - `calendar_tokens`
  - `caldav_cache`
  - `analyze_events_cache`
- Inspect column types:
  - Especially `filter`, `events`, `data` JSONB columns.
  - `config_hash`, timestamps, indexes.

(You can either do this manually later or script it with `pg_dump`.)

### 5.2 Create schema in Azure Postgres

Tasks:

- Apply adapted schema to Azure Postgres:
  - Tables, PKs, indexes (especially:
    - `config_hash` index on `calendar_tokens`.
    - `id` PK on cache tables).
- Ensure JSONB support and timestamp types match Node expectations.

### 5.3 Migrate data (optional vs fresh start)

Decide:

- **Minimalist approach (likely fine for you)**:
  - Start with **empty DB** in Azure.
  - New tokens / caches will be generated gradually.
- **If you want to preserve existing tokens**:
  - Use a data migration:
    - Export rows from Supabase.
    - Import into Azure Postgres (via `COPY`, `pg_dump/pg_restore`, or a small script).

---

## 6. Replace Supabase client with direct Postgres access

### 6.1 Choose Node DB library

- Options:
  - **`pg`** (node-postgres)  simplest.
  - Or **Prisma** if you want nicer typed queries (more setup).
- For your small codebase, `pg` is sufficient.

### 6.2 Implement DB client module

- Replace `src/lib/supabase.ts` with something like:
  - A `pg.Pool` created from env var `DATABASE_URL` (Azure Postgres connection string).
- Ensure:
  - Single shared pool (singleton).
  - Graceful error logging.

### 6.3 Update Supabase usages

Refactor code in these places:

- **`src/lib/calendar-storage.ts`**
  - Rewrite:
    - `findExisting`, `findExistingFallback`, `set`, `get`, `list`, `cleanup`
  - Each Supabase `.from(...).select/upsert/delete` becomes SQL with `pg`:
    - Use `config_hash` index.
    - Upsert behavior via `INSERT ... ON CONFLICT`.
- **`src/app/api/calendar/[token]/route.ts`**
  - For `caldav_cache`:
    - Replace Supabase select/upsert with SQL queries against `caldav_cache` table.
- **`src/app/api/analyze-events/route.ts`**
  - For `analyze_events_cache`:
    - Replace per-source cache select/upsert with SQL.

Keep behavior identical:

- Same TTL semantics (`expires_at`).
- Same JSON shape.

---

## 7. Configure app hosting (Azure App Service)

### 7.1 Build & run locally with production settings

Tasks:

- Ensure `npm run build` and `npm run start` work locally using:
  - `NODE_ENV=production`
  - `DATABASE_URL` pointing to Azure Postgres (test instance).
- Verify:
  - `POST /api/generate-calendar`
  - `GET /api/calendar/:token`
  - `POST /api/analyze-events`

### 7.2 Deploy Next.js to Azure App Service

Tasks:

- Set up GitHub Actions or manual deployment:
  - Build: `npm ci && npm run build`.
  - Start: `npm run start` with `PORT` from env.
- In App Service Configuration:
  - Set env vars:
    - `NODE_ENV=production`
    - `DATABASE_URL` (Azure Postgres connection string)
    - Any Sorbonne credentials if you externalize them.
- Test from the public Azure URL (e.g. `https://clearmyday-app.azurewebsites.net`).

---

## 8. DNS & production cutover strategy

### 8.1 Staging environment

- Create a **staging App Service** + **staging DB** (smaller SKU if needed).
- Deploy there first.
- Use staging hostname for manual testing and maybe a couple of real users.

### 8.2 Cutover plan

- Decide on cutover window.
- Steps:
  - Freeze changes to Supabase-backed production (or accept some tokens might be lost).
  - Deploy latest code to Azure production App Service.
  - Update DNS:
    - Point your custom domain from Vercel to Azure App Service.
  - Monitor errors and logs closely.

### 8.3 Rollback plan

- If anything fails badly:
  - Switch DNS back to Vercel.
  - Root cause and fix in Azure env.

---

## 9. Monitoring, logging, and cost control

### 9.1 Monitoring

- **Azure**
  - Enable **Application Insights** for the App Service.
  - Enable query logging / metrics for Azure Postgres.
- Watch:
  - Error rates on API routes.
  - Postgres CPU/storage.
  - Response times, CalDAV fetch errors.

### 9.2 Cost control

- Choose **smallest sensible SKUs** for:
  - App Service Plan.
  - Postgres instance.
- Set:
  - Budgets/alerts in Azure Cost Management.
  - Possibly hard limits (e.g. auto-stop non-critical test resources at night).

---

## 10. Optional: later improvements

These are not needed for initial migration, but good future tasks:

- **Background cleanup**
  - Use Azure Functions (Timer trigger) to call `CalendarStorage.cleanup(...)` periodically.
- **Secrets management**
  - Move DB connection string and Sorbonne credentials into **Azure Key Vault**.
- **Containerization**
  - Add a Dockerfile to containerize Next.js.
  - Optionally move from App Service to Azure Container Apps / Kubernetes / multi-cloud later.
- **Multi-cloud portability**
  - Once containerized and using Postgres as a service:
    - Deploy the same image to:
      - AWS ECS Fargate + RDS Postgres.
      - GCP Cloud Run + Cloud SQL Postgres.

---

## 11. How to use this plan later

When you come back to this:

- **Start at step 4** (provision infra) if youve already chosen the provider.
- Then:
  - 5 (schema), 6 (DB code changes), 7 (hosting), 8 (cutover) in that order.
- We can work through each step together, e.g.:
  - First: design schema for the three tables in Azure Postgres.
  - Next: implement `pg`-based `calendar-storage.ts`, etc.

---

**Summary**

- This file is a concrete, numbered migration plan to move ClearMyDay fully to a cloud (Azure by default) with managed Postgres, replacing Supabase and Vercel while keeping the same app behavior.
- No Redis or extra services are required initially; you can add them later if usage grows.
