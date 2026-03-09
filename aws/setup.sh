#!/bin/bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="${STACK_NAME:-auditwise-production}"
ENVIRONMENT="${ENVIRONMENT:-production}"
DOMAIN_NAME="${DOMAIN_NAME:-auditwise.tech}"
DB_INSTANCE_CLASS="${DB_INSTANCE_CLASS:-db.t3.medium}"
DB_STORAGE="${DB_STORAGE:-50}"
DB_NAME="${DB_NAME:-auditwise}"
DB_USERNAME="${DB_USERNAME:-auditwise}"
CACHE_NODE_TYPE="${CACHE_NODE_TYPE:-cache.t3.micro}"
BACKEND_CPU="${BACKEND_CPU:-1024}"
BACKEND_MEMORY="${BACKEND_MEMORY:-2048}"
FRONTEND_CPU="${FRONTEND_CPU:-256}"
FRONTEND_MEMORY="${FRONTEND_MEMORY:-512}"
BACKEND_COUNT="${BACKEND_COUNT:-2}"
FRONTEND_COUNT="${FRONTEND_COUNT:-2}"
CERTIFICATE_ARN="${CERTIFICATE_ARN:-}"
ENABLE_ROUTE53="${ENABLE_ROUTE53:-false}"
TEMPLATE_FILE="aws/cloudformation.yml"

echo "============================================"
echo "  AuditWise AWS Infrastructure Setup"
echo "============================================"
echo ""
echo "Stack Name:     $STACK_NAME"
echo "Region:         $AWS_REGION"
echo "Environment:    $ENVIRONMENT"
echo "Domain:         $DOMAIN_NAME"
echo "DB Instance:    $DB_INSTANCE_CLASS"
echo "Cache Node:     $CACHE_NODE_TYPE"
echo ""

if [ -z "$CERTIFICATE_ARN" ]; then
  echo "ERROR: CERTIFICATE_ARN is required for HTTPS."
  echo "Create an ACM certificate first:"
  echo "  aws acm request-certificate --domain-name $DOMAIN_NAME --subject-alternative-names '*.$DOMAIN_NAME' --validation-method DNS --region $AWS_REGION"
  echo ""
  echo "Then export CERTIFICATE_ARN=arn:aws:acm:... and re-run this script."
  exit 1
fi

if ! command -v aws &> /dev/null; then
  echo "ERROR: AWS CLI is not installed. Install it first:"
  echo "  https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi

echo "[1/5] Validating CloudFormation template..."
aws cloudformation validate-template \
  --template-body "file://$TEMPLATE_FILE" \
  --region "$AWS_REGION" > /dev/null
echo "Template is valid."

echo ""
echo "[2/5] Checking if stack already exists..."
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "DOES_NOT_EXIST")

if [ "$STACK_STATUS" = "DOES_NOT_EXIST" ]; then
  echo "Stack does not exist. Creating new stack..."
  ACTION="create"
elif [[ "$STACK_STATUS" == *"COMPLETE"* ]] || [[ "$STACK_STATUS" == *"UPDATE_ROLLBACK_COMPLETE"* ]]; then
  echo "Stack exists (status: $STACK_STATUS). Updating..."
  ACTION="update"
else
  echo "ERROR: Stack is in state '$STACK_STATUS'. Cannot proceed."
  echo "Wait for the current operation to complete or delete the stack."
  exit 1
fi

echo ""
echo "[3/5] Deploying CloudFormation stack..."
PARAMS=(
  "ParameterKey=EnvironmentName,ParameterValue=$ENVIRONMENT"
  "ParameterKey=DomainName,ParameterValue=$DOMAIN_NAME"
  "ParameterKey=DBInstanceClass,ParameterValue=$DB_INSTANCE_CLASS"
  "ParameterKey=DBAllocatedStorage,ParameterValue=$DB_STORAGE"
  "ParameterKey=DBName,ParameterValue=$DB_NAME"
  "ParameterKey=DBMasterUsername,ParameterValue=$DB_USERNAME"
  "ParameterKey=CacheNodeType,ParameterValue=$CACHE_NODE_TYPE"
  "ParameterKey=BackendCpu,ParameterValue=$BACKEND_CPU"
  "ParameterKey=BackendMemory,ParameterValue=$BACKEND_MEMORY"
  "ParameterKey=FrontendCpu,ParameterValue=$FRONTEND_CPU"
  "ParameterKey=FrontendMemory,ParameterValue=$FRONTEND_MEMORY"
  "ParameterKey=BackendDesiredCount,ParameterValue=$BACKEND_COUNT"
  "ParameterKey=FrontendDesiredCount,ParameterValue=$FRONTEND_COUNT"
  "ParameterKey=CertificateArn,ParameterValue=$CERTIFICATE_ARN"
  "ParameterKey=EnableRoute53,ParameterValue=$ENABLE_ROUTE53"
)

if [ "$ACTION" = "create" ]; then
  aws cloudformation create-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$TEMPLATE_FILE" \
    --parameters "${PARAMS[@]}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --tags "Key=Application,Value=AuditWise" "Key=Environment,Value=$ENVIRONMENT" \
    --region "$AWS_REGION" > /dev/null

  echo "Stack creation initiated."
else
  aws cloudformation update-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$TEMPLATE_FILE" \
    --parameters "${PARAMS[@]}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --tags "Key=Application,Value=AuditWise" "Key=Environment,Value=$ENVIRONMENT" \
    --region "$AWS_REGION" > /dev/null 2>&1 || {
      echo "No updates to perform (stack is already up to date)."
      exit 0
    }

  echo "Stack update initiated."
fi

echo ""
echo "[4/5] Waiting for stack operation to complete..."
echo "This may take 15-30 minutes for initial creation."
echo ""

if [ "$ACTION" = "create" ]; then
  aws cloudformation wait stack-create-complete \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION"
else
  aws cloudformation wait stack-update-complete \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION"
fi

echo "Stack operation completed successfully."

echo ""
echo "[5/5] Retrieving stack outputs..."
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table

echo ""
echo "============================================"
echo "  Infrastructure Setup Complete"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Build and push Docker images:"
echo "   ./aws/deploy.sh all"
echo ""
echo "2. Update ECS services with container images:"
echo "   Run deploy.sh again after images are pushed."
echo ""
echo "3. Configure DNS:"
echo "   Point $DOMAIN_NAME to the ALB DNS name shown above."
echo ""
echo "4. Verify SES email:"
echo "   aws ses verify-email-identity --email-address noreply@$DOMAIN_NAME --region $AWS_REGION"
echo ""
echo "5. Monitor the deployment:"
echo "   aws ecs describe-services --cluster $ENVIRONMENT-auditwise --services $ENVIRONMENT-auditwise-backend --region $AWS_REGION"
echo ""
