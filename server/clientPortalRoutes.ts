import { Router, Response, Request, NextFunction } from "express";
import { prisma } from "./db";
import { requireAuth, requireMinRole, logAuditTrail, type AuthenticatedRequest } from "./auth";
import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { generateGuidance, checkCompleteness, analyzeDocument } from "./services/aiGuidanceService";

const router = Router();

const PORTAL_SESSION_COOKIE = "portal_session";
const SESSION_EXPIRY_HOURS = 24;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = 'uploads/portal-attachments';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

interface PortalSession {
  portalContactId: string;
  clientId: string;
  firmId: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface PortalAuthenticatedRequest extends Request {
  portalSession?: PortalSession;
}

async function createPortalSession(portalContactId: string, ipAddress?: string, userAgent?: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  
  const session = await prisma.clientPortalSession.create({
    data: {
      portalContactId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });
  
  return session;
}

async function validatePortalSession(token: string) {
  const session = await prisma.clientPortalSession.findUnique({
    where: { token },
    include: { 
      portalContact: { 
        include: { 
          client: { select: { id: true, name: true } }, 
          firm: { select: { id: true, name: true } } 
        } 
      } 
    },
  });
  
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.clientPortalSession.delete({ where: { id: session.id } });
    return null;
  }
  
  if (session.portalContact.deletedAt) {
    await prisma.clientPortalSession.delete({ where: { id: session.id } });
    return null;
  }
  
  return session;
}

async function invalidatePortalSession(token: string) {
  await prisma.clientPortalSession.delete({ where: { token } }).catch(() => {});
}

async function requirePortalAuth(req: PortalAuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[PORTAL_SESSION_COOKIE];
  
  if (!token) {
    return res.status(401).json({ error: 'Portal authentication required' });
  }
  
  const session = await validatePortalSession(token);
  if (!session) {
    res.clearCookie(PORTAL_SESSION_COOKIE);
    return res.status(401).json({ error: 'Portal session expired' });
  }
  
  req.portalSession = {
    portalContactId: session.portalContact.id,
    clientId: session.portalContact.clientId,
    firmId: session.portalContact.firmId,
    email: session.portalContact.email,
    firstName: session.portalContact.firstName,
    lastName: session.portalContact.lastName,
  };
  
  next();
}

const PortalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = PortalLoginSchema.parse(req.body);

    const contact = await prisma.clientPortalContact.findFirst({
      where: { email, deletedAt: null, portalPasswordHash: { not: null } },
      include: {
        client: { select: { id: true, name: true } },
        firm: { select: { id: true, name: true } },
      },
    });

    if (!contact || !contact.portalPasswordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, contact.portalPasswordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await prisma.clientPortalContact.update({
      where: { id: contact.id },
      data: { 
        portalLastLogin: new Date(),
        portalLoginCount: { increment: 1 },
      },
    });

    const portalSession = await createPortalSession(
      contact.id,
      req.ip || undefined,
      req.get('user-agent') || undefined
    );

    res.cookie(PORTAL_SESSION_COOKIE, portalSession.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
    });

    await prisma.clientPortalLog.create({
      data: {
        clientContactId: contact.id,
        activityType: 'LOGIN',
        activityDetails: JSON.stringify({ ip: req.ip }),
      },
    });

