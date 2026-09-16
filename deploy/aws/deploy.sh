#!/usr/bin/env bash
# Deploy RAG Lab to AWS (S3 + CloudFront). Idempotent: run it again after every change.
#
#   ./deploy/aws/deploy.sh <bucket-name> [aws-region] [stack-name]
#
# Needs the AWS CLI v2, signed in to an account that can create S3 buckets,
# CloudFront distributions, and CloudFormation stacks (an administrator in the
# department's account, or a role with those permissions).
set -euo pipefail

BUCKET="${1:?usage: deploy.sh <bucket-name> [aws-region] [stack-name]}"
REGION="${2:-us-east-1}"
STACK="${3:-rag-lab}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "1/4  Creating or updating the CloudFormation stack '$STACK' in $REGION…"
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file "$ROOT/deploy/aws/template.yaml" \
  --parameter-overrides "BucketName=$BUCKET" \
  --no-fail-on-empty-changeset

DIST_ID="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)"
SITE_URL="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" --output text)"

echo "2/4  Uploading the app folder to s3://$BUCKET (only the files the page needs)…"
aws s3 sync "$ROOT" "s3://$BUCKET" \
  --region "$REGION" \
  --delete \
  --exclude "*" \
  --include "index.html" \
  --include "flow.html" \
  --include "styles.css" \
  --include "flow.css" \
  --include "js/*" \
  --include "data/*" \
  --cache-control "public, max-age=300"

echo "3/4  Making sure every JavaScript module is served as text/javascript (ES modules require it)…"
aws s3 cp "s3://$BUCKET/js" "s3://$BUCKET/js" \
  --region "$REGION" \
  --recursive \
  --exclude "*" --include "*.js" \
  --content-type "text/javascript; charset=utf-8" \
  --cache-control "public, max-age=300" \
  --metadata-directive REPLACE

echo "4/4  Telling CloudFront to fetch the new files…"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

echo
echo "Done. RAG Lab is at: $SITE_URL"
echo "(New uploads take a minute or two to reach every edge location.)"
