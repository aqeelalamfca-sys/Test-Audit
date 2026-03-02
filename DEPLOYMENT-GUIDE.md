# AuditWise — AWS Deployment Guide

Deploy AuditWise to production on AWS. The app runs on port 5000, builds to `dist/index.cjs`, and automatically creates your admin account on first start.

---

## How It Works

```
Your Domain → Route 53 (DNS) → Load Balancer (HTTPS :443)
                                       ↓
                               AuditWise App (:5000)
                                       ↓
                               PostgreSQL Database (:5432)
                                       ↓
                             Secrets Manager (passwords & keys)
```

Users visit your domain. AWS handles SSL, load balancing, and routing. AuditWise runs in a container that connects to a managed PostgreSQL database.

---

## Monthly Cost

| Service | What It Does | Cost |
|---------|-------------|------|
| ECS Fargate | Runs the AuditWise app | ~$40-60/mo (1 vCPU, 4GB) |
| RDS PostgreSQL | Stores all audit data | ~$15-30/mo (db.t3.micro) |
| ALB | Load balancer with HTTPS | ~$20/mo |
| Extras | Logs, DNS, image storage | ~$5-10/mo |
| **Total** | | **~$70-110/mo** |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Docker Desktop installed
- A registered domain (optional but recommended for SSL)

---

## Step 1: Create PostgreSQL Database (RDS)

1. Go to **AWS Console → RDS → Create database**
2. Settings:
   - Engine: **PostgreSQL 15+**
   - Template: **Free tier** (or Production for live use)
   - Instance: **db.t3.micro** (minimum) or **db.t3.small** (recommended)
   - Storage: **20 GB** (General Purpose SSD)
   - DB name: `auditwise`
   - Master username: `auditwise_admin`
   - Master password: (choose a strong password)
3. Connectivity:
   - VPC: Default VPC
   - Public access: **No** (only accessible from within VPC)
   - Security group: Create new, allow port **5432** from ECS security group
4. After creation, note the **Endpoint URL** (e.g., `auditwise-db.xxxx.us-east-1.rds.amazonaws.com`)
5. Your `DATABASE_URL` will be:
   ```
   postgresql://auditwise_admin:YOUR_PASSWORD@YOUR_ENDPOINT:5432/auditwise?schema=public
   ```

---

## Step 2: Store Secrets in AWS Secrets Manager

Create secrets for sensitive configuration:

```bash
# Database connection string
aws secretsmanager create-secret \
  --name auditwise/database-url \
  --secret-string "postgresql://auditwise_admin:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/auditwise?schema=public"

# Session encryption key (generate a random 64-char string)
aws secretsmanager create-secret \
  --name auditwise/session-secret \
  --secret-string "$(openssl rand -hex 32)"

# Initial admin password
aws secretsmanager create-secret \
  --name auditwise/admin-password \
  --secret-string "YourSecureAdminPassword123!"
```

---

## Step 3: Configure Environment Variables

Edit `aws/task-definition.json` and replace placeholders:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (from Secrets Manager) |
| `SESSION_SECRET` | Yes | Random string for session encryption (from Secrets Manager) |
| `ADMIN_EMAIL` | Yes | Email for the initial admin account (e.g., `admin@yourfirm.com`) |
| `ADMIN_PASSWORD` | Yes | Password for the initial admin account (from Secrets Manager) |
| `FIRM_NAME` | Yes | Your audit firm's name (e.g., `Smith & Associates`) |
| `CORS_ORIGINS` | Recommended | Comma-separated allowed origins (e.g., `https://yourdomain.com`) |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features (can also be set in Settings after login) |
| `NODE_HEAP_SIZE` | No | Node.js max heap in MB (default: `2560`, fits in 4GB container) |
| `NODE_ENV` | Auto | Set to `production` automatically |
| `PORT` | Auto | Set to `5000` automatically |

