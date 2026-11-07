variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for deployment"
}

variable "db_username" {
  type        = string
  default     = "uniadmin"
  description = "PostgreSQL Master Username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "PostgreSQL Master Password"
}

variable "db_instance_class" {
  type        = string
  default     = "db.t4g.micro"
  description = "RDS DB instance class"
}

variable "backend_image" {
  type        = string
  default     = "public.ecr.aws/docker/library/node:20-slim"
  description = "ECR Image URI for backend container"
}

variable "jwt_secret" {
  type        = string
  sensitive   = true
  default     = "uniportal-production-jwt-secret-2026"
  description = "JWT Secret for Authentication"
}
