#!/bin/bash
set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null)}"
ECR_REPO="auditwise"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CLUSTER_NAME="${CLUSTER_NAME:-auditwise-cluster}"
SERVICE_NAME="${SERVICE_NAME:-auditwise-service}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "ERROR: Could not determine AWS Account ID."
  echo "Run 'aws configure' or set AWS_ACCOUNT_ID environment variable."
  exit 1
fi

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "=== AuditWise AWS Deployment ==="
echo "Region:  $AWS_REGION"
echo "Account: $AWS_ACCOUNT_ID"
echo "Image:   $ECR_REPO:$IMAGE_TAG"
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo ""

echo "[1/6] Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_URI"

echo "[2/6] Creating ECR repository (if not exists)..."
aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true

echo "[3/6] Building Docker image..."
docker build --platform linux/amd64 -t "$ECR_REPO:$IMAGE_TAG" .

echo "[4/6] Pushing to ECR..."
docker tag "$ECR_REPO:$IMAGE_TAG" "$ECR_URI/$ECR_REPO:$IMAGE_TAG"
docker push "$ECR_URI/$ECR_REPO:$IMAGE_TAG"

echo "[5/6] Registering task definition..."
TASK_DEF_FILE="aws/task-definition.json"
if [ -f "$TASK_DEF_FILE" ]; then
  RENDERED=$(sed \
    -e "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" \
    -e "s/YOUR_REGION/$AWS_REGION/g" \
    "$TASK_DEF_FILE")
  echo "$RENDERED" | aws ecs register-task-definition \
    --cli-input-json file:///dev/stdin \
    --region "$AWS_REGION" > /dev/null
  echo "Task definition registered."
else
  echo "WARNING: $TASK_DEF_FILE not found, skipping task definition update."
fi

echo "[6/6] Updating ECS service..."
aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --force-new-deployment \
  --region "$AWS_REGION" > /dev/null

echo ""
echo "=== Deployment triggered successfully ==="
echo ""
echo "Monitor deployment:"
echo "  aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query 'services[0].deployments' --region $AWS_REGION"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/auditwise --follow --region $AWS_REGION"
