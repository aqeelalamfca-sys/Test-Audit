#!/bin/bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")}"
ENVIRONMENT="${ENVIRONMENT:-production}"
ECR_BACKEND_REPO="${ECR_BACKEND_REPO:-${ENVIRONMENT}-auditwise-backend}"
ECR_FRONTEND_REPO="${ECR_FRONTEND_REPO:-${ENVIRONMENT}-auditwise-frontend}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}"
CLUSTER_NAME="${CLUSTER_NAME:-${ENVIRONMENT}-auditwise-cluster}"
BACKEND_SERVICE="${BACKEND_SERVICE:-${ENVIRONMENT}-auditwise-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-${ENVIRONMENT}-auditwise-frontend}"
DEPLOY_TARGET="${1:-all}"
WAIT_FOR_STABLE="${WAIT_FOR_STABLE:-false}"

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "ERROR: Could not determine AWS Account ID."
  echo "Run 'aws configure' or set AWS_ACCOUNT_ID environment variable."
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed or not in PATH."
  exit 1
fi

if ! command -v aws &> /dev/null; then
  echo "ERROR: AWS CLI is not installed or not in PATH."
  exit 1
fi

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "============================================"
echo "  AuditWise AWS Deployment"
echo "============================================"
echo ""
echo "Region:   $AWS_REGION"
echo "Account:  $AWS_ACCOUNT_ID"
echo "Tag:      $IMAGE_TAG"
echo "Cluster:  $CLUSTER_NAME"
echo "Target:   $DEPLOY_TARGET"
echo "Wait:     $WAIT_FOR_STABLE"
echo ""

echo "[1/8] Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_URI"

echo "[2/8] Ensuring ECR repositories exist..."
for REPO in "$ECR_BACKEND_REPO" "$ECR_FRONTEND_REPO"; do
  aws ecr describe-repositories --repository-names "$REPO" --region "$AWS_REGION" 2>/dev/null || \
    aws ecr create-repository --repository-name "$REPO" --region "$AWS_REGION" \
      --image-scanning-configuration scanOnPush=true
done

if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "backend" ]; then
  echo "[3/8] Building backend Docker image..."
  docker build --platform linux/amd64 -f docker/backend.Dockerfile -t "$ECR_BACKEND_REPO:$IMAGE_TAG" .

  echo "[4/8] Pushing backend to ECR..."
  docker tag "$ECR_BACKEND_REPO:$IMAGE_TAG" "$ECR_URI/$ECR_BACKEND_REPO:$IMAGE_TAG"
  docker tag "$ECR_BACKEND_REPO:$IMAGE_TAG" "$ECR_URI/$ECR_BACKEND_REPO:latest"
  docker push "$ECR_URI/$ECR_BACKEND_REPO:$IMAGE_TAG"
  docker push "$ECR_URI/$ECR_BACKEND_REPO:latest"

  echo "[5/8] Registering backend task definition..."
  TASK_DEF_FILE="aws/ecs-task-definition.json"
  if [ -f "$TASK_DEF_FILE" ]; then
    RENDERED=$(sed \
      -e "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" \
      -e "s/YOUR_REGION/$AWS_REGION/g" \
      "$TASK_DEF_FILE")
    echo "$RENDERED" | aws ecs register-task-definition \
      --cli-input-json file:///dev/stdin \
      --region "$AWS_REGION" > /dev/null
    echo "Backend task definition registered."
  fi
else
  echo "[3-5/8] Skipping backend build (target=$DEPLOY_TARGET)"
fi

if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "frontend" ]; then
  echo "[6/8] Building frontend Docker image..."
  docker build --platform linux/amd64 -f docker/frontend.Dockerfile -t "$ECR_FRONTEND_REPO:$IMAGE_TAG" .

  echo "[7/8] Pushing frontend to ECR..."
  docker tag "$ECR_FRONTEND_REPO:$IMAGE_TAG" "$ECR_URI/$ECR_FRONTEND_REPO:$IMAGE_TAG"
  docker tag "$ECR_FRONTEND_REPO:$IMAGE_TAG" "$ECR_URI/$ECR_FRONTEND_REPO:latest"
  docker push "$ECR_URI/$ECR_FRONTEND_REPO:$IMAGE_TAG"
  docker push "$ECR_URI/$ECR_FRONTEND_REPO:latest"

  echo "[7b/8] Registering frontend task definition..."
  FRONTEND_TASK_DEF="aws/ecs-task-definition-frontend.json"
  if [ -f "$FRONTEND_TASK_DEF" ]; then
    RENDERED=$(sed \
      -e "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" \
      -e "s/YOUR_REGION/$AWS_REGION/g" \
      "$FRONTEND_TASK_DEF")
    echo "$RENDERED" | aws ecs register-task-definition \
      --cli-input-json file:///dev/stdin \
      --region "$AWS_REGION" > /dev/null
    echo "Frontend task definition registered."
  fi
else
  echo "[6-7/8] Skipping frontend build (target=$DEPLOY_TARGET)"
fi

echo "[8/8] Updating ECS services..."
if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "backend" ]; then
  aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$BACKEND_SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null
  echo "Backend service deployment triggered."
fi

if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "frontend" ]; then
  aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$FRONTEND_SERVICE" \
    --force-new-deployment \
    --region "$AWS_REGION" > /dev/null
  echo "Frontend service deployment triggered."
fi

if [ "$WAIT_FOR_STABLE" = "true" ]; then
  echo ""
  echo "Waiting for services to stabilize..."

  if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "backend" ]; then
    echo "Waiting for backend service..."
    aws ecs wait services-stable \
      --cluster "$CLUSTER_NAME" \
      --services "$BACKEND_SERVICE" \
      --region "$AWS_REGION"
    echo "Backend service is stable."
  fi

  if [ "$DEPLOY_TARGET" = "all" ] || [ "$DEPLOY_TARGET" = "frontend" ]; then
    echo "Waiting for frontend service..."
    aws ecs wait services-stable \
      --cluster "$CLUSTER_NAME" \
      --services "$FRONTEND_SERVICE" \
      --region "$AWS_REGION"
    echo "Frontend service is stable."
  fi
fi

echo ""
echo "============================================"
echo "  Deployment Complete"
echo "============================================"
echo ""
echo "Usage:"
echo "  ./aws/deploy.sh [all|backend|frontend]"
echo ""
echo "Options (via env vars):"
echo "  IMAGE_TAG=v1.2.3 ./aws/deploy.sh           # Tag with version"
echo "  WAIT_FOR_STABLE=true ./aws/deploy.sh        # Wait for ECS stability"
echo "  DEPLOY_TARGET=backend ./aws/deploy.sh       # Deploy backend only"
echo ""
echo "Monitor deployments:"
echo "  aws ecs describe-services --cluster $CLUSTER_NAME --services $BACKEND_SERVICE --query 'services[0].deployments' --region $AWS_REGION"
echo "  aws ecs describe-services --cluster $CLUSTER_NAME --services $FRONTEND_SERVICE --query 'services[0].deployments' --region $AWS_REGION"
echo ""
echo "View logs:"
echo "  aws logs tail /ecs/auditwise-backend --follow --region $AWS_REGION"
echo "  aws logs tail /ecs/auditwise-frontend --follow --region $AWS_REGION"
echo ""
echo "Rollback (use previous task definition revision):"
echo "  aws ecs update-service --cluster $CLUSTER_NAME --service $BACKEND_SERVICE --task-definition auditwise-backend:PREVIOUS_REVISION --region $AWS_REGION"