    res.json({
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      client: contact.client,
      firm: contact.firm,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid credentials format' });
    }
    console.error('Portal login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/auth/logout', async (req: PortalAuthenticatedRequest, res: Response) => {
  const token = req.cookies?.[PORTAL_SESSION_COOKIE];
  
  if (token) {
    const session = await validatePortalSession(token);
    if (session) {
      try {
        await prisma.clientPortalLog.create({
          data: {
            clientContactId: session.portalContact.id,
            activityType: 'LOGOUT',
            activityDetails: JSON.stringify({ ip: req.ip }),
          },
        });
      } catch (e) {}
      await invalidatePortalSession(token);
    }
  }
  
  res.clearCookie(PORTAL_SESSION_COOKIE);
  res.json({ success: true });
});

router.get('/auth/me', async (req: PortalAuthenticatedRequest, res: Response) => {
  const token = req.cookies?.[PORTAL_SESSION_COOKIE];
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const session = await validatePortalSession(token);
  if (!session) {
    res.clearCookie(PORTAL_SESSION_COOKIE);
    return res.status(401).json({ error: 'Session expired' });
  }

  const contact = session.portalContact;
  
  res.json({
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    client: contact.client,
    firm: contact.firm,
  });
});

router.get('/portal/dashboard', requirePortalAuth, async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { clientId } = req.portalSession!;

    const engagements = await prisma.engagement.findMany({
      where: { clientId, status: { in: ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] } },
      select: {
        id: true,
        engagementCode: true,
        fiscalYearEnd: true,
        status: true,
        engagementType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const engagementIds = engagements.map(e => e.id);

    const [pendingRequests, inProgressRequests, completedRequests, totalAttachments] = await Promise.all([
      prisma.informationRequest.count({
        where: { engagementId: { in: engagementIds }, status: 'PENDING' },
      }),
      prisma.informationRequest.count({
        where: { engagementId: { in: engagementIds }, status: 'IN_PROGRESS' },
      }),
      prisma.informationRequest.count({
        where: { engagementId: { in: engagementIds }, status: 'COMPLETED' },
      }),
      prisma.requestAttachment.count({
        where: { 
          request: { engagementId: { in: engagementIds } },
        },
      }),
    ]);

    const requestCounts = await prisma.informationRequest.groupBy({
      by: ['engagementId', 'status'],
      where: { engagementId: { in: engagementIds } },
      _count: true,
    });

    const engagementsWithStats = engagements.map(e => {
      const pendingCount = requestCounts.find(r => r.engagementId === e.id && r.status === 'PENDING')?._count || 0;
      const inProgressCount = requestCounts.find(r => r.engagementId === e.id && r.status === 'IN_PROGRESS')?._count || 0;
      const completedCount = requestCounts.find(r => r.engagementId === e.id && r.status === 'COMPLETED')?._count || 0;
      return {
        ...e,
        pendingRequests: pendingCount,
        inProgressRequests: inProgressCount,
        completedRequests: completedCount,
      };
    });

    res.json({
      engagements: engagementsWithStats,
      stats: {
        totalEngagements: engagements.length,
        pendingRequests,
        inProgressRequests,
        completedRequests,
        totalAttachments,
      },
    });
  } catch (error) {
    console.error('Portal dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

router.get('/portal/engagements/:engagementId', requirePortalAuth, async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { clientId } = req.portalSession!;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, clientId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            tradingName: true,
            ntn: true,
            secpNo: true,
            email: true,
            phone: true,
            website: true,
            industry: true,
            entityType: true,
            dateOfIncorporation: true,
            ceoName: true,
            cfoName: true,
            address: true,
            city: true,
            country: true,
          },
        },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const [pendingRequests, inProgressRequests, completedRequests, totalAttachments] = await Promise.all([
      prisma.informationRequest.count({
        where: { engagementId, status: 'PENDING' },
      }),
      prisma.informationRequest.count({
        where: { engagementId, status: 'IN_PROGRESS' },
      }),
      prisma.informationRequest.count({
        where: { engagementId, status: 'COMPLETED' },
      }),
      prisma.requestAttachment.count({
        where: { 
          request: { engagementId },
        },
      }),
    ]);

    res.json({
      engagement,
      stats: {
        pendingRequests,
        inProgressRequests,
        completedRequests,
        totalAttachments,
      },
    });
  } catch (error) {
    console.error('Portal engagement error:', error);
    res.status(500).json({ error: 'Failed to load engagement' });
  }
});

router.get('/portal/engagements/:engagementId/attachments', requirePortalAuth, async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { clientId } = req.portalSession!;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, clientId },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const attachments = await prisma.requestAttachment.findMany({
      where: { 
        request: { engagementId },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json(attachments);
  } catch (error) {
    console.error('Portal attachments error:', error);
    res.status(500).json({ error: 'Failed to load attachments' });
  }
});

router.get('/portal/engagements/:engagementId/requests', requirePortalAuth, async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { clientId } = req.portalSession!;

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, clientId },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const requests = await prisma.informationRequest.findMany({
      where: { engagementId },
      include: {
        attachments: { where: { isActive: true } },
        clientContact: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    res.json(requests);
  } catch (error) {
    console.error('Portal requests error:', error);
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

// GET /portal/engagements/:engagementId/deliverables - Get issued deliverables for client portal
router.get('/portal/engagements/:engagementId/deliverables', requirePortalAuth, async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { clientId, firmId } = req.portalSession!;

    // Verify engagement belongs to the portal client AND firm
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, clientId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    // Only return ISSUED deliverables to clients - status and ownership already verified via engagement
    const deliverables = await prisma.deliverable.findMany({
      where: { 
        engagementId,
        status: 'ISSUED',
      },
      include: {
        files: {
          where: { isCurrentVersion: true },
          select: {
            id: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            fileSize: true,
            version: true,
            uploadedAt: true,
          },
        },
        issuedBy: { select: { fullName: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });

    res.json(deliverables);
  } catch (error) {
    console.error('Portal deliverables error:', error);
    res.status(500).json({ error: 'Failed to load deliverables' });
  }
});

// GET /portal/deliverables/:deliverableId/download/:fileId - Download deliverable file for client
router.get('/portal/deliverables/:deliverableId/download/:fileId', requirePortalAuth, async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { deliverableId, fileId } = req.params;
    const { clientId, firmId, portalContactId } = req.portalSession!;

    // Validate file belongs to ISSUED deliverable for client's engagement within their firm
    const file = await prisma.deliverableFile.findFirst({
      where: {
        id: fileId,
        deliverableId,
        deliverable: {
          status: 'ISSUED',
          engagement: { clientId, firmId },
        },
      },
      include: {
        deliverable: {
          include: { engagement: true },
        },
      },
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found or not available' });
    }

    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Log the download
    await prisma.clientPortalLog.create({
      data: {
        clientContactId: portalContactId,
        engagementId: file.deliverable.engagementId,
        activityType: 'DOWNLOAD_DELIVERABLE',
        activityDetails: JSON.stringify({ 
          deliverableId, 
          fileId, 
          fileName: file.originalName,
          deliverableType: file.deliverable.deliverableType,
        }),
      },
    });

    res.download(file.filePath, file.originalName);
  } catch (error) {
    console.error('Portal deliverable download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

router.post('/portal/requests/:requestId/respond', requirePortalAuth, async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { clientResponse } = z.object({ clientResponse: z.string().min(1) }).parse(req.body);
    const { clientId, portalContactId } = req.portalSession!;

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, clientId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const updated = await prisma.informationRequest.update({
      where: { id: requestId },
      data: {
        clientResponse,
        clientResponseDate: new Date(),
        clientContactId: portalContactId,
        status: 'IN_PROGRESS',
      },
    });

    await prisma.clientPortalLog.create({
      data: {
        clientContactId: portalContactId,
        engagementId: request.engagementId,
        activityType: 'RESPOND_REQUEST',
        activityDetails: JSON.stringify({ requestId, requestTitle: request.requestTitle }),
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid response' });
    }
    console.error('Portal respond error:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

router.post('/portal/requests/:requestId/upload', requirePortalAuth, upload.single('file'), async (req: PortalAuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { clientId, portalContactId } = req.portalSession!;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, clientId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const existingCount = await prisma.requestAttachment.count({
      where: { requestId, fileName: req.file.originalname },
    });

    const attachment = await prisma.requestAttachment.create({
      data: {
        requestId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath: req.file.path,
        versionNumber: existingCount + 1,
        isActive: true,
        uploadedByContactId: portalContactId,
      },
    });

    if (existingCount > 0) {
      await prisma.requestAttachment.updateMany({
        where: {
          requestId,
          fileName: req.file.originalname,
          id: { not: attachment.id },
        },
        data: { isActive: false },
      });
    }

    await prisma.clientPortalLog.create({
      data: {
        clientContactId: portalContactId,
        engagementId: request.engagementId,
        activityType: 'UPLOAD_ATTACHMENT',
        activityDetails: JSON.stringify({ requestId, fileName: req.file.originalname, version: existingCount + 1 }),
      },
    });

    res.json(attachment);
  } catch (error) {
    console.error('Portal upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

const InvitationSchema = z.object({
  email: z.string().email(),
  clientName: z.string().optional(),
  engagementType: z.string().optional(),
  financialYear: z.string().optional(),
  clientId: z.string().optional(),
  expiryDays: z.number().min(1).max(30).default(7),
});

const PortalContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  designation: z.string().optional(),
  department: z.string().optional(),
  phoneMobile: z.string().optional(),
  phoneOffice: z.string().optional(),
  contactType: z.enum(['PRIMARY', 'FINANCIAL', 'ACCOUNTANT', 'DIRECTOR', 'GENERAL']).default('GENERAL'),
  isPrimaryContact: z.boolean().default(false),
  isFinancialContact: z.boolean().default(false),
  isAuthorizedSignatory: z.boolean().default(false),
});

const InformationRequestSchema = z.object({
  requestTitle: z.string().min(1),
  headOfAccounts: z.enum([
    'CORPORATE_DOCUMENTS', 'FINANCIAL_STATEMENTS', 'BANK_INFORMATION', 'FIXED_ASSETS',
    'INVENTORY', 'RECEIVABLES', 'PAYABLES', 'LOANS_BORROWINGS', 'EQUITY', 'REVENUE',
    'COST_OF_SALES', 'OPERATING_EXPENSES', 'TAXATION', 'PAYROLL', 'RELATED_PARTY',
    'LEGAL_MATTERS', 'INSURANCE', 'LEASES', 'INVESTMENTS', 'OTHER'
  ]),
  financialStatementCategory: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW', 'EQUITY_CHANGES', 'NOTES', 'OTHER']).optional(),
  auditAssertion: z.enum(['EXISTENCE', 'COMPLETENESS', 'VALUATION', 'RIGHTS_OBLIGATIONS', 'PRESENTATION', 'ACCURACY', 'CUTOFF', 'CLASSIFICATION']).optional(),
  description: z.string().min(1),
  specificRequirements: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().optional(),
  formatFileName: z.string().optional(),
  formatFileUrl: z.string().optional(),
  formatInstructions: z.string().optional(),
});

const ClientResponseSchema = z.object({
  clientResponse: z.string().optional(),
  provided: z.enum(['YES', 'NO']).optional(),
});

const FirmRequestUpdateSchema = z.object({
  headOfAccounts: z.enum([
    'CORPORATE_DOCUMENTS', 'FINANCIAL_STATEMENTS', 'BANK_INFORMATION', 'FIXED_ASSETS',
    'INVENTORY', 'RECEIVABLES', 'PAYABLES', 'LOANS_BORROWINGS', 'EQUITY', 'REVENUE',
    'COST_OF_SALES', 'OPERATING_EXPENSES', 'TAXATION', 'PAYROLL', 'RELATED_PARTY',
    'LEGAL_MATTERS', 'INSURANCE', 'LEASES', 'INVESTMENTS', 'OTHER'
  ]).optional(),
  description: z.string().optional(),
  requestTitle: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().optional(),
  specificRequirements: z.string().optional(),
});

router.post('/invitations', requireAuth, requireMinRole('MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const parsed = InvitationSchema.parse(req.body);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + parsed.expiryDays * 24 * 60 * 60 * 1000);

    const invitation = await prisma.clientPortalInvitation.create({
      data: {
        firmId,
        clientId: parsed.clientId || undefined,
        token,
        email: parsed.email,
        clientName: parsed.clientName,
        engagementType: parsed.engagementType,
        financialYear: parsed.financialYear,
        invitedById: req.user!.id,
        expiresAt,
      },
    });

    await logAuditTrail(
      req.user!.id,
      'CREATE',
      'ClientPortalInvitation',
      invitation.id,
      undefined,
      { email: parsed.email, clientName: parsed.clientName },
      undefined
    );

    res.status(201).json({
      id: invitation.id,
      token: invitation.token,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      portalUrl: `/portal/onboarding?token=${token}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Portal invitation error:', error);
    res.status(500).json({ error: 'Failed to create portal invitation' });
  }
});

router.get('/invitations', requireAuth, requireMinRole('MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const invitations = await prisma.clientPortalInvitation.findMany({
      where: { firmId },
      include: {
        invitedBy: { select: { id: true, fullName: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invitations);
  } catch (error) {
    console.error('Fetch invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

router.get('/invitations/validate/:token', async (req, res: Response) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.clientPortalInvitation.findUnique({
      where: { token },
      include: {
        firm: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation token' });
    }

    if (invitation.used) {
      return res.status(400).json({ error: 'This invitation has already been used' });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    res.json({
      valid: true,
      email: invitation.email,
      clientName: invitation.clientName,
      engagementType: invitation.engagementType,
      financialYear: invitation.financialYear,
      firmName: invitation.firm.name,
      existingClient: invitation.client ? { id: invitation.client.id, name: invitation.client.name } : undefined,
    });
  } catch (error) {
    console.error('Validate token error:', error);
    res.status(500).json({ error: 'Failed to validate invitation' });
  }
});

router.get('/engagements/:engagementId/contacts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { clientId: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const contacts = await prisma.clientPortalContact.findMany({
      where: { clientId: engagement.clientId, firmId, deletedAt: null },
      orderBy: [{ isPrimaryContact: 'desc' }, { firstName: 'asc' }],
    });

    res.json(contacts);
  } catch (error) {
    console.error('Fetch contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.post('/engagements/:engagementId/contacts', requireAuth, requireMinRole('SENIOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { clientId: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const parsed = PortalContactSchema.parse(req.body);

    const existingContact = await prisma.clientPortalContact.findFirst({
      where: { clientId: engagement.clientId, email: parsed.email },
    });

    if (existingContact) {
      return res.status(400).json({ error: 'A contact with this email already exists for this client' });
    }

    const contact = await prisma.clientPortalContact.create({
      data: {
        firmId,
        clientId: engagement.clientId,
        ...parsed,
      },
    });

    await logAuditTrail(
      req.user!.id,
      'CREATE',
      'ClientPortalContact',
      contact.id,
      engagementId,
      parsed,
      undefined
    );

    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.get('/engagements/:engagementId/requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const requests = await prisma.informationRequest.findMany({
      where: { engagementId, deletedAt: null },
      include: {
        clientContact: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewer: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
        attachments: {
          where: { isActive: true },
          orderBy: { versionNumber: 'desc' },
        },
        _count: { select: { attachments: true } },
      },
      orderBy: { srNumber: 'asc' },
    });

    res.json(requests);
  } catch (error) {
    console.error('Fetch requests error:', error);
    res.status(500).json({ error: 'Failed to fetch information requests' });
  }
});

router.post('/engagements/:engagementId/requests', requireAuth, requireMinRole('SENIOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      select: { id: true, clientId: true, engagementCode: true },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const parsed = InformationRequestSchema.parse(req.body);

    const lastRequest = await prisma.informationRequest.findFirst({
      where: { engagementId },
      orderBy: { srNumber: 'desc' },
      select: { srNumber: true },
    });

    const newSrNumber = (lastRequest?.srNumber || 0) + 1;
    const requestCode = `${engagement.engagementCode}-IR-${String(newSrNumber).padStart(4, '0')}`;

    const request = await prisma.informationRequest.create({
      data: {
        firmId,
        engagementId,
        clientId: engagement.clientId,
        requestCode,
        srNumber: newSrNumber,
        requestTitle: parsed.requestTitle,
        headOfAccounts: parsed.headOfAccounts,
        financialStatementCategory: parsed.financialStatementCategory,
        auditAssertion: parsed.auditAssertion,
        description: parsed.description,
        specificRequirements: parsed.specificRequirements,
        priority: parsed.priority,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        formatAvailable: !!(parsed.formatFileName || parsed.formatFileUrl),
        formatFileName: parsed.formatFileName,
        formatFileUrl: parsed.formatFileUrl,
        formatInstructions: parsed.formatInstructions,
        createdById: req.user!.id,
      },
    });

    await logAuditTrail(
      req.user!.id,
      'CREATE',
      'InformationRequest',
      request.id,
      engagementId,
      { srNumber: newSrNumber, ...parsed },
      undefined
    );

    res.status(201).json(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Failed to create information request' });
  }
});

router.put('/requests/:requestId', requireAuth, requireMinRole('SENIOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const existingRequest = await prisma.informationRequest.findFirst({
      where: { id: requestId, firmId },
    });

    if (!existingRequest) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const parsed = InformationRequestSchema.partial().parse(req.body);

    const updated = await prisma.informationRequest.update({
      where: { id: requestId },
      data: {
        ...parsed,
        dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
        formatAvailable: !!(parsed.formatFileName || parsed.formatFileUrl),
        updatedById: req.user!.id,
      },
    });

    await logAuditTrail(
      req.user!.id,
      'UPDATE',
      'InformationRequest',
      requestId,
      existingRequest.engagementId,
      parsed,
      undefined
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Update request error:', error);
    res.status(500).json({ error: 'Failed to update information request' });
  }
});

router.post('/requests/:requestId/response', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, firmId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const parsed = ClientResponseSchema.parse(req.body);

    const updateData: any = {
      updatedById: req.user!.id,
    };

    if (parsed.clientResponse !== undefined) {
      updateData.clientResponse = parsed.clientResponse;
      updateData.clientResponseDate = new Date();
      updateData.status = 'SUBMITTED';
    }

    if (parsed.provided !== undefined) {
      updateData.provided = parsed.provided;
      if (parsed.provided === 'YES') {
        updateData.providedDate = new Date();
      } else {
        updateData.providedDate = null;
      }
    }

    const updated = await prisma.informationRequest.update({
      where: { id: requestId },
      data: updateData,
    });

    await logAuditTrail(
      req.user!.id,
      'UPDATE',
      'InformationRequest',
      requestId,
      request.engagementId,
      { action: 'CLIENT_RESPONSE_SUBMITTED' },
      undefined
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Submit response error:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

router.post('/requests/:requestId/review', requireAuth, requireMinRole('SENIOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const { reviewNotes, reviewStatus } = req.body;

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, firmId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const newStatus = reviewStatus === 'APPROVED' ? 'COMPLETED' : reviewStatus === 'REJECTED' ? 'REJECTED' : 'UNDER_REVIEW';

    const updated = await prisma.informationRequest.update({
      where: { id: requestId },
      data: {
        reviewNotes,
        reviewStatus,
        reviewDate: new Date(),
        reviewerId: req.user!.id,
        status: newStatus,
      },
    });

    await logAuditTrail(
      req.user!.id,
      'UPDATE',
      'InformationRequest',
      requestId,
      request.engagementId,
      { reviewStatus, reviewNotes },
      undefined
    );

    res.json(updated);
  } catch (error) {
    console.error('Review request error:', error);
    res.status(500).json({ error: 'Failed to review request' });
  }
});

router.post('/requests/:requestId/attachments', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, firmId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const lastAttachment = await prisma.requestAttachment.findFirst({
      where: { requestId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const newVersionNumber = (lastAttachment?.versionNumber || 0) + 1;

    const attachment = await prisma.requestAttachment.create({
      data: {
        requestId,
        versionNumber: newVersionNumber,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: BigInt(req.file.size),
        storagePath: req.file.path,
        uploadedById: req.user!.id,
        uploadedByType: 'INTERNAL',
        uploadNotes: req.body.uploadNotes || undefined,
      },
    });

    if (request.status === 'PENDING') {
      await prisma.informationRequest.update({
        where: { id: requestId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    await logAuditTrail(
      req.user!.id,
      'CREATE',
      'RequestAttachment',
      attachment.id,
      request.engagementId,
      { fileName: req.file.originalname, versionNumber: newVersionNumber },
      undefined
    );

    res.status(201).json({
      id: attachment.id,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize?.toString() || '0',
      versionNumber: attachment.versionNumber,
      uploadedAt: attachment.uploadedAt,
    });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

router.get('/requests/:requestId/attachments', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, firmId },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const attachments = await prisma.requestAttachment.findMany({
      where: { requestId },
      include: {
        uploadedBy: { select: { id: true, fullName: true } },
        uploadedByContact: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });

    res.json(attachments.map(a => ({
      ...a,
      fileSize: a.fileSize?.toString(),
    })));
  } catch (error) {
    console.error('Fetch attachments error:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

router.get('/attachments/:attachmentId/download', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const attachment = await prisma.requestAttachment.findFirst({
      where: { id: attachmentId },
      include: {
        request: { select: { firmId: true, engagementId: true } },
      },
    });

    if (!attachment || attachment.request.firmId !== firmId) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    if (!fs.existsSync(attachment.storagePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    await logAuditTrail(
      req.user!.id,
      'VIEW',
      'RequestAttachment',
      attachmentId,
      attachment.request.engagementId,
      { fileName: attachment.fileName },
      undefined
    );

    res.download(attachment.storagePath, attachment.fileName);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

router.post('/attachments/:attachmentId/flag', requireAuth, requireMinRole('SENIOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const { reason } = req.body;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const attachment = await prisma.requestAttachment.findFirst({
      where: { id: attachmentId },
      include: { request: { select: { firmId: true, engagementId: true } } },
    });

    if (!attachment || attachment.request.firmId !== firmId) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const updated = await prisma.requestAttachment.update({
      where: { id: attachmentId },
      data: {
        markedInappropriate: true,
        markedInappropriateById: req.user!.id,
        markedInappropriateAt: new Date(),
        inappropriateReason: reason,
        isActive: false,
      },
    });

    await logAuditTrail(
      req.user!.id,
      'UPDATE',
      'RequestAttachment',
      attachmentId,
      attachment.request.engagementId,
      { action: 'FLAGGED_INAPPROPRIATE', reason },
      undefined
    );

    res.json(updated);
  } catch (error) {
    console.error('Flag attachment error:', error);
    res.status(500).json({ error: 'Failed to flag attachment' });
  }
});

router.get('/engagements/:engagementId/dashboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: {
        client: { select: { id: true, name: true, tradingName: true } },
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const [totalRequests, statusCounts, headOfAccountsCounts, recentActivity] = await Promise.all([
      prisma.informationRequest.count({ where: { engagementId, deletedAt: null } }),
      prisma.informationRequest.groupBy({
        by: ['status'],
        where: { engagementId, deletedAt: null },
        _count: true,
      }),
      prisma.informationRequest.groupBy({
        by: ['headOfAccounts'],
        where: { engagementId, deletedAt: null },
        _count: true,
      }),
      prisma.clientPortalLog.findMany({
        where: { engagementId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          clientContact: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const statusMap = statusCounts.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    const completionRate = totalRequests > 0
      ? Math.round(((statusMap['COMPLETED'] || 0) / totalRequests) * 100)
      : 0;

    res.json({
      engagement: {
        id: engagement.id,
        code: engagement.engagementCode,
        client: engagement.client,
        periodStart: engagement.periodStart,
        periodEnd: engagement.periodEnd,
      },
      stats: {
        totalRequests,
        pending: statusMap['PENDING'] || 0,
        inProgress: statusMap['IN_PROGRESS'] || 0,
        submitted: statusMap['SUBMITTED'] || 0,
        underReview: statusMap['UNDER_REVIEW'] || 0,
        completed: statusMap['COMPLETED'] || 0,
        rejected: statusMap['REJECTED'] || 0,
        completionRate,
      },
      headOfAccountsBreakdown: headOfAccountsCounts.map(h => ({
        headOfAccounts: h.headOfAccounts,
        count: h._count,
      })),
      recentActivity,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/engagements/:engagementId/activity-log', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const { limit = '50', offset = '0' } = req.query;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
    });

    if (!engagement) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const logs = await prisma.clientPortalLog.findMany({
      where: { engagementId },
      include: {
        clientContact: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json(logs);
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

router.get('/head-of-accounts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const headOfAccounts = [
    { value: 'CORPORATE_DOCUMENTS', label: 'Corporate Documents', category: 'General' },
    { value: 'FINANCIAL_STATEMENTS', label: 'Financial Statements', category: 'General' },
    { value: 'BANK_INFORMATION', label: 'Bank Information', category: 'Assets' },
    { value: 'FIXED_ASSETS', label: 'Fixed Assets', category: 'Assets' },
    { value: 'INVENTORY', label: 'Inventory', category: 'Assets' },
    { value: 'RECEIVABLES', label: 'Receivables', category: 'Assets' },
    { value: 'PAYABLES', label: 'Payables', category: 'Liabilities' },
    { value: 'LOANS_BORROWINGS', label: 'Loans & Borrowings', category: 'Liabilities' },
    { value: 'EQUITY', label: 'Equity', category: 'Equity' },
    { value: 'REVENUE', label: 'Revenue', category: 'Income' },
    { value: 'COST_OF_SALES', label: 'Cost of Sales', category: 'Expenses' },
    { value: 'OPERATING_EXPENSES', label: 'Operating Expenses', category: 'Expenses' },
    { value: 'TAXATION', label: 'Taxation', category: 'Compliance' },
    { value: 'PAYROLL', label: 'Payroll', category: 'Expenses' },
    { value: 'RELATED_PARTY', label: 'Related Party Transactions', category: 'Disclosure' },
    { value: 'LEGAL_MATTERS', label: 'Legal Matters', category: 'Disclosure' },
    { value: 'INSURANCE', label: 'Insurance', category: 'General' },
    { value: 'LEASES', label: 'Leases', category: 'Assets' },
    { value: 'INVESTMENTS', label: 'Investments', category: 'Assets' },
    { value: 'OTHER', label: 'Other', category: 'General' },
  ];

  res.json(headOfAccounts);
});

router.post('/requests/:requestId/generate-guidance', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, firmId },
      include: {
        engagement: { select: { id: true } },
        client: { select: { industry: true } },
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const guidance = await generateGuidance({
      requestTitle: request.requestTitle,
      headOfAccounts: request.headOfAccounts,
      description: request.description,
      specificRequirements: request.specificRequirements || undefined,
      financialStatementCategory: request.financialStatementCategory || undefined,
      auditAssertion: request.auditAssertion || undefined,
      clientIndustry: request.client?.industry || undefined,
    }, request.engagement.id);

    await prisma.informationRequest.update({
      where: { id: requestId },
      data: { aiGeneratedGuidance: guidance.guidance },
    });

    res.json(guidance);
  } catch (error) {
    console.error('Generate guidance error:', error);
    res.status(500).json({ error: 'Failed to generate guidance' });
  }
});

router.post('/requests/:requestId/check-completeness', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const request = await prisma.informationRequest.findFirst({
      where: { id: requestId, firmId },
      include: {
        attachments: { where: { isActive: true } },
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (!request.clientResponse) {
      return res.status(400).json({ error: 'No client response to check' });
    }

    const completenessResult = await checkCompleteness({
      requestTitle: request.requestTitle,
      headOfAccounts: request.headOfAccounts,
      description: request.description,
      specificRequirements: request.specificRequirements || undefined,
      clientResponse: request.clientResponse,
      attachmentCount: request.attachments.length,
      attachmentTypes: request.attachments.map(a => a.fileType || 'unknown'),
    }, requestId);

    await prisma.informationRequest.update({
      where: { id: requestId },
      data: {
        aiCompletenessScore: completenessResult.score,
        aiQualityScore: completenessResult.qualityScore,
        aiSuggestedImprovements: completenessResult.suggestions.join('; '),
      },
    });

    res.json(completenessResult);
  } catch (error) {
    console.error('Completeness check error:', error);
    res.status(500).json({ error: 'Failed to check completeness' });
  }
});

router.post('/attachments/:attachmentId/analyze', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const firmId = req.user!.firmId;
    if (!firmId) return res.status(400).json({ error: 'User not associated with a firm' });

    const attachment = await prisma.requestAttachment.findFirst({
      where: { id: attachmentId },
      include: { request: { select: { firmId: true, id: true } } },
    });

    if (!attachment || attachment.request.firmId !== firmId) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const analysis = await analyzeDocument(
      attachment.fileName,
      attachment.fileType || 'unknown',
      attachment.request.id
    );

    await prisma.requestAttachment.update({
      where: { id: attachmentId },
      data: {
        aiDocumentType: analysis.documentType,
        aiExtractedData: analysis.extractedData as unknown as any,
        aiVerificationStatus: analysis.verificationStatus,
      },
    });

    res.json(analysis);
  } catch (error) {
    console.error('Analyze document error:', error);
    res.status(500).json({ error: 'Failed to analyze document' });
  }
});

export default router;
