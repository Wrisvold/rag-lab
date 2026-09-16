# Deploy RAG Lab to AWS (S3 + CloudFront) from Windows PowerShell. Idempotent.
#
#   .\deploy\aws\deploy.ps1 -BucketName gcsu-cbis5530-rag-lab [-Region us-east-1] [-StackName rag-lab]
#
# Needs the AWS CLI v2, signed in to an account that can create S3 buckets,
# CloudFront distributions, and CloudFormation stacks.
param(
  [Parameter(Mandatory = $true)] [string] $BucketName,
  [string] $Region = "us-east-1",
  [string] $StackName = "rag-lab"
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")

Write-Host "1/4  Creating or updating the CloudFormation stack '$StackName' in $Region..."
aws cloudformation deploy --region $Region --stack-name $StackName `
  --template-file (Join-Path $Root "deploy\aws\template.yaml") `
  --parameter-overrides "BucketName=$BucketName" --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) { throw "CloudFormation deploy failed" }

$DistId = aws cloudformation describe-stacks --region $Region --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text
$SiteUrl = aws cloudformation describe-stacks --region $Region --stack-name $StackName `
  --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" --output text

Write-Host "2/4  Uploading the app folder to s3://$BucketName..."
aws s3 sync "$Root" "s3://$BucketName" --region $Region --delete `
  --exclude "*" --include "index.html" --include "flow.html" --include "styles.css" --include "flow.css" --include "js/*" --include "data/*" `
  --cache-control "public, max-age=300"
if ($LASTEXITCODE -ne 0) { throw "S3 sync failed" }

Write-Host "3/4  Setting text/javascript on every module (ES modules require it)..."
aws s3 cp "s3://$BucketName/js" "s3://$BucketName/js" --region $Region --recursive `
  --exclude "*" --include "*.js" --content-type "text/javascript; charset=utf-8" `
  --cache-control "public, max-age=300" --metadata-directive REPLACE
if ($LASTEXITCODE -ne 0) { throw "Content-type fix failed" }

Write-Host "4/4  Invalidating the CloudFront cache..."
aws cloudfront create-invalidation --distribution-id $DistId --paths "/*" | Out-Null

Write-Host ""
Write-Host "Done. RAG Lab is at: $SiteUrl"
Write-Host "(New uploads take a minute or two to reach every edge location.)"
