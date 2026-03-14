import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { logoToBase64 } from "@/lib/pdf-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Server, Database, Shield, Globe, Terminal, DollarSign,
  ChevronDown, ChevronRight, Copy, CheckCircle2, Cloud,
  Lock, AlertTriangle, Layers, ArrowRight, Monitor, Cpu,
  HardDrive, RefreshCw, Info, Rocket, Box, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function CodeBlock({ children, title }: { children: string; title?: string }) {
  const { toast } = useToast();
  const copyToClipboard = () => {
    navigator.clipboard.writeText(children);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="relative group my-2">
      {title && <p className="text-[11px] font-medium text-muted-foreground mb-1">{title}</p>}
      <div className="bg-slate-950 dark:bg-slate-900 rounded-md p-3 overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={copyToClipboard}
          data-testid="btn-copy-code"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{children}</pre>
      </div>
    </div>
  );
}

interface StepSectionProps {
  stepNumber: number;
  title: string;
  icon: typeof Server;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function StepSection({ stepNumber, title, icon: Icon, children, defaultOpen = false }: StepSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full" data-testid={`step-${stepNumber}`}>
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
            {stepNumber}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold flex-1 text-left">{title}</span>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-11 pl-3 border-l-2 border-primary/20 pb-4 space-y-3 text-sm text-muted-foreground">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CommonBuildInfo() {
  return (
    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
      <CardContent className="pt-4">
        <div className="flex items-start gap-2">
          <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">AuditWise Build Info</p>
            <p>Build command: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">npm run build</code> produces <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">dist/index.cjs</code></p>
            <p>Production start: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">node dist/index.cjs</code> on port 5000</p>
            <p>Schema push needs: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">NODE_OPTIONS="--max-old-space-size=4096"</code> (large Prisma schema)</p>
            <p>Health check endpoint: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">GET /health</code></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EnvVarsTable() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Required Environment Variables</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-3 font-semibold">Variable</th>
                <th className="text-left py-2 pr-3 font-semibold">Required</th>
                <th className="text-left py-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="py-1.5 pr-3 font-mono text-foreground">DATABASE_URL</td><td className="pr-3"><Badge variant="destructive" className="text-[10px] h-4">Required</Badge></td><td>PostgreSQL connection string</td></tr>
              <tr className="border-b"><td className="py-1.5 pr-3 font-mono text-foreground">SESSION_SECRET</td><td className="pr-3"><Badge variant="destructive" className="text-[10px] h-4">Required</Badge></td><td>Random 64-char string for session encryption</td></tr>
              <tr className="border-b"><td className="py-1.5 pr-3 font-mono text-foreground">ADMIN_EMAIL</td><td className="pr-3"><Badge variant="destructive" className="text-[10px] h-4">Required</Badge></td><td>Email for the initial admin account</td></tr>
              <tr className="border-b"><td className="py-1.5 pr-3 font-mono text-foreground">ADMIN_PASSWORD</td><td className="pr-3"><Badge variant="destructive" className="text-[10px] h-4">Required</Badge></td><td>Password for the initial admin account</td></tr>
              <tr className="border-b"><td className="py-1.5 pr-3 font-mono text-foreground">FIRM_NAME</td><td className="pr-3"><Badge variant="destructive" className="text-[10px] h-4">Required</Badge></td><td>Your audit firm name</td></tr>
              <tr className="border-b"><td className="py-1.5 pr-3 font-mono text-foreground">NODE_ENV</td><td className="pr-3"><Badge variant="secondary" className="text-[10px] h-4">Auto</Badge></td><td>Set to "production"</td></tr>
              <tr><td className="py-1.5 pr-3 font-mono text-foreground">OPENAI_API_KEY</td><td className="pr-3"><Badge variant="outline" className="text-[10px] h-4">Optional</Badge></td><td>For AI features (can configure in Settings later)</td></tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityChecklist() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Security Checklist</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-1.5">
        {[
          "Database is NOT publicly accessible",
          "All passwords stored securely (not in code)",
          "HTTPS enabled with valid SSL certificate",
          "Firewall rules restrict access to needed ports only",
          "Database backups enabled (7+ day retention)",
          "Session secret is a random 32+ character string",
          "Admin password is strong and unique",
          "Regular security updates applied to OS",
        ].map(item => (
          <p key={item} className="flex items-center gap-2">
            <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
            <span className="text-muted-foreground">{item}</span>
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

function FirstLoginSteps() {
  return (
    <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
      <CardContent className="pt-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
          <div className="text-xs text-green-800 dark:text-green-200">
            <p className="font-medium mb-1">After Deployment — First Login</p>
            <ol className="list-decimal ml-4 space-y-0.5">
              <li>Open your domain or server IP in a browser</li>
              <li>Login with the <strong>ADMIN_EMAIL</strong> and <strong>ADMIN_PASSWORD</strong> you configured</li>
              <li>Go to <strong>Settings → AI Configuration</strong> to set up your OpenAI API key</li>
              <li>Go to <strong>User Management</strong> to create team accounts (Partner, Manager, Staff, etc.)</li>
              <li>Create your first audit engagement from the <strong>Engagements</strong> page</li>
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AWSGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Route 53</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> ALB (HTTPS)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> ECS Fargate (:5000)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> RDS PostgreSQL</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "App Server", cost: "$30-50", desc: "ECS Fargate (1 vCPU, 2GB)" },
                { name: "Database", cost: "$15-30", desc: "RDS PostgreSQL" },
                { name: "Load Balancer", cost: "$20", desc: "ALB with HTTPS" },
                { name: "Extras", cost: "$5-10", desc: "Logs, DNS, Storage" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~$70-110/month</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Prerequisites</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> AWS account</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> AWS CLI configured</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Docker installed</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Domain name (recommended)</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Create RDS PostgreSQL Database" icon={Database} defaultOpen={true}>
          <p>Go to <strong>AWS Console → RDS → Create database</strong>:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Engine: <strong>PostgreSQL 15+</strong></li>
            <li>Instance: <strong>db.t3.micro</strong> (or db.t3.small for production)</li>
            <li>Storage: <strong>20 GB</strong> GP3</li>
            <li>DB name: <code className="text-xs bg-muted px-1 rounded">auditwise</code></li>
            <li>Public access: <strong>No</strong></li>
          </ul>
          <CodeBlock>{`aws rds create-db-instance \\
  --db-instance-identifier auditwise-db \\
  --db-instance-class db.t3.micro \\
  --engine postgres --engine-version 15 \\
  --master-username auditwise \\
  --master-user-password YOUR_STRONG_PASSWORD \\
  --allocated-storage 20 --storage-type gp3 \\
  --db-name auditwise \\
  --no-publicly-accessible \\
  --backup-retention-period 7 \\
  --region us-east-1`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={2} title="Store Secrets in Secrets Manager" icon={Lock}>
          <CodeBlock title="Database URL">{`aws secretsmanager create-secret \\
  --name auditwise/database-url \\
  --secret-string "postgresql://auditwise:YOUR_PASSWORD@YOUR_RDS_ENDPOINT:5432/auditwise"`}</CodeBlock>
          <CodeBlock title="Session secret">{`aws secretsmanager create-secret \\
  --name auditwise/session-secret \\
  --secret-string "$(openssl rand -hex 32)"`}</CodeBlock>
          <CodeBlock title="Admin password">{`aws secretsmanager create-secret \\
  --name auditwise/admin-password \\
  --secret-string "YourSecureAdminPassword123!"`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={3} title="Build & Push Docker Image" icon={Cpu}>
          <CodeBlock>{`# Login to ECR
aws ecr get-login-password --region us-east-1 | \\
  docker login --username AWS --password-stdin \\
  YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Create repository
aws ecr create-repository --repository-name auditwise

# Build and push
docker build --platform linux/amd64 -t auditwise:latest .
docker tag auditwise:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/auditwise:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/auditwise:latest`}</CodeBlock>
          <p className="text-xs">Or use the deployment script: <code className="bg-muted px-1 rounded">./aws/deploy.sh</code></p>
        </StepSection>

        <StepSection stepNumber={4} title="Create ECS Cluster & Service" icon={Server}>
          <CodeBlock>{`# Create cluster
aws ecs create-cluster --cluster-name auditwise-cluster

# Register task definition (edit aws/task-definition.json first)
aws ecs register-task-definition --cli-input-json file://aws/task-definition.json

# Create service
aws ecs create-service \\
  --cluster auditwise-cluster \\
  --service-name auditwise-service \\
  --task-definition auditwise \\
  --desired-count 1 \\
  --launch-type FARGATE \\
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["subnet-XXXXX"],
      "securityGroups": ["sg-ZZZZZ"],
      "assignPublicIp": "ENABLED"
    }
  }'`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={5} title="Configure Load Balancer & HTTPS" icon={Shield}>
          <ul className="list-disc ml-4 space-y-1">
            <li>Create an <strong>Application Load Balancer</strong> (internet-facing)</li>
            <li>Target group: port <strong>5000</strong>, health check <code className="text-xs bg-muted px-1 rounded">/health</code></li>
            <li>Request an SSL certificate from <strong>ACM</strong></li>
            <li>Add HTTPS listener on port 443</li>
            <li>Redirect HTTP to HTTPS</li>
          </ul>
        </StepSection>

        <StepSection stepNumber={6} title="Configure DNS" icon={Globe}>
          <p>Point your domain to the ALB using Route 53 or your DNS provider. Create an A record (alias) pointing to the load balancer.</p>
        </StepSection>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Deploying Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`./aws/deploy.sh`}</CodeBlock>
          <p className="text-xs text-muted-foreground">Rebuilds, pushes to ECR, and triggers a rolling deployment.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function HostingerGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Nginx (HTTPS)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> Node.js App (:5000)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> PostgreSQL</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Hostinger VPS gives you a dedicated server with full root access. AuditWise runs as a Node.js process behind Nginx reverse proxy with SSL.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "VPS (KVM 2)", cost: "$5.99", desc: "2 vCPU, 8GB RAM, 100GB NVMe" },
                { name: "VPS (KVM 4)", cost: "$9.99", desc: "4 vCPU, 16GB RAM, 200GB NVMe" },
                { name: "VPS (KVM 8)", cost: "$19.99", desc: "8 vCPU, 32GB RAM, 400GB NVMe" },
                { name: "Domain", cost: "Free", desc: "Included for 1st year" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Recommended: <span className="font-semibold text-foreground">KVM 2 ($5.99/mo)</span> for small-medium firms. All-in-one pricing.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why Hostinger VPS?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Lowest cost — everything on one server</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Full root access (SSH)</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Free weekly backups</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Free domain + SSL (Let's Encrypt)</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Data centers worldwide</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Purchase & Access VPS" icon={Server} defaultOpen={true}>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Go to <strong>hostinger.com</strong> → <strong>VPS Hosting</strong></li>
            <li>Choose <strong>KVM 2</strong> or higher (minimum 2 vCPU, 8GB RAM recommended)</li>
            <li>Select <strong>Ubuntu 22.04</strong> as the operating system</li>
            <li>Set a strong root password</li>
            <li>Note your server's <strong>IP address</strong> from the Hostinger dashboard</li>
          </ol>
          <CodeBlock title="Connect to your VPS via SSH">{`ssh root@YOUR_SERVER_IP`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={2} title="Install System Dependencies" icon={Terminal}>
          <CodeBlock title="Update system and install essentials">{`apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2

# Install Certbot for free SSL
apt install -y certbot python3-certbot-nginx

# Install Git
apt install -y git

# Verify installations
node --version && npm --version && psql --version && nginx -v`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={3} title="Set Up PostgreSQL Database" icon={Database}>
          <CodeBlock title="Create database and user">{`sudo -u postgres psql

-- Inside PostgreSQL shell:
CREATE USER auditwise WITH PASSWORD 'YOUR_STRONG_DB_PASSWORD';
CREATE DATABASE auditwise OWNER auditwise;
GRANT ALL PRIVILEGES ON DATABASE auditwise TO auditwise;
\\q`}</CodeBlock>
          <CodeBlock title="Test the connection">{`psql -U auditwise -d auditwise -h localhost
# Enter your password when prompted. Type \\q to exit.`}</CodeBlock>
          <p className="text-xs">Your DATABASE_URL will be: <code className="bg-muted px-1 rounded">postgresql://auditwise:YOUR_STRONG_DB_PASSWORD@localhost:5432/auditwise</code></p>
        </StepSection>

        <StepSection stepNumber={4} title="Deploy AuditWise Application" icon={Cpu}>
          <CodeBlock title="Clone and build the application">{`# Create app directory
mkdir -p /opt/auditwise && cd /opt/auditwise

# Clone your repository (or upload files via SCP/SFTP)
git clone YOUR_REPOSITORY_URL .

# Install dependencies
npm ci

# Set up environment variables
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://auditwise:YOUR_STRONG_DB_PASSWORD@localhost:5432/auditwise
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@yourfirm.com
ADMIN_PASSWORD=YourSecurePassword123!
FIRM_NAME=Your Audit Firm Name
# OPENAI_API_KEY=sk-... (optional, can configure in Settings)
EOF

# Generate Prisma client and push schema
NODE_OPTIONS="--max-old-space-size=4096" npx prisma generate
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push

# Build the application
NODE_OPTIONS="--max-old-space-size=4096" npm run build`}</CodeBlock>
          <CodeBlock title="Start with PM2 process manager">{`# Start the application
pm2 start dist/index.cjs --name auditwise \\
  --node-args="--max-old-space-size=4096"

# Save PM2 configuration (auto-restart on reboot)
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs auditwise`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={5} title="Configure Nginx Reverse Proxy" icon={Shield}>
          <CodeBlock title="Create Nginx configuration">{`cat > /etc/nginx/sites-available/auditwise << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/auditwise /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t && systemctl reload nginx`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={6} title="Enable Free SSL (HTTPS)" icon={Lock}>
          <p>First, point your domain's DNS A record to your VPS IP address. Then:</p>
          <CodeBlock>{`# Get free SSL certificate from Let's Encrypt
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal:
certbot renew --dry-run`}</CodeBlock>
          <p className="text-xs">Certbot automatically configures Nginx for HTTPS and sets up auto-renewal.</p>
        </StepSection>

        <StepSection stepNumber={7} title="Configure Firewall" icon={Shield}>
          <CodeBlock>{`# Enable UFW firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Verify rules
ufw status`}</CodeBlock>
          <p className="text-xs">This allows SSH (port 22), HTTP (80), and HTTPS (443) only. PostgreSQL (5432) is only accessible locally.</p>
        </StepSection>

        <StepSection stepNumber={8} title="Set Up Automatic Backups" icon={Database}>
          <CodeBlock title="Create backup script">{`cat > /opt/auditwise/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/auditwise/backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U auditwise -h localhost auditwise | gzip > "$BACKUP_DIR/auditwise_$TIMESTAMP.sql.gz"
# Keep only last 14 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +14 -delete
echo "Backup completed: auditwise_$TIMESTAMP.sql.gz"
EOF
chmod +x /opt/auditwise/backup.sh

# Schedule daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/auditwise/backup.sh") | crontab -`}</CodeBlock>
        </StepSection>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Deploying Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`cd /opt/auditwise
git pull origin main
npm ci
NODE_OPTIONS="--max-old-space-size=4096" npm run build
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push
pm2 restart auditwise`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function DigitalOceanGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Nginx / DO LB</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> Droplet (:5000)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> Managed PostgreSQL</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "Droplet", cost: "$12-24", desc: "2-4 vCPU, 2-8GB RAM" },
                { name: "Managed DB", cost: "$15", desc: "PostgreSQL (1GB RAM)" },
                { name: "Spaces", cost: "$5", desc: "250GB object storage" },
                { name: "Domain", cost: "$0", desc: "Free DNS management" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~$27-44/month</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why DigitalOcean?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Simple, developer-friendly UI</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Managed PostgreSQL available</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Predictable pricing</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> $200 free credits for new accounts</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Create Droplet & Database" icon={Server} defaultOpen={true}>
          <p><strong>Option A: CLI (doctl)</strong></p>
          <CodeBlock>{`# Install doctl: https://docs.digitalocean.com/reference/doctl/how-to/install/
doctl auth init

# Create a Droplet (Ubuntu 22.04, 2 vCPU, 4GB RAM)
doctl compute droplet create auditwise \\
  --image ubuntu-22-04-x64 \\
  --size s-2vcpu-4gb \\
  --region nyc1 \\
  --ssh-keys YOUR_SSH_KEY_FINGERPRINT

# Create Managed PostgreSQL
doctl databases create auditwise-db \\
  --engine pg --version 15 \\
  --size db-s-1vcpu-1gb \\
  --region nyc1 --num-nodes 1`}</CodeBlock>
          <p><strong>Option B: Console</strong> — Go to <strong>cloud.digitalocean.com</strong> → Create → Droplets / Databases</p>
        </StepSection>

        <StepSection stepNumber={2} title="Server Setup" icon={Terminal}>
          <CodeBlock>{`ssh root@YOUR_DROPLET_IP

# Install Node.js 20, Nginx, PM2, Certbot
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx git
npm install -g pm2`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={3} title="Deploy Application" icon={Cpu}>
          <CodeBlock>{`mkdir -p /opt/auditwise && cd /opt/auditwise
git clone YOUR_REPOSITORY_URL .
npm ci

# Create .env with your managed DB connection string
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@DB_HOST:25060/auditwise?sslmode=require
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@yourfirm.com
ADMIN_PASSWORD=YourSecurePassword123!
FIRM_NAME=Your Audit Firm Name
EOF

NODE_OPTIONS="--max-old-space-size=4096" npx prisma generate
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push
NODE_OPTIONS="--max-old-space-size=4096" npm run build

pm2 start dist/index.cjs --name auditwise
pm2 save && pm2 startup`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={4} title="Configure Nginx & SSL" icon={Shield}>
          <CodeBlock>{`# Same Nginx config as Hostinger guide (see above)
# Then enable SSL:
certbot --nginx -d yourdomain.com

# Configure firewall
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable`}</CodeBlock>
        </StepSection>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Deploying Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock>{`cd /opt/auditwise && git pull && npm ci
NODE_OPTIONS="--max-old-space-size=4096" npm run build
NODE_OPTIONS="--max-old-space-size=4096" npx prisma db push
pm2 restart auditwise`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function AzureGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> App Gateway</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> App Service (:5000)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> Azure PostgreSQL</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "App Service", cost: "$13-55", desc: "B1-B2 (1-2 vCPU)" },
                { name: "PostgreSQL", cost: "$15-50", desc: "Flexible Server" },
                { name: "Key Vault", cost: "$0.03/op", desc: "Secrets management" },
                { name: "SSL", cost: "Free", desc: "Managed certificate" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~$30-110/month</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why Azure?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Enterprise-grade security & compliance</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Azure Active Directory integration</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> $200 free credits for new accounts</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Global data center presence</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Create Resource Group & Database" icon={Database} defaultOpen={true}>
          <CodeBlock>{`# Install Azure CLI: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
az login

# Create resource group
az group create --name auditwise-rg --location eastus

# Create PostgreSQL Flexible Server
az postgres flexible-server create \\
  --resource-group auditwise-rg \\
  --name auditwise-db \\
  --location eastus \\
  --admin-user auditwise \\
  --admin-password YOUR_STRONG_PASSWORD \\
  --sku-name Standard_B1ms \\
  --storage-size 32 \\
  --version 15

# Create the database
az postgres flexible-server db create \\
  --resource-group auditwise-rg \\
  --server-name auditwise-db \\
  --database-name auditwise`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={2} title="Create App Service" icon={Server}>
          <CodeBlock>{`# Create App Service Plan (Linux, B1 tier)
az appservice plan create \\
  --name auditwise-plan \\
  --resource-group auditwise-rg \\
  --sku B1 --is-linux

# Create Web App (Node.js 20)
az webapp create \\
  --resource-group auditwise-rg \\
  --plan auditwise-plan \\
  --name auditwise-app \\
  --runtime "NODE:20-lts"

# Configure environment variables
az webapp config appsettings set \\
  --resource-group auditwise-rg \\
  --name auditwise-app \\
  --settings \\
    NODE_ENV=production \\
    PORT=5000 \\
    DATABASE_URL="postgresql://auditwise:YOUR_PASSWORD@auditwise-db.postgres.database.azure.com:5432/auditwise?sslmode=require" \\
    SESSION_SECRET="$(openssl rand -hex 32)" \\
    ADMIN_EMAIL="admin@yourfirm.com" \\
    ADMIN_PASSWORD="YourSecurePassword123!" \\
    FIRM_NAME="Your Audit Firm Name"

# Set startup command
az webapp config set \\
  --resource-group auditwise-rg \\
  --name auditwise-app \\
  --startup-file "node dist/index.cjs"`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={3} title="Deploy via Docker or ZIP" icon={Cpu}>
          <p><strong>Option A: Docker deployment (recommended)</strong></p>
          <CodeBlock>{`# Create Azure Container Registry
az acr create --resource-group auditwise-rg \\
  --name auditwiseacr --sku Basic

# Build and push
az acr build --registry auditwiseacr \\
  --image auditwise:latest .

# Configure App Service to use container
az webapp config container set \\
  --resource-group auditwise-rg \\
  --name auditwise-app \\
  --container-image-name auditwiseacr.azurecr.io/auditwise:latest`}</CodeBlock>
          <p><strong>Option B: ZIP deploy</strong></p>
          <CodeBlock>{`npm run build
zip -r deploy.zip dist/ node_modules/ prisma/ package.json
az webapp deploy --resource-group auditwise-rg \\
  --name auditwise-app --src-path deploy.zip`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={4} title="Configure Custom Domain & SSL" icon={Shield}>
          <CodeBlock>{`# Add custom domain
az webapp config hostname add \\
  --resource-group auditwise-rg \\
  --webapp-name auditwise-app \\
  --hostname yourdomain.com

# Enable managed SSL certificate
az webapp config ssl create \\
  --resource-group auditwise-rg \\
  --name auditwise-app \\
  --hostname yourdomain.com`}</CodeBlock>
        </StepSection>
      </div>
    </div>
  );
}

function GCPGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Cloud Load Balancer</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> Cloud Run (:5000)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> Cloud SQL</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "Cloud Run", cost: "$10-40", desc: "Pay per request + CPU" },
                { name: "Cloud SQL", cost: "$10-30", desc: "PostgreSQL (shared core)" },
                { name: "Artifact Registry", cost: "$0.10/GB", desc: "Container storage" },
                { name: "SSL/Domain", cost: "Free", desc: "Managed certificates" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~$20-70/month</span> (scales with usage)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why Google Cloud?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Cloud Run: serverless containers</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Pay-per-use pricing</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> $300 free credits for new accounts</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Auto-scaling built in</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Set Up Project & Database" icon={Database} defaultOpen={true}>
          <CodeBlock>{`# Install gcloud CLI: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud projects create auditwise-prod --name="AuditWise"
gcloud config set project auditwise-prod

# Enable required APIs
gcloud services enable run.googleapis.com sqladmin.googleapis.com \\
  artifactregistry.googleapis.com secretmanager.googleapis.com

# Create Cloud SQL PostgreSQL instance
gcloud sql instances create auditwise-db \\
  --database-version=POSTGRES_15 \\
  --tier=db-f1-micro \\
  --region=us-central1 \\
  --storage-size=10GB

# Set database password and create database
gcloud sql users set-password postgres \\
  --instance=auditwise-db --password=YOUR_PASSWORD
gcloud sql databases create auditwise --instance=auditwise-db`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={2} title="Store Secrets" icon={Lock}>
          <CodeBlock>{`# Create secrets
echo -n "postgresql://postgres:YOUR_PASSWORD@/auditwise?host=/cloudsql/PROJECT:REGION:auditwise-db" | \\
  gcloud secrets create database-url --data-file=-

echo -n "$(openssl rand -hex 32)" | \\
  gcloud secrets create session-secret --data-file=-

echo -n "YourSecurePassword123!" | \\
  gcloud secrets create admin-password --data-file=-`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={3} title="Build & Deploy to Cloud Run" icon={Rocket}>
          <CodeBlock>{`# Create Artifact Registry repository
gcloud artifacts repositories create auditwise \\
  --repository-format=docker --location=us-central1

# Build with Cloud Build
gcloud builds submit --tag \\
  us-central1-docker.pkg.dev/auditwise-prod/auditwise/app:latest

# Deploy to Cloud Run
gcloud run deploy auditwise \\
  --image us-central1-docker.pkg.dev/auditwise-prod/auditwise/app:latest \\
  --platform managed \\
  --region us-central1 \\
  --port 5000 \\
  --memory 2Gi \\
  --cpu 2 \\
  --min-instances 1 \\
  --set-env-vars "NODE_ENV=production,ADMIN_EMAIL=admin@yourfirm.com,FIRM_NAME=Your Firm" \\
  --set-secrets "DATABASE_URL=database-url:latest,SESSION_SECRET=session-secret:latest,ADMIN_PASSWORD=admin-password:latest" \\
  --add-cloudsql-instances auditwise-prod:us-central1:auditwise-db \\
  --allow-unauthenticated`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={4} title="Map Custom Domain" icon={Globe}>
          <CodeBlock>{`gcloud run domain-mappings create \\
  --service auditwise \\
  --domain yourdomain.com \\
  --region us-central1`}</CodeBlock>
          <p className="text-xs">Add the DNS records shown in the output. SSL is automatic.</p>
        </StepSection>
      </div>
    </div>
  );
}

function RailwayGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> Railway App</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> Railway PostgreSQL</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Simplest deployment option. Railway handles infrastructure, SSL, and deploys from your Git repository automatically.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "App Service", cost: "$5-20", desc: "Usage-based pricing" },
                { name: "PostgreSQL", cost: "$5-15", desc: "Managed database" },
                { name: "SSL/Domain", cost: "Free", desc: "Auto-provisioned" },
                { name: "Bandwidth", cost: "Included", desc: "100GB/month" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~$10-35/month</span> (usage-based)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why Railway?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Easiest setup (5 minutes)</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Git-based auto-deploy</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Built-in PostgreSQL</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> No DevOps knowledge needed</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Create Project on Railway" icon={Server} defaultOpen={true}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>Go to <strong>railway.app</strong> and sign up / log in</li>
            <li>Click <strong>New Project</strong> → <strong>Deploy from GitHub repo</strong></li>
            <li>Select your AuditWise repository</li>
            <li>Railway auto-detects the Dockerfile and starts building</li>
          </ol>
        </StepSection>

        <StepSection stepNumber={2} title="Add PostgreSQL Database" icon={Database}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>In your Railway project, click <strong>+ New</strong> → <strong>Database</strong> → <strong>PostgreSQL</strong></li>
            <li>Railway creates the database instantly</li>
            <li>Copy the <strong>DATABASE_URL</strong> from the database's <strong>Variables</strong> tab</li>
          </ol>
        </StepSection>

        <StepSection stepNumber={3} title="Configure Environment Variables" icon={Lock}>
          <p>In your Railway service, go to <strong>Variables</strong> tab and add:</p>
          <CodeBlock>{`NODE_ENV=production
PORT=5000
DATABASE_URL=\${{Postgres.DATABASE_URL}}
SESSION_SECRET=your-random-64-char-string
ADMIN_EMAIL=admin@yourfirm.com
ADMIN_PASSWORD=YourSecurePassword123!
FIRM_NAME=Your Audit Firm Name`}</CodeBlock>
          <p className="text-xs">Use <code className="bg-muted px-1 rounded">{"${{Postgres.DATABASE_URL}}"}</code> to reference the Railway PostgreSQL URL automatically.</p>
        </StepSection>

        <StepSection stepNumber={4} title="Deploy & Add Domain" icon={Globe}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>Railway deploys automatically after configuring variables</li>
            <li>Go to <strong>Settings</strong> → <strong>Domains</strong></li>
            <li>Add your custom domain or use the free <code className="text-xs bg-muted px-1 rounded">.up.railway.app</code> subdomain</li>
            <li>SSL is automatic — no configuration needed</li>
          </ol>
        </StepSection>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Deploying Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Push to your Git repository — Railway deploys automatically.</p>
          <CodeBlock>{`git add . && git commit -m "Update" && git push`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}

function RenderGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> Render Web Service</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> Render PostgreSQL</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "Starter", cost: "$7", desc: "0.5 CPU, 512MB RAM" },
                { name: "Standard", cost: "$25", desc: "1 CPU, 2GB RAM" },
                { name: "PostgreSQL", cost: "$7-20", desc: "Managed database" },
                { name: "SSL", cost: "Free", desc: "Auto-provisioned" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~$32-45/month</span> (Standard + DB)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why Render?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Simple Heroku alternative</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Auto-deploy from Git</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Free managed SSL</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Docker support</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Create PostgreSQL Database" icon={Database} defaultOpen={true}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>Go to <strong>render.com</strong> → <strong>New</strong> → <strong>PostgreSQL</strong></li>
            <li>Name: <code className="text-xs bg-muted px-1 rounded">auditwise-db</code></li>
            <li>Plan: <strong>Starter</strong> ($7/mo) or <strong>Standard</strong></li>
            <li>Copy the <strong>Internal Database URL</strong> after creation</li>
          </ol>
        </StepSection>

        <StepSection stepNumber={2} title="Create Web Service" icon={Server}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>Go to <strong>New</strong> → <strong>Web Service</strong></li>
            <li>Connect your GitHub/GitLab repository</li>
            <li>Environment: <strong>Docker</strong></li>
            <li>Plan: <strong>Standard</strong> ($25/mo, 1 CPU, 2GB RAM)</li>
          </ol>
        </StepSection>

        <StepSection stepNumber={3} title="Set Environment Variables" icon={Lock}>
          <p>In the web service <strong>Environment</strong> tab, add:</p>
          <CodeBlock>{`NODE_ENV=production
PORT=5000
DATABASE_URL=<Internal Database URL from Step 1>
SESSION_SECRET=<random 64-char string>
ADMIN_EMAIL=admin@yourfirm.com
ADMIN_PASSWORD=YourSecurePassword123!
FIRM_NAME=Your Audit Firm Name`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={4} title="Deploy & Configure Domain" icon={Globe}>
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>Click <strong>Deploy</strong> — Render builds from Dockerfile automatically</li>
            <li>Add custom domain in <strong>Settings</strong> → <strong>Custom Domains</strong></li>
            <li>Add the CNAME record shown to your DNS provider</li>
            <li>SSL certificate is provisioned automatically</li>
          </ol>
        </StepSection>
      </div>
    </div>
  );
}

function LinodeGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Nginx (HTTPS)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> Linode VPS (:5000)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> PostgreSQL</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Akamai/Linode provides reliable VPS hosting with simple pricing. Same setup pattern as Hostinger VPS.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "Linode 4GB", cost: "$24", desc: "2 vCPU, 4GB RAM, 80GB SSD" },
                { name: "Linode 8GB", cost: "$48", desc: "4 vCPU, 8GB RAM, 160GB SSD" },
                { name: "Managed DB", cost: "$15", desc: "PostgreSQL (optional)" },
                { name: "Domain/SSL", cost: "Free", desc: "DNS + Let's Encrypt" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~$24-63/month</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why Linode/Akamai?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Simple, predictable pricing</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Backed by Akamai (CDN leader)</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> $100 free credits for new accounts</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Excellent documentation</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Create Linode Instance" icon={Server} defaultOpen={true}>
          <CodeBlock>{`# Using Linode CLI
pip3 install linode-cli
linode-cli configure

# Create a Linode (Ubuntu 22.04, 4GB plan)
linode-cli linodes create \\
  --type g6-standard-2 \\
  --region us-east \\
  --image linode/ubuntu22.04 \\
  --root_pass YOUR_ROOT_PASSWORD \\
  --label auditwise

# Or use the Linode Cloud Manager UI at cloud.linode.com`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={2} title="Server Setup & Deploy" icon={Cpu}>
          <p>Follow the same steps as the <strong>Hostinger VPS</strong> guide — the server setup is identical:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>SSH into server and install Node.js 20, PostgreSQL, Nginx, PM2, Certbot</li>
            <li>Create PostgreSQL database and user</li>
            <li>Clone repo, install deps, configure .env, build, start with PM2</li>
            <li>Configure Nginx reverse proxy</li>
            <li>Enable SSL with Certbot</li>
            <li>Configure UFW firewall</li>
          </ol>
          <p className="text-xs mt-1">The deployment commands are the same for any Ubuntu VPS provider.</p>
        </StepSection>
      </div>
    </div>
  );
}

function HetznerGuide() {
  return (
    <div className="space-y-2.5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" /> Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Your Domain</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Nginx (HTTPS)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="gap-1 bg-primary"><Server className="h-3 w-3" /> Hetzner VPS (:5000)</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="gap-1"><Database className="h-3 w-3" /> PostgreSQL</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Hetzner offers exceptional value in European data centers. Best price-to-performance ratio for VPS hosting.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Monthly Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { name: "CX22", cost: "€4.55", desc: "2 vCPU, 4GB RAM, 40GB SSD" },
                { name: "CX32", cost: "€7.45", desc: "4 vCPU, 8GB RAM, 80GB SSD" },
                { name: "CX42", cost: "€14.55", desc: "8 vCPU, 16GB RAM, 160GB SSD" },
                { name: "Domain/SSL", cost: "Free", desc: "Let's Encrypt" },
              ].map(s => (
                <div key={s.name} className="p-2 rounded-md bg-muted/50">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-primary font-bold">{s.cost}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: <span className="font-semibold text-foreground">~€4.55-15/month</span> (best value in Europe)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" /> Why Hetzner?</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Best price/performance ratio</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> EU data centers (GDPR compliant)</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> AMD EPYC / Intel Xeon CPUs</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> 20TB bandwidth included</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-1">
        <StepSection stepNumber={1} title="Create Cloud Server" icon={Server} defaultOpen={true}>
          <CodeBlock>{`# Install hcloud CLI
brew install hcloud  # macOS
# or: apt install hcloud-cli  # Linux

hcloud context create auditwise

# Create server (CX22, Ubuntu 22.04)
hcloud server create \\
  --name auditwise \\
  --type cx22 \\
  --image ubuntu-22.04 \\
  --location nbg1 \\
  --ssh-key YOUR_SSH_KEY

# Or use the Hetzner Cloud Console at console.hetzner.cloud`}</CodeBlock>
        </StepSection>

        <StepSection stepNumber={2} title="Server Setup & Deploy" icon={Cpu}>
          <p>Follow the same steps as the <strong>Hostinger VPS</strong> guide. The server setup is identical for any Ubuntu VPS:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>SSH into server and install Node.js 20, PostgreSQL, Nginx, PM2, Certbot</li>
            <li>Create PostgreSQL database and user</li>
            <li>Clone repo, install deps, configure .env, build, start with PM2</li>
            <li>Configure Nginx reverse proxy</li>
            <li>Enable SSL with Certbot</li>
            <li>Configure UFW firewall</li>
          </ol>
        </StepSection>
      </div>
    </div>
  );
}

const platforms = [
  { id: "hostinger", label: "Hostinger VPS", badge: "Best Value", badgeColor: "bg-green-600" },
  { id: "aws", label: "AWS", badge: "Enterprise", badgeColor: "bg-orange-500" },
  { id: "digitalocean", label: "DigitalOcean", badge: "Popular", badgeColor: "bg-blue-500" },
  { id: "gcp", label: "Google Cloud", badge: "Serverless", badgeColor: "bg-red-500" },
  { id: "azure", label: "Azure", badge: "Enterprise", badgeColor: "bg-blue-700" },
  { id: "railway", label: "Railway", badge: "Easiest", badgeColor: "bg-purple-600" },
  { id: "render", label: "Render", badge: "Simple", badgeColor: "bg-teal-600" },
  { id: "linode", label: "Linode/Akamai", badge: "Reliable", badgeColor: "bg-green-700" },
  { id: "hetzner", label: "Hetzner", badge: "EU/Budget", badgeColor: "bg-red-600" },
];

interface VersionInfo {
  version: string;
  lastUpdated: string;
}

const envVarsList = [
  { name: "DATABASE_URL", required: true, desc: "PostgreSQL connection string" },
  { name: "SESSION_SECRET", required: true, desc: "Random 64-char string for session encryption" },
  { name: "ADMIN_EMAIL", required: true, desc: "Email for the initial admin account" },
  { name: "ADMIN_PASSWORD", required: true, desc: "Password for the initial admin account" },
  { name: "FIRM_NAME", required: true, desc: "Your audit firm name" },
  { name: "NODE_ENV", required: false, desc: 'Set to "production"' },
  { name: "OPENAI_API_KEY", required: false, desc: "For AI features (can configure in Settings later)" },
];

const platformGuides: { id: string; label: string; badge: string; steps: { title: string; details: string[] }[] }[] = [
  {
    id: "hostinger", label: "Hostinger VPS", badge: "Best Value",
    steps: [
      { title: "Purchase & Access VPS", details: ["Go to hostinger.com, choose KVM 2+ (2 vCPU, 8GB RAM)", "Select Ubuntu 22.04, note your IP", "SSH: ssh root@YOUR_SERVER_IP"] },
      { title: "Install Dependencies", details: ["apt update && apt upgrade -y", "Install Node.js 20: curl -fsSL https://deb.nodesource.com/setup_20.x | bash && apt install nodejs", "Install PostgreSQL, Nginx, PM2 (npm install -g pm2), Certbot, Git"] },
      { title: "Set Up PostgreSQL", details: ["sudo -u postgres psql", "CREATE USER auditwise WITH PASSWORD 'password';", "CREATE DATABASE auditwise OWNER auditwise;"] },
      { title: "Deploy Application", details: ["git clone repo to /opt/auditwise", "npm ci && create .env file with all variables", "NODE_OPTIONS='--max-old-space-size=4096' npx prisma generate && prisma db push && npm run build", "pm2 start dist/index.cjs --name auditwise && pm2 save && pm2 startup"] },
      { title: "Configure Nginx & SSL", details: ["Create Nginx reverse proxy config for port 5000", "certbot --nginx -d yourdomain.com", "ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable"] },
      { title: "Set Up Backups", details: ["Create pg_dump cron job for daily database backups", "Keep 14 days of rolling backups"] },
    ],
  },
  {
    id: "aws", label: "AWS (ECS Fargate)", badge: "Enterprise",
    steps: [
      { title: "Create RDS PostgreSQL", details: ["Engine: PostgreSQL 15+, Instance: db.t3.micro+", "DB name: auditwise, Public access: No"] },
      { title: "Store Secrets", details: ["aws secretsmanager create-secret for database-url, session-secret, admin-password"] },
      { title: "Build & Push Docker", details: ["docker build --platform linux/amd64 -t auditwise .", "Push to ECR (or use ./aws/deploy.sh)"] },
      { title: "Create ECS Service", details: ["Create cluster, register task definition, create service", "Configure ALB with health check /health"] },
      { title: "Configure HTTPS & DNS", details: ["Request ACM certificate, add HTTPS listener", "Point domain via Route 53"] },
    ],
  },
  {
    id: "digitalocean", label: "DigitalOcean", badge: "Popular",
    steps: [
      { title: "Create Droplet & Database", details: ["Droplet: Ubuntu 22.04, 2-4 vCPU", "Managed PostgreSQL or self-hosted"] },
      { title: "Server Setup", details: ["Install Node.js 20, Nginx, PM2, Certbot"] },
      { title: "Deploy & Configure", details: ["Same VPS deploy pattern as Hostinger", "certbot --nginx for SSL"] },
    ],
  },
  {
    id: "gcp", label: "Google Cloud (Cloud Run)", badge: "Serverless",
    steps: [
      { title: "Create Cloud SQL", details: ["PostgreSQL 15, db-f1-micro tier"] },
      { title: "Store Secrets", details: ["gcloud secrets create for database-url, session-secret, admin-password"] },
      { title: "Deploy to Cloud Run", details: ["gcloud builds submit && gcloud run deploy", "Port 5000, 2Gi memory, min 1 instance"] },
      { title: "Map Domain", details: ["gcloud run domain-mappings create", "SSL is automatic"] },
    ],
  },
  {
    id: "azure", label: "Azure", badge: "Enterprise",
    steps: [
      { title: "Create Resources", details: ["Resource group, PostgreSQL Flexible Server, App Service Plan (B1+)"] },
      { title: "Configure App", details: ["Set environment variables, startup command: node dist/index.cjs"] },
      { title: "Deploy", details: ["Docker via ACR or ZIP deploy", "Custom domain + managed SSL"] },
    ],
  },
  {
    id: "railway", label: "Railway", badge: "Easiest",
    steps: [
      { title: "Create Project", details: ["railway.app → New Project → Deploy from GitHub"] },
      { title: "Add PostgreSQL", details: ["+ New → Database → PostgreSQL (instant)"] },
      { title: "Configure Variables", details: ["Add all env vars in Variables tab", "Use ${{Postgres.DATABASE_URL}} for auto-reference"] },
      { title: "Deploy", details: ["Auto-deploys on git push, SSL automatic"] },
    ],
  },
  {
    id: "render", label: "Render", badge: "Simple",
    steps: [
      { title: "Create PostgreSQL", details: ["render.com → New → PostgreSQL"] },
      { title: "Create Web Service", details: ["Connect GitHub, Environment: Docker, Plan: Standard"] },
      { title: "Configure & Deploy", details: ["Set env vars, deploy builds from Dockerfile", "Custom domain + auto SSL"] },
    ],
  },
  {
    id: "linode", label: "Linode/Akamai", badge: "Reliable",
    steps: [
      { title: "Create Linode", details: ["Ubuntu 22.04, Linode 4GB+ plan"] },
      { title: "Deploy", details: ["Same VPS pattern as Hostinger (Node.js, PostgreSQL, Nginx, PM2, Certbot)"] },
    ],
  },
  {
    id: "hetzner", label: "Hetzner", badge: "EU/Budget",
    steps: [
      { title: "Create Cloud Server", details: ["CX22+, Ubuntu 22.04, EU data centers"] },
      { title: "Deploy", details: ["Same VPS pattern as Hostinger (Node.js, PostgreSQL, Nginx, PM2, Certbot)"] },
    ],
  },
];

function generateDeploymentPDF(
  versionInfo: VersionInfo | undefined,
  firmInfo?: { name?: string | null; displayName?: string | null; logoUrl?: string | null }
) {
  return async () => {
    const jspdfModule = await import("jspdf");
    const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.autoTable || autoTableModule.default;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const firmName = firmInfo?.displayName || firmInfo?.name || "AuditWise";
    let coverLogoY = 50;
    if (firmInfo?.logoUrl) {
      try {
        const b64 = await logoToBase64(firmInfo.logoUrl);
        if (b64) {
          doc.addImage(b64, "PNG", 67.5, 25, 70, 25);
          coverLogoY = 60;
        }
      } catch {}
    }

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text(firmName, 105, coverLogoY, { align: "center" });
    doc.setFontSize(18);
    doc.setFont("helvetica", "normal");
    doc.text("Deployment Guide", 105, coverLogoY + 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Version: ${versionInfo?.version || "1.0.0"}`, 105, coverLogoY + 32, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, 105, coverLogoY + 40, { align: "center" });
    doc.setFontSize(10);
    doc.text(`${platforms.length} Deployment Platforms Covered`, 105, coverLogoY + 55, { align: "center" });
    doc.setFontSize(9);
    doc.text("CONFIDENTIAL - For Internal Use Only", 105, coverLogoY + 80, { align: "center" });

    doc.addPage();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Table of Contents", 20, 25);
    doc.setFontSize(10);
    let tocY = 40;
    let pageNum = 3;
    doc.setFont("helvetica", "bold");
    doc.text("Common Configuration", 20, tocY);
    tocY += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Build Info & Environment Variables ............ ${pageNum}`, 25, tocY);
    tocY += 5;
    pageNum++;
    doc.text(`Security Checklist ............ ${pageNum}`, 25, tocY);
    tocY += 8;
    pageNum++;

    doc.setFont("helvetica", "bold");
    doc.text("Platform Guides", 20, tocY);
    tocY += 6;
    doc.setFont("helvetica", "normal");
    platformGuides.forEach(p => {
      doc.text(`${p.label} (${p.badge}) ............ ${pageNum}`, 25, tocY);
      tocY += 5;
      pageNum++;
    });
    tocY += 5;
    doc.text(`First Login Steps ............ ${pageNum}`, 25, tocY);

    const checkPageBreak = (currentY: number, needed: number): number => {
      if (currentY + needed > 275) { doc.addPage(); return 20; }
      return currentY;
    };

    doc.addPage();
    let y = 20;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Build Information", 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const buildItems = [
      "Build command: npm run build (produces dist/index.cjs)",
      "Production start: node dist/index.cjs on port 5000",
      'Schema push needs: NODE_OPTIONS="--max-old-space-size=4096"',
      "Health check endpoint: GET /health",
    ];
    buildItems.forEach(item => { doc.text(`- ${item}`, 25, y); y += 5; });
    y += 5;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Required Environment Variables", 20, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Variable", "Required", "Description"]],
      body: envVarsList.map(v => [v.name, v.required ? "Yes" : "Optional", v.desc]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      margin: { left: 20, right: 20 },
      columnStyles: { 0: { cellWidth: 40, font: "courier" }, 1: { cellWidth: 20 }, 2: { cellWidth: 110 } },
    });

    doc.addPage();
    y = 20;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Security Checklist", 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const securityItems = [
      "Database is NOT publicly accessible",
      "All passwords stored securely (not in code)",
      "HTTPS enabled with valid SSL certificate",
      "Firewall rules restrict access to needed ports only",
      "Database backups enabled (7+ day retention)",
      "Session secret is a random 32+ character string",
      "Admin password is strong and unique",
      "Regular security updates applied to OS",
    ];
    securityItems.forEach(item => { doc.text(`[x] ${item}`, 25, y); y += 5; });

    platformGuides.forEach(platform => {
      doc.addPage();
      y = 20;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${platform.label} (${platform.badge})`, 20, y);
      y += 10;

      platform.steps.forEach((step, idx) => {
        y = checkPageBreak(y, 15 + step.details.length * 5);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Step ${idx + 1}: ${step.title}`, 20, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        step.details.forEach(detail => {
          y = checkPageBreak(y, 5);
          const lines = doc.splitTextToSize(`- ${detail}`, 165);
          doc.text(lines, 25, y);
          y += lines.length * 4 + 1;
        });
        y += 4;
      });
    });

    doc.addPage();
    y = 20;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("After Deployment - First Login", 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const firstLoginSteps = [
      "Open your domain or server IP in a browser",
      "Login with the ADMIN_EMAIL and ADMIN_PASSWORD you configured",
      "Go to Settings > AI Configuration to set up your OpenAI API key",
      "Go to User Management to create team accounts (Partner, Manager, Staff, etc.)",
      "Create your first audit engagement from the Engagements page",
    ];
    firstLoginSteps.forEach((step, idx) => {
      doc.text(`${idx + 1}. ${step}`, 25, y);
      y += 5;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`AuditWise Deployment Guide | Page ${i} of ${totalPages}`, 105, 290, { align: "center" });
    }

    doc.save("AuditWise-Deployment-Guide.pdf");
  };
}

export default function DeploymentGuide() {
  const { toast } = useToast();
  const { user, firm } = useAuth();

  const { data: versionInfo } = useQuery<VersionInfo>({
    queryKey: ["/api/version"],
  });

  if (user?.role?.toLowerCase() !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-destructive mb-2.5" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground text-center">
              The Deployment Guide is only available to Super Administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDownloadPDF = async () => {
    toast({ title: "Generating PDF...", description: "Please wait while the deployment guide is prepared." });
    try {
      await generateDeploymentPDF(versionInfo, firm)();
      toast({ title: "Guide downloaded", description: `PDF with ${platforms.length} platform guides has been generated.` });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({ title: "Download failed", description: "Could not generate the PDF. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-3 py-3 space-y-3">
        <div className="flex items-start justify-between gap-2.5 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Rocket className="h-7 w-7 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight" data-testid="page-title">Deployment Guide</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Deploy AuditWise to production on your preferred platform. Choose a hosting provider below to get step-by-step deployment instructions.
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              <span>Version: {versionInfo?.version || "1.0.0"}</span>
              <span>|</span>
              <span>Last Updated: {versionInfo?.lastUpdated ? new Date(versionInfo.lastUpdated).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <span>|</span>
              <span>{platforms.length} Platforms Covered</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-1.5" />
            Download Guide (PDF)
          </Button>
        </div>

        <CommonBuildInfo />
        <EnvVarsTable />

        <Separator />

        <Tabs defaultValue="hostinger" className="w-full">
          <TabsList className="w-full" data-testid="platform-tabs">
            {platforms.map(p => (
              <TabsTrigger
                key={p.id}
                value={p.id}
                className="text-xs px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid={`tab-${p.id}`}
              >
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-2.5">
            <TabsContent value="hostinger"><HostingerGuide /></TabsContent>
            <TabsContent value="aws"><AWSGuide /></TabsContent>
            <TabsContent value="digitalocean"><DigitalOceanGuide /></TabsContent>
            <TabsContent value="gcp"><GCPGuide /></TabsContent>
            <TabsContent value="azure"><AzureGuide /></TabsContent>
            <TabsContent value="railway"><RailwayGuide /></TabsContent>
            <TabsContent value="render"><RenderGuide /></TabsContent>
            <TabsContent value="linode"><LinodeGuide /></TabsContent>
            <TabsContent value="hetzner"><HetznerGuide /></TabsContent>
          </div>
        </Tabs>

        <Separator />

        <FirstLoginSteps />
        <SecurityChecklist />

        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              <strong>Getting started tip:</strong> For small-medium firms, start with <strong>Hostinger VPS KVM 2</strong> (~$6/mo) or <strong>Railway</strong> (~$10-35/mo for the easiest setup).
              For enterprise deployments with compliance requirements, consider <strong>AWS</strong>, <strong>Azure</strong>, or <strong>Google Cloud</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
