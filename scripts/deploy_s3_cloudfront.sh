#!/usr/bin/env bash
set -e

# ==============================================================================
# 🚀 UniPortal Frontend Deployment Script (Amazon S3 + CloudFront)
# ==============================================================================
# Usage:
#   export S3_BUCKET="your-frontend-s3-bucket-name"
#   export CLOUDFRONT_DISTRIBUTION_ID="your-cloudfront-dist-id"
#   export VITE_API_URL="https://your-api-endpoint.com"
#   ./scripts/deploy_s3_cloudfront.sh
# ==============================================================================

if [ -z "$S3_BUCKET" ]; then
  echo "❌ Error: S3_BUCKET environment variable is required."
  echo "   Example: export S3_BUCKET=uniportal-production-frontend"
  exit 1
fi

echo "📦 1. Building Vite Frontend Application..."
npm ci
npm run build

echo "☁️  2. Uploading static assets to S3 (s3://${S3_BUCKET})..."
# Sync hashed assets in dist/assets with aggressive cache control (1 year immutable)
if [ -d "dist/assets" ]; then
  aws s3 sync dist/assets "s3://${S3_BUCKET}/assets" \
    --delete \
    --cache-control "public, max-age=31536000, immutable"
fi

# Sync remaining files (index.html, manifest, icons) with no-cache so updates propagate instantly
aws s3 sync dist "s3://${S3_BUCKET}" \
  --delete \
  --exclude "assets/*" \
  --cache-control "public, max-age=0, must-revalidate"

echo "✅ Frontend files successfully synced to S3!"

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo "⚡ 3. Invalidating CloudFront cache (${CLOUDFRONT_DISTRIBUTION_ID})..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)
  echo "🎉 CloudFront cache invalidation initiated: ${INVALIDATION_ID}"
else
  echo "ℹ️  CLOUDFRONT_DISTRIBUTION_ID not set. Skipping cache invalidation."
fi

echo "🚀 Deployment to S3 + CloudFront complete!"
