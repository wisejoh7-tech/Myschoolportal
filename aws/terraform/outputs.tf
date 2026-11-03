output "s3_bucket_name" {
  value = aws_s3_bucket.frontend.id
}

output "cloudfront_domain_name" {
  value = "https://${aws_cloudfront_distribution.cdn.domain_name}"
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.cdn.id
}

output "app_runner_url" {
  value = "https://${aws_apprunner_service.backend.service_url}"
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}
