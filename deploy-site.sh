#!/usr/bin/env bash
# Uploads ./site to the private S3 bucket and clears the CloudFront cache.
#
# Usage:
#   BUCKET=7repworkout-site-123456 DISTRIBUTION_ID=EXXXXXXXXXXXX ./deploy-site.sh
set -euo pipefail

: "${BUCKET:?Set BUCKET to your S3 bucket name}"
: "${DISTRIBUTION_ID:?Set DISTRIBUTION_ID to your CloudFront distribution ID}"

cd "$(dirname "$0")/site"

# CSS, JS, images: cache for an hour
aws s3 sync . "s3://${BUCKET}/" --delete \
  --exclude ".DS_Store" --exclude "*/.DS_Store" \
  --exclude "*.html" \
  --cache-control "public,max-age=3600"

# HTML: always revalidate so visitors get new pages right away
aws s3 sync . "s3://${BUCKET}/" \
  --exclude "*" --include "*.html" \
  --cache-control "no-cache"

aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query "Invalidation.Id" --output text

echo "Deployed to https://7repworkout.com"
