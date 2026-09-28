terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration is supplied at init time by the pipeline:
  #   -backend-config="bucket=$TF_STATE_BUCKET"
  #   -backend-config="key=$PROJECT_NAME/terraform.tfstate"
  #   -backend-config="region=<region>"
  backend "s3" {}
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "udap"
      Purpose   = "devsecops-masterclass"
    }
  }
}
