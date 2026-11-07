terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# -------------------------------------------------------------
# 🌐 S3 Frontend Bucket & Origin Access Control (OAC)
# -------------------------------------------------------------
resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "uniportal-frontend-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "uniportal-frontend-oac"
  description                       = "OAC for UniPortal S3 static distribution"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# -------------------------------------------------------------
# 🐘 Amazon RDS PostgreSQL
# -------------------------------------------------------------
resource "aws_db_instance" "postgres" {
  identifier          = "uniportal-postgres"
  engine              = "postgres"
  engine_version       = "15"
  instance_class      = var.db_instance_class
  allocated_storage   = 20
  db_name             = "uniportal"
  username            = var.db_username
  password            = var.db_password
  skip_final_snapshot = true
  publicly_accessible = true
  storage_encrypted   = true
}

# -------------------------------------------------------------
# 🚀 AWS App Runner Service (Backend Container)
# -------------------------------------------------------------
resource "aws_apprunner_service" "backend" {
  service_name = "uniportal-backend"

  source_configuration {
    auto_deployments_enabled = false
    image_repository {
      image_identifier      = var.backend_image
      image_repository_type = "ECR_PUBLIC"
      image_configuration {
        port = "5000"
        runtime_environment_variables = {
          NODE_ENV     = "production"
          PORT         = "5000"
          DATABASE_URL = "postgres://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/uniportal"
          JWT_SECRET   = var.jwt_secret
        }
      }
    }
  }

  health_check_configuration {
    protocol = "HTTP"
    path     = "/api/health"
    interval = 10
    timeout  = 5
  }

  instance_configuration {
    cpu    = "1024"
    memory = "2048"
  }
}

# -------------------------------------------------------------
# ⚡ CloudFront Distribution (S3 Static Frontend + App Runner API)
# -------------------------------------------------------------
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3Frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  origin {
    domain_name = aws_apprunner_service.backend.service_url
    origin_id   = "AppRunnerApi"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "S3Frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  # Route API requests to backend
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "AppRunnerApi"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Accept", "X-Tenant-Id"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # SPA Routing Fallback
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAC"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          ArnEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn
          }
        }
      }
    ]
  })
}