Replace in `aws/task-definition.json`:
- `YOUR_ACCOUNT_ID` → Your 12-digit AWS account ID
- `YOUR_REGION` → Your AWS region (e.g., `us-east-1`)

---

## Step 4: Build and Push Docker Image

```bash
# Set your AWS region and account
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Run the deployment script
chmod +x aws/deploy.sh
./aws/deploy.sh
```

Or manually:

```bash
# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create repository
aws ecr create-repository --repository-name auditwise --region $AWS_REGION 2>/dev/null || true

# Build and push
docker build --platform linux/amd64 -t auditwise .
docker tag auditwise:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/auditwise:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/auditwise:latest
```

---

## Step 5: Create ECS Cluster and Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name auditwise-cluster --region $AWS_REGION

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://aws/task-definition.json \
  --region $AWS_REGION

# Create service
aws ecs create-service \
  --cluster auditwise-cluster \
  --service-name auditwise-service \
  --task-definition auditwise \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[YOUR_SUBNET_ID],securityGroups=[YOUR_SG_ID],assignPublicIp=ENABLED}" \
  --region $AWS_REGION
```

---

## Step 6: Set Up Load Balancer (Optional but Recommended)

1. Go to **EC2 → Load Balancers → Create**
2. Type: **Application Load Balancer**
3. Listeners: HTTPS (443) with your SSL certificate from ACM
4. Target group: Port 5000, health check path `/health`
5. Register ECS service as target

---

## Step 7: First Login

After deployment (wait 2-3 minutes for the container to start):

1. Open your domain or Load Balancer URL
2. Login with your admin credentials:
   - **Email**: The `ADMIN_EMAIL` you configured
   - **Password**: The `ADMIN_PASSWORD` you configured
3. **First steps after login:**
   - Go to **Settings → AI Configuration** to enter your OpenAI API key (if not set via env var)
   - Go to **User Management** to create additional users (Partner, Manager, Staff, etc.)
   - Go to **Engagements** to create your first audit engagement

---

## What Happens on First Start

When the container starts for the first time:

1. **Database schema** is automatically created via Prisma (`prisma db push`)
2. **Permissions** are seeded (61 RBAC permissions for all roles)
3. **Initial admin account** is created using your `ADMIN_EMAIL` and `ADMIN_PASSWORD`
4. **No demo data** is created in production — you start with a clean slate

---

## Updating the Application

To deploy a new version:

```bash
./aws/deploy.sh
```

This builds a new Docker image, pushes it to ECR, and triggers a rolling deployment. Your data is preserved in RDS.

---

## Troubleshooting

### Check Container Logs
```bash
aws logs get-log-events \
  --log-group-name /ecs/auditwise \
  --log-stream-name "ecs/auditwise/TASK_ID" \
  --region $AWS_REGION
```

### Container Won't Start
- Verify `DATABASE_URL` is correct and accessible from the VPC
- Check that the RDS security group allows port 5432 from the ECS security group
- Ensure Secrets Manager secrets exist and IAM roles have access

### Database Connection Issues
- RDS must be in the same VPC as ECS
- Security group must allow inbound on port 5432
- Check the DATABASE_URL format: `postgresql://user:pass@host:5432/dbname?schema=public`

### AI Features Not Working
- Set `OPENAI_API_KEY` in environment or configure in Settings → AI Configuration
- Test the connection from Settings → AI Configuration → Test Connection
- Check that AI is enabled (master toggle in Settings)

---

## Security Checklist

- [ ] RDS is not publicly accessible
- [ ] Strong passwords for database and admin account
- [ ] SESSION_SECRET is a random 64-character string
- [ ] HTTPS is enabled via ALB + ACM certificate
- [ ] Security groups restrict access appropriately
- [ ] API keys are stored in Secrets Manager (not in code)
- [ ] `CORS_ORIGINS` is set to your domain (restricts cross-origin requests)
- [ ] Container runs as non-root user (configured in Dockerfile)
- [ ] Regular RDS backups are enabled (automated by default)
