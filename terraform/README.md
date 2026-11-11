# ClearMyDay Cloud Migration - Terraform Deployment

This directory contains Terraform configurations for deploying ClearMyDay to GCP or Azure.

## Cost Comparison

| Provider | Compute | Database | Monthly Cost |
| -------- | ------- | -------- | ------------ |
| **GCP** | Cloud Run (serverless) | Cloud SQL PostgreSQL | **$7-15** |
| **Azure** | Container Apps (serverless) | PostgreSQL Flexible | **$15-25** |
| **Current (Vercel)** | Serverless Functions | Supabase | **$0** (free tier limits) |

## Quick Start

### Option 1: GCP Cloud Run (Recommended)

```bash
cd terraform/gcp

# Copy and edit variables
cp variables.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize and apply
terraform init
terraform plan
terraform apply

# Follow the output instructions to deploy the container
```

### Option 2: Azure Container Apps

```bash
cd terraform/azure

# Copy and edit variables
cp variables.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize and apply
terraform init
terraform plan
terraform apply

# Follow the output instructions to deploy the container
```

## Pre-Migration Checklist

Before migrating:

1. **Test optimizations on Vercel first**
   - The code has been updated with better caching (12h CalDAV cache + 1h ICS output cache)
   - Deploy to Vercel and monitor CPU usage for a few days
   - If usage drops significantly, you may not need to migrate

2. **Export existing data (optional)**

   ```bash
   # Export calendar tokens from Supabase
   psql $SUPABASE_DB_URL -c "COPY calendar_tokens TO STDOUT WITH CSV HEADER" > tokens_backup.csv
   ```

3. **Enable required cloud APIs**
   - GCP: `run.googleapis.com`, `sqladmin.googleapis.com`, `secretmanager.googleapis.com`
   - Azure: `Microsoft.App`, `Microsoft.DBforPostgreSQL`

## Code Changes Required for Migration

The current code uses `@supabase/supabase-js`. For cloud migration, you need to:

1. **Replace Supabase client with direct PostgreSQL**
   - Update `src/lib/supabase.ts` to use `pg` package instead
   - See `docs/cloud-migration-plan.md` step 6 for details

2. **Update environment variables**
   - Remove: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - Add: `DATABASE_URL` (PostgreSQL connection string)

## Architecture After Migration

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Calendar App   │────▶│  Cloud Run /    │────▶│  Cloud SQL /    │
│  (Google/Apple) │     │  Container Apps │     │  PostgreSQL     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ Sorbonne CalDAV │
                        │    (External)   │
                        └─────────────────┘
```

## Hybrid Option: Keep Website on Vercel

You can keep the website on Vercel (free for static) and only migrate the API:

1. **Website** (`/`) → Vercel (static, free)
2. **Calendar API** (`/api/calendar/*`) → Cloud Run/Container Apps

This requires splitting the Next.js app or using rewrites.

## Monitoring After Migration

### GCP

- Cloud Run metrics in Google Cloud Console
- Cloud SQL metrics and logs
- Set up billing alerts

### Azure

- Container Apps metrics in Azure Portal
- PostgreSQL metrics
- Set up cost alerts in Cost Management

## Rollback Plan

If migration fails:

1. Keep Vercel deployment running until migration is verified
2. DNS can be switched back to Vercel instantly
3. Supabase data remains unchanged during migration
