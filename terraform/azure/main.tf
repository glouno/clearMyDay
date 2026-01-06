# ClearMyDay - Azure Container Apps + PostgreSQL Terraform Configuration
# Estimated cost: $15-25/month (PostgreSQL has no free tier)
#
# Prerequisites:
# 1. Azure subscription with billing
# 2. az CLI authenticated
# 3. Resource providers registered: Microsoft.App, Microsoft.DBforPostgreSQL

terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Variables
variable "location" {
  description = "Azure region"
  type        = string
  default     = "westeurope"  # Low latency for EU users
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
}

# Provider configuration
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# ============================================================
# Resource Group
# ============================================================
resource "azurerm_resource_group" "main" {
  name     = "rg-clearmyday-prod"
  location = var.location
}

# ============================================================
# PostgreSQL Flexible Server (cheapest managed option)
# ============================================================
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "clearmyday-db"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "15"
  administrator_login    = "clearmyday"
  administrator_password = var.db_password

  # Burstable B1ms is the cheapest tier (~$13/month)
  sku_name   = "B_Standard_B1ms"
  storage_mb = 32768  # 32GB minimum

  # Public access for simplicity (use private endpoints in production)
  public_network_access_enabled = true

  # Disable high availability for cost savings
  zone = "1"
}

# Firewall rule to allow Azure services
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Firewall rule to allow all (for development - restrict in production)
resource "azurerm_postgresql_flexible_server_firewall_rule" "all" {
  name             = "AllowAll"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "255.255.255.255"
}

# Database
resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "clearmyday"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# ============================================================
# Container Apps Environment
# ============================================================
resource "azurerm_log_analytics_workspace" "main" {
  name                = "clearmyday-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "main" {
  name                       = "clearmyday-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
}

# ============================================================
# Container App (serverless containers - scales to zero)
# ============================================================
resource "azurerm_container_app" "main" {
  name                         = "clearmyday"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"

  template {
    container {
      name   = "clearmyday"
      image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"  # Replace with your image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
    }

    min_replicas = 0  # Scale to zero when idle
    max_replicas = 2  # Limit for cost control
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  secret {
    name  = "database-url"
    value = "postgresql://${azurerm_postgresql_flexible_server.main.administrator_login}:${var.db_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.main.name}?sslmode=require"
  }
}

# ============================================================
# Outputs
# ============================================================
output "container_app_url" {
  description = "Container App URL"
  value       = "https://${azurerm_container_app.main.ingress[0].fqdn}"
}

output "database_host" {
  description = "PostgreSQL server hostname"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "resource_group" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

output "next_steps" {
  description = "Next steps after terraform apply"
  value       = <<-EOT
    
    ✅ Infrastructure created!
    
    Next steps:
    1. Build and push Docker image to Azure Container Registry:
       az acr create --name clearmydayacr --resource-group ${azurerm_resource_group.main.name} --sku Basic
       az acr build --registry clearmydayacr --image clearmyday:latest ./clear-my-day
    
    2. Update Container App to use your image:
       az containerapp update --name clearmyday --resource-group ${azurerm_resource_group.main.name} \
         --image clearmydayacr.azurecr.io/clearmyday:latest
    
    3. Run database migrations:
       psql "postgresql://clearmyday:PASSWORD@${azurerm_postgresql_flexible_server.main.fqdn}:5432/clearmyday?sslmode=require" < clear-my-day/supabase-calendar-tokens-schema.sql
       psql "postgresql://clearmyday:PASSWORD@${azurerm_postgresql_flexible_server.main.fqdn}:5432/clearmyday?sslmode=require" < clear-my-day/supabase-caldav-cache-schema.sql
       psql "postgresql://clearmyday:PASSWORD@${azurerm_postgresql_flexible_server.main.fqdn}:5432/clearmyday?sslmode=require" < clear-my-day/supabase-ics-output-cache-schema.sql
    
    4. Test the deployment:
       curl https://${azurerm_container_app.main.ingress[0].fqdn}/api/health
    
  EOT
}
