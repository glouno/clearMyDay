# ClearMyDay - GCP Cloud Run + Cloud SQL Terraform Configuration
# Estimated cost: $0-15/month depending on usage
# 
# Prerequisites:
# 1. GCP Project with billing enabled
# 2. gcloud CLI authenticated
# 3. Enable APIs: run.googleapis.com, sqladmin.googleapis.com, secretmanager.googleapis.com

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "europe-west1"  # Low latency for EU users
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Custom domain for the service (optional)"
  type        = string
  default     = ""
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "sql" {
  service            = "sqladmin.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# ============================================================
# Cloud SQL PostgreSQL Instance (smallest tier for cost)
# ============================================================
resource "google_sql_database_instance" "main" {
  name             = "clearmyday-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = "db-f1-micro"  # Smallest tier ~$7-10/month
    availability_type = "ZONAL"        # Single zone (cheaper)
    disk_size         = 10             # 10GB minimum
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled = true
      # For production, use private IP with Cloud Run VPC connector
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"  # Allow all (use Cloud SQL Auth Proxy in production)
      }
    }

    backup_configuration {
      enabled = false  # Disable for cost savings (enable for production)
    }
  }

  deletion_protection = false  # Set to true for production

  depends_on = [google_project_service.sql]
}

resource "google_sql_database" "main" {
  name     = "clearmyday"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "main" {
  name     = "clearmyday"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}

# ============================================================
# Secret Manager for sensitive configuration
# ============================================================
resource "google_secret_manager_secret" "db_url" {
  secret_id = "clearmyday-database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "db_url" {
  secret      = google_secret_manager_secret.db_url.id
  secret_data = "postgresql://${google_sql_user.main.name}:${var.db_password}@${google_sql_database_instance.main.public_ip_address}:5432/${google_sql_database.main.name}"
}

# ============================================================
# Cloud Run Service
# ============================================================
resource "google_cloud_run_v2_service" "main" {
  name     = "clearmyday"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "gcr.io/${var.project_id}/clearmyday:latest"

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      # Resource limits for cost control
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true   # Scale to zero when idle
        startup_cpu_boost = true   # Fast cold starts
      }
    }

    scaling {
      min_instance_count = 0   # Scale to zero (key for cost savings)
      max_instance_count = 2   # Limit max instances
    }

    # Timeout for slow Sorbonne CalDAV responses
    timeout = "60s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_secret_manager_secret_version.db_url
  ]
}

# Allow unauthenticated access (public API)
resource "google_cloud_run_v2_service_iam_member" "public" {
  location = google_cloud_run_v2_service.main.location
  name     = google_cloud_run_v2_service.main.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Grant Cloud Run access to secrets
resource "google_secret_manager_secret_iam_member" "cloud_run" {
  secret_id = google_secret_manager_secret.db_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_cloud_run_v2_service.main.template[0].service_account}"
}

# ============================================================
# Outputs
# ============================================================
output "cloud_run_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.main.uri
}

output "database_instance" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "database_ip" {
  description = "Cloud SQL public IP"
  value       = google_sql_database_instance.main.public_ip_address
}

output "next_steps" {
  description = "Next steps after terraform apply"
  value       = <<-EOT
    
    ✅ Infrastructure created!
    
    Next steps:
    1. Build and push Docker image:
       docker build -t gcr.io/${var.project_id}/clearmyday:latest ./clear-my-day
       docker push gcr.io/${var.project_id}/clearmyday:latest
    
    2. Run database migrations:
       psql postgresql://clearmyday:PASSWORD@${google_sql_database_instance.main.public_ip_address}:5432/clearmyday < clear-my-day/supabase-calendar-tokens-schema.sql
       psql postgresql://clearmyday:PASSWORD@${google_sql_database_instance.main.public_ip_address}:5432/clearmyday < clear-my-day/supabase-caldav-cache-schema.sql
       psql postgresql://clearmyday:PASSWORD@${google_sql_database_instance.main.public_ip_address}:5432/clearmyday < clear-my-day/supabase-ics-output-cache-schema.sql
    
    3. Update DNS to point to: ${google_cloud_run_v2_service.main.uri}
    
    4. Test the deployment:
       curl ${google_cloud_run_v2_service.main.uri}/api/health
    
  EOT
}
