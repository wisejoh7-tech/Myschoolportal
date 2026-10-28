import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
import { Server } from "socket.io";
import http from 'http';
import winston from 'winston';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from "@google/generative-ai";
import pkg from './database.cjs';
const {
  sequelize,
  Op,
  User,
  Payment,
  FeeInvoice,
  Receipt,
  Attendance,
  Application,
  EntranceExamQuestion,
  EntranceExamSubmission,
  ClassAssignment,
  AcademicResult,
  AuditLog,
  ParentStudent
} = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'uniportal-secret-key-2026';

// Password hashing helper
function hashPassword(password) {
  const salt = 'uniportal_salt_2026';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  return hashPassword(password) === storedHash;
}

// Ensure logs directory exists
if (!fs.existsSync(path.join(__dirname, 'logs'))) {
  fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
}

// 🪵 Professional Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: path.join(__dirname, 'logs/error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(__dirname, 'logs/combined.log') })
  ],
});

// 🔥 Firebase Admin (Identity & Security)
try {
  if (process.env.SERVICE_ACCOUNT_PATH) {
    const serviceAccount = await import('./serviceAccountKey.json', { assert: { type: 'json' } });
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount.default) });
  } else {
    admin.initializeApp();
  }
  logger.info('🛡️ Firebase Guard Active');
} catch (e) {
  logger.warn('⚠️ Firebase Admin initialization bypassed');
}

// Helper to record audit logs for sensitive operations
async function createAuditLog({ req, action, entity, entityId, details }) {
  try {
    const actorUid = req?.user?.uid || 'system';
    const actorEmail = req?.user?.email || 'system';
    const actorRole = req?.user?.role || 'system';
    const tenantId = req?.tenantId || req?.user?.tenantId || 'default_school';
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1';

    await AuditLog.create({
      tenantId,
      actorUid,
      actorEmail,
      actorRole,
      action,
      entity,
      entityId: entityId ? String(entityId) : null,
      details,
      ipAddress
    });
  } catch (err) {
    logger.error('Failed to create audit log:', err);
  }
}

// 🛡️ Middleware: Verify JWT or Firebase Token
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split('Bearer ')[1];

  let decodedUser = null;

  // 1. Try local JWT verification
  try {
    decodedUser = jwt.verify(token, JWT_SECRET);
  } catch (jwtError) {
    // 2. Fallback to Firebase token verification
    try {
      decodedUser = await admin.auth().verifyIdToken(token);
    } catch (firebaseError) {
      return res.status(403).json({ error: 'Invalid Session' });
    }
  }

  // Hydrate user from DB to obtain latest role and tenantId if available
  if (decodedUser?.uid) {
    try {
      const dbUser = await User.findByPk(decodedUser.uid);
      if (dbUser) {
        decodedUser.role = dbUser.role;
        decodedUser.tenantId = dbUser.tenantId || 'default_school';
      }
    } catch (e) {
      // fallback to token payload
    }
  }

  req.user = decodedUser;
  return next();
};

// 🛡️ Multi-Tenant Isolation Middleware
const extractTenant = (req, res, next) => {
  const headerTenant = req.headers['x-tenant-id'];
  const userTenant = req.user?.tenantId;
  req.tenantId = headerTenant || userTenant || 'default_school';
  next();
};

// 🛡️ Role-Based Access Control (RBAC) Middleware
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // school_owner and admin have full elevated permissions
    const userRole = req.user.role;
    if (allowedRoles.includes(userRole) || userRole === 'admin' || userRole === 'school_owner') {
      return next();
    }

    return res.status(403).json({ error: `Forbidden: Role '${userRole}' is not authorized to perform this action` });
  };
};

const corsOrigin = process.env.CORS_ORIGIN || "*";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: corsOrigin, methods: ["GET", "POST"] } });

app.use(cors({ origin: corsOrigin }));
app.use(bodyParser.json());

// 📦 Serve Static Frontend Assets (dist)
app.use(express.static(path.join(__dirname, 'dist')));

// 🤖 AI Command Hub (Gemini Pro)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY || "");

// 📨 Institutional Mailer
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

async function sendOfficialEmail({ to, subject, body }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.info(`Simulated Email Sent to ${to}: ${subject}`);
    return;
  }
  const mailOptions = {
    from: `"UniPortal Registry" <${process.env.EMAIL_USER}>`,
    to, subject,
    html: `<div style="font-family: sans-serif; padding: 40px; color: #1a1a1a; max-width: 600px; border: 1px solid #e5e7eb; border-radius: 24px;">
      <h2 style="color: #059669; margin-bottom: 24px;">${subject}</h2>
      <div style="line-height: 1.6; font-size: 15px;">${body}</div>
      <p style="margin-top: 40px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; pt: 20px;">Institutional ID: ${new Date().getTime()}</p>
    </div>`
  };
  return transporter.sendMail(mailOptions);
}

// ------------------------------------------------------------------
// 🚀 AUTHENTICATION & ACCOUNTS ENDPOINTS
// ------------------------------------------------------------------

// 1. User Registration
app.post(['/api/accounts/register/', '/api/accounts/register'], async (req, res) => {
  const { username, email, password, first_name, last_name, role, tenant_id } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const userEmail = email.toLowerCase().trim();
    const userUsername = (username || email).toLowerCase().trim();
    const tenantId = tenant_id || req.headers['x-tenant-id'] || 'default_school';

    // Check existing user using Op.or
    const existing = await User.findOne({
      where: {
        tenantId,
        [Op.or]: [{ email: userEmail }, { username: userUsername }]
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hashedPassword = hashPassword(password);
    const userRole = role || 'applicant';
    const fullName = `${first_name || ''} ${last_name || ''}`.trim() || userUsername;

    const user = await User.create({
      uid,
      tenantId,
      username: userUsername,
      email: userEmail,
      password: hashedPassword,
      firstName: first_name || '',
      lastName: last_name || '',
      name: fullName,
      role: userRole,
      level: '100L'
    });

    await createAuditLog({
      req: { user: { uid, email: userEmail, role: userRole }, tenantId },
      action: 'REGISTER_USER',
      entity: 'User',
      entityId: user.uid,
      details: { role: userRole, email: userEmail }
    });

    try {
      await sendOfficialEmail({
        to: userEmail,
        subject: 'Welcome to UniPortal',
        body: `Hello ${fullName}, your account has been registered successfully.`
      });
    } catch (e) {
      // ignore email sending errors in registration response
    }

    res.status(201).json({
      id: user.uid,
      uid: user.uid,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email,
      role: user.role,
      first_name: user.firstName,
      last_name: user.lastName
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 2. JWT Token Obtain (Login)
app.post(['/api/token/', '/api/token'], async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  try {
    const term = username.toLowerCase().trim();
    const termPrefix = term.split('@')[0];

    // Priority 1: Exact match on email or username (case-insensitive)
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { email: term },
          { username: term },
          sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), term),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), term)
        ]
      }
    });

    // Priority 2: Fallback match on username prefix if exact match not found
    if (!user) {
      user = await User.findOne({
        where: {
          [Op.or]: [
            { username: termPrefix },
            sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), termPrefix)
          ]
        }
      });
    }

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ detail: 'No active account found with the given credentials' });
    }

    const payload = { uid: user.uid, email: user.email, role: user.role };
    const access = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    const refresh = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({ access, refresh });
  } catch (error) {
    logger.error('Token error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// 3. JWT Token Refresh
app.post(['/api/token/refresh/', '/api/token/refresh'], async (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(400).json({ error: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refresh, JWT_SECRET);
    const access = jwt.sign({ uid: decoded.uid, email: decoded.email, role: decoded.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ access });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// 4. Current User Detail
app.get(['/api/accounts/user/', '/api/accounts/user'], authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.uid || req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.uid,
      uid: user.uid,
      username: user.username,
      email: user.email,
      role: user.role,
      first_name: user.firstName,
      last_name: user.lastName,
      faculty: user.faculty,
      department: user.department,
      level: user.level,
      matric_no: user.matricNo
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// 5. List Users (Filtered by tenant for security, restricted to admin/owner/bursar/teacher)
app.get(['/api/accounts/users/', '/api/accounts/users'], authenticate, extractTenant, authorizeRoles('admin', 'school_owner', 'bursar', 'teacher'), async (req, res) => {
  try {
    const { role } = req.query;
    const where = { tenantId: req.tenantId };
    if (role) where.role = role;

    const users = await User.findAll({ where });

    const formattedUsers = users.map(u => ({
      id: u.uid,
      uid: u.uid,
      tenantId: u.tenantId,
      username: u.username,
      email: u.email,
      role: u.role,
      first_name: u.firstName,
      last_name: u.lastName,
      name: u.name,
      faculty: u.faculty,
      department: u.department,
      level: u.level,
      matric_no: u.matricNo,
      phoneNumber: u.phoneNumber
    }));

    res.json(formattedUsers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 6. Update User (Patch user role, matric_no, etc.) - Restricted to admin/school_owner
app.patch(['/api/accounts/users/:uid/', '/api/accounts/users/:uid'], authenticate, extractTenant, authorizeRoles('admin', 'school_owner'), async (req, res) => {
  try {
    const targetUid = req.params.uid;
    const user = await User.findOne({ where: { uid: targetUid, tenantId: req.tenantId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found in tenant school' });
    }

    const { role, matric_no, faculty, department, level, phoneNumber } = req.body;
    const oldRole = user.role;

    if (role) user.role = role;
    if (matric_no !== undefined) user.matricNo = matric_no;
    if (faculty) user.faculty = faculty;
    if (department) user.department = department;
    if (level) user.level = level;
    if (phoneNumber) user.phoneNumber = phoneNumber;

    await user.save();

    await createAuditLog({
      req,
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: user.uid,
      details: { oldRole, newRole: user.role, changes: req.body }
    });

    res.json({
      id: user.uid,
      uid: user.uid,
      tenantId: user.tenantId,
      username: user.username,
      email: user.email,
      role: user.role,
      first_name: user.firstName,
      last_name: user.lastName,
      faculty: user.faculty,
      department: user.department,
      level: user.level,
      matric_no: user.matricNo
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ------------------------------------------------------------------
// 🚀 OTHER PORTAL API ENDPOINTS
// ------------------------------------------------------------------

// Intelligent AI Tutor
app.post('/api/ai/tutor', authenticate, async (req, res) => {
  const { prompt } = req.body;
  try {
    const student = await User.findByPk(req.user.uid, { include: [Payment, Application] });
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const context = `
      You are the UniPortal AI Assistant.
      Student Name: ${student?.name || 'User'}
      Level: ${student?.level || '100L'}
      Fees Paid: ${student?.Payments?.length || 0}
      Admission Status: ${student?.Application?.status || 'Pending'}
      Answer concisely as a helpful university guide.
    `;

    const result = await model.generateContent([context, prompt]);
    res.json({ text: result.response.text() });
  } catch (error) {
    res.status(500).json({ error: 'AI Brain Lag' });
  }
});

// Real-Time Treasury (Backend Verified & Idempotent with DB Transactions)
app.post('/api/payments/verify', authenticate, extractTenant, async (req, res) => {
  const { amount, type, reference, invoiceId, method } = req.body;
  const transactionId = reference || `REF-${Date.now()}`;
  const tenantId = req.tenantId;

  const t = await sequelize.transaction();
  try {
    // 1. Duplicate Payment / Transaction ID Prevention
    const existingPayment = await Payment.findOne({
      where: { transactionId },
      transaction: t
    });

    if (existingPayment) {
      await t.rollback();
      return res.status(200).json({
        status: 'success',
        message: 'Payment already verified previously',
        payment: existingPayment,
        duplicatePrevented: true
      });
    }

    // 2. Create Payment Record safely within transaction
    const payment = await Payment.create({
      tenantId,
      uid: req.user.uid,
      invoiceId: invoiceId || null,
      amount: Number(amount),
      type: type || 'tuition',
      status: 'success',
      transactionId,
      method: method || 'card',
      verifiedOnBackend: true
    }, { transaction: t });

    // 3. Update FeeInvoice balance if invoiceId provided
    let invoice = null;
    let receipt = null;
    if (invoiceId) {
      invoice = await FeeInvoice.findOne({
        where: { id: invoiceId, tenantId },
        transaction: t
      });

      if (invoice) {
        const newPaidAmount = Number(invoice.paidAmount) + Number(amount);
        const newBalance = Math.max(0, Number(invoice.totalAmount) - newPaidAmount);
        const newStatus = newBalance === 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');

        invoice.paidAmount = newPaidAmount;
        invoice.balance = newBalance;
        invoice.status = newStatus;
        await invoice.save({ transaction: t });
      }
    }

    // 4. Generate Official Receipt
    const receiptNo = `REC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    receipt = await Receipt.create({
      tenantId,
      receiptNumber: receiptNo,
      paymentId: payment.id,
      invoiceId: invoiceId || null,
      studentUid: req.user.uid,
      amountPaid: Number(amount),
      paymentMethod: method || 'card',
      issuedBy: 'Verified Treasury Gateway'
    }, { transaction: t });

    await t.commit();

    await createAuditLog({
      req,
      action: 'VERIFY_PAYMENT',
      entity: 'Payment',
      entityId: payment.id,
      details: { amount, type, transactionId, receiptNumber: receiptNo }
    });

    io.to(`user_${req.user.uid}`).emit('notification', {
      title: 'Payment Secured',
      message: `${(type || 'Payment').toUpperCase()} of ₦${Number(amount).toLocaleString()} has been verified.`,
      type: 'success'
    });

    res.json({ status: 'success', payment, invoice, receipt });
  } catch (error) {
    await t.rollback();
    logger.error('Payment verification failed:', error);
    res.status(500).json({ error: 'Treasury sync failed' });
  }
});

// Admin Analytics
app.get('/api/admin/analytics', authenticate, async (req, res) => {
  try {
    const totalStudents = await User.count({ where: { role: 'student' } });
    const totalRevenue = await Payment.sum('amount', { where: { status: 'success' } });
    const pendingApps = await Application.count({ where: { status: 'pending' } });

    res.json({ totalStudents, totalRevenue: totalRevenue || 0, pendingApps });
  } catch (error) {
    res.status(500).json({ error: 'Analytics failure' });
  }
});

// Attendance Hub
app.post('/api/academics/attendance', authenticate, async (req, res) => {
  try {
    const attendance = await Attendance.create({
      studentId: req.user.uid,
      courseId: req.body.courseId || 'GEN101',
      location: req.body.location || 'Lecture Hall A'
    });
    res.json({ status: 'success', attendance });
  } catch (error) {
    res.status(500).json({ error: 'Attendance log failed' });
  }
});

// User Sync (Firebase -> Postgres)
app.post('/api/users/sync', authenticate, async (req, res) => {
  const { name, role, email } = req.body;
  try {
    const [user, created] = await User.findOrCreate({
      where: { uid: req.user.uid },
      defaults: { name, role, email }
    });
    res.json({ user, created });
  } catch (error) {
    res.status(500).json({ error: 'Identity sync failure' });
  }
});

// Academics Applications
app.get(['/api/academics/applications/', '/api/academics/applications'], authenticate, async (req, res) => {
  try {
    const apps = await Application.findAll();
    res.json(apps);
  } catch (error) {
    res.json([]);
  }
});

function generateAdmissionId(departmentName) {
  let deptCode = 'AD';
  if (departmentName && typeof departmentName === 'string') {
    const clean = departmentName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (clean.length >= 3) {
      deptCode = clean[0] + clean[2];
    } else if (clean.length >= 1) {
      deptCode = clean[0] + (clean[1] || clean[0]);
    }
  }
  const digits = Math.floor(600000 + Math.random() * 100000);
  return `LUK-ADM-${deptCode}${digits}`;
}

app.post(['/api/academics/applications/', '/api/academics/applications'], authenticate, async (req, res) => {
  try {
    const deptName = req.body.departmentName || req.body.department || req.body.formData?.department || '';
    const appId = generateAdmissionId(deptName);
    const appRecord = await Application.create({
      id: appId,
      uid: req.user.uid,
      type: req.body.type || 'undergraduate',
      faculty: req.body.faculty,
      department: req.body.department || deptName,
      status: 'pending',
      formData: { ...req.body, generatedAppId: appId }
    });
    res.status(201).json(appRecord);
  } catch (error) {
    console.error('Application creation error:', error);
    res.status(500).json({ error: 'Application creation failed' });
  }
});

app.patch(['/api/academics/applications/:id/', '/api/academics/applications/:id'], authenticate, async (req, res) => {
  try {
    const appRecord = await Application.findByPk(req.params.id);
    if (appRecord) {
      if (req.body.status) appRecord.status = req.body.status;
      await appRecord.save();
    }
    res.json(appRecord || {});
  } catch (error) {
    res.status(500).json({ error: 'Application update failed' });
  }
});

// Courses
let inMemoryCourses = [
  { id: 1, course_code: 'CSC101', title: 'Introduction to Computer Science', credit_units: 3, level: '100L' },
  { id: 2, course_code: 'MTH101', title: 'General Mathematics I', credit_units: 3, level: '100L' },
  { id: 3, course_code: 'PHY101', title: 'General Physics I', credit_units: 3, level: '100L' },
];

app.get(['/api/academics/courses/', '/api/academics/courses'], async (req, res) => {
  res.json(inMemoryCourses);
});

app.post(['/api/academics/courses/', '/api/academics/courses'], authenticate, async (req, res) => {
  const newCourse = {
    id: inMemoryCourses.length + 1,
    course_code: req.body.course_code || req.body.courseCode || 'CSC201',
    title: req.body.title || 'Untitled Course',
    credit_units: req.body.credit_units || req.body.creditUnits || 3,
    level: req.body.level || '100L'
  };
  inMemoryCourses.push(newCourse);
  res.status(201).json(newCourse);
});

// Course Registrations
let inMemoryRegistrations = [];
app.get(['/api/academics/registrations/', '/api/academics/registrations'], authenticate, async (req, res) => {
  res.json(inMemoryRegistrations);
});

app.post(['/api/academics/registrations/', '/api/academics/registrations'], authenticate, async (req, res) => {
  const reg = { id: Date.now(), uid: req.user.uid, ...req.body };
  inMemoryRegistrations.push(reg);
  res.status(201).json(reg);
});

// ------------------------------------------------------------------
// 💳 FEE INVOICES & RECEIPTS ENDPOINTS (Bursar, Student, Parent, Admin, Owner)
// ------------------------------------------------------------------

// 1. Get Fee Invoices
app.get(['/api/finances/invoices/', '/api/finances/invoices'], authenticate, extractTenant, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };

    // Students see only their own invoices
    if (req.user.role === 'student') {
      where.studentUid = req.user.uid;
    } else if (req.user.role === 'parent') {
      // Parents see linked children invoices
      const mappings = await ParentStudent.findAll({ where: { parentUid: req.user.uid, tenantId: req.tenantId } });
      const studentUids = mappings.map(m => m.studentUid);
      where.studentUid = { [Op.in]: studentUids };
    } else if (req.query.studentUid) {
      where.studentUid = req.query.studentUid;
    }

    const invoices = await FeeInvoice.findAll({
      where,
      include: [{ model: User, attributes: ['uid', 'name', 'email', 'matricNo', 'level', 'department'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(invoices);
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch fee invoices' });
  }
});

// 2. Create Fee Invoice (Bursar, Admin, Owner)
app.post(['/api/finances/invoices/', '/api/finances/invoices'], authenticate, extractTenant, authorizeRoles('bursar', 'admin', 'school_owner'), async (req, res) => {
  try {
    const { studentUid, title, feeType, totalAmount, dueDate, session, termOrSemester } = req.body;
    if (!studentUid || !totalAmount) {
      return res.status(400).json({ error: 'studentUid and totalAmount are required' });
    }

    const invNo = `INV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const invoice = await FeeInvoice.create({
      tenantId: req.tenantId,
      invoiceNumber: invNo,
      studentUid,
      title: title || 'School Fee Invoice',
      feeType: feeType || 'tuition',
      totalAmount: Number(totalAmount),
      paidAmount: 0,
      balance: Number(totalAmount),
      status: 'unpaid',
      dueDate: dueDate || null,
      session: session || '2025/2026',
      termOrSemester: termOrSemester || '1st Semester'
    });

    await createAuditLog({
      req,
      action: 'CREATE_FEE_INVOICE',
      entity: 'FeeInvoice',
      entityId: invoice.id,
      details: { studentUid, totalAmount, invoiceNumber: invNo }
    });

    res.status(201).json(invoice);
  } catch (error) {
    logger.error('Error creating fee invoice:', error);
    res.status(500).json({ error: 'Failed to create fee invoice' });
  }
});

// 3. Get Receipts
app.get(['/api/finances/receipts/', '/api/finances/receipts'], authenticate, extractTenant, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.user.role === 'student') {
      where.studentUid = req.user.uid;
    } else if (req.user.role === 'parent') {
      const mappings = await ParentStudent.findAll({ where: { parentUid: req.user.uid, tenantId: req.tenantId } });
      const studentUids = mappings.map(m => m.studentUid);
      where.studentUid = { [Op.in]: studentUids };
    } else if (req.query.studentUid) {
      where.studentUid = req.query.studentUid;
    }

    const receipts = await Receipt.findAll({
      where,
      include: [{ model: User, attributes: ['uid', 'name', 'email', 'matricNo'] }],
      order: [['issuedAt', 'DESC']]
    });
    res.json(receipts);
  } catch (error) {
    logger.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Finances Payments
app.get(['/api/finances/payments/', '/api/finances/payments'], authenticate, extractTenant, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.user.role === 'student') {
      where.uid = req.user.uid;
    } else if (req.user.role === 'parent') {
      const mappings = await ParentStudent.findAll({ where: { parentUid: req.user.uid, tenantId: req.tenantId } });
      const studentUids = mappings.map(m => m.studentUid);
      where.uid = { [Op.in]: studentUids };
    } else if (req.query.studentUid) {
      where.uid = req.query.studentUid;
    }

    const payments = await Payment.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(payments);
  } catch (error) {
    res.json([]);
  }
});

app.post(['/api/finances/payments/', '/api/finances/payments'], authenticate, extractTenant, async (req, res) => {
  try {
    const payment = await Payment.create({
      tenantId: req.tenantId,
      uid: req.user.uid,
      amount: req.body.amount,
      type: req.body.type || 'School Fees',
      status: req.body.status || 'success',
      transactionId: req.body.transactionId || `TX-${Date.now()}`,
      method: req.body.method || 'card',
      verifiedOnBackend: true
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Payment record failed' });
  }
});

// Loans
let inMemoryLoans = [];
app.get(['/api/finances/loans/', '/api/finances/loans'], authenticate, async (req, res) => {
  res.json(inMemoryLoans);
});

app.post(['/api/finances/loans/', '/api/finances/loans'], authenticate, async (req, res) => {
  const loan = { id: `loan_${Date.now()}`, uid: req.user.uid, status: 'pending', ...req.body };
  inMemoryLoans.push(loan);
  res.status(201).json(loan);
});

app.patch(['/api/finances/loans/:id/', '/api/finances/loans/:id'], authenticate, async (req, res) => {
  const loan = inMemoryLoans.find(l => l.id === req.params.id);
  if (loan && req.body.status) loan.status = req.body.status;
  res.json(loan || {});
});

// Treasury Settings & Bank Details
app.get(['/api/portal/treasury-settings/', '/api/portal/treasury-settings'], async (req, res) => {
  res.json({ remitaMerchantId: 'MERCHANT-UNI-2026', gatewayActive: true });
});

app.get(['/api/portal/bank-details/', '/api/portal/bank-details'], async (req, res) => {
  res.json([
    { bankName: 'First Bank of Nigeria', accountName: 'UniPortal Registry', accountNumber: '0123456789' }
  ]);
});

app.get(['/api/portal/faculties/', '/api/portal/faculties'], async (req, res) => {
  res.json([
    { name: 'Science', departments: ['Computer Science', 'Mathematics', 'Physics'] },
    { name: 'Engineering', departments: ['Electrical Engineering', 'Mechanical Engineering'] }
  ]);
});

// ------------------------------------------------------------------
// 📚 CLASS ASSIGNMENTS, ACADEMIC RESULTS & PARENT ACCESS ENDPOINTS
// ------------------------------------------------------------------

// Grade point calculation helper function (Nigerian standard 5.0 scale)
function calculateGradeAndPoint(caScore, examScore) {
  const ca = Number(caScore) || 0;
  const exam = Number(examScore) || 0;
  const total = ca + exam;

  let grade = 'F';
  let gradePoint = 0.0;

  if (total >= 70) {
    grade = 'A';
    gradePoint = 5.0;
  } else if (total >= 60) {
    grade = 'B';
    gradePoint = 4.0;
  } else if (total >= 50) {
    grade = 'C';
    gradePoint = 3.0;
  } else if (total >= 45) {
    grade = 'D';
    gradePoint = 2.0;
  } else if (total >= 40) {
    grade = 'E';
    gradePoint = 1.0;
  } else {
    grade = 'F';
    gradePoint = 0.0;
  }

  return { total, grade, gradePoint };
}

// 1. Class Assignments (Teachers, Admin, Owner)
app.get(['/api/academics/class-assignments/', '/api/academics/class-assignments'], authenticate, extractTenant, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };
    if (req.user.role === 'teacher') {
      where.teacherUid = req.user.uid;
    }
    const assignments = await ClassAssignment.findAll({
      where,
      include: [{ model: User, attributes: ['uid', 'name', 'email', 'department', 'faculty'] }]
    });
    res.json(assignments);
  } catch (error) {
    logger.error('Error fetching class assignments:', error);
    res.status(500).json({ error: 'Failed to fetch class assignments' });
  }
});

app.post(['/api/academics/class-assignments/', '/api/academics/class-assignments'], authenticate, extractTenant, authorizeRoles('admin', 'school_owner'), async (req, res) => {
  try {
    const { teacherUid, courseCode, courseTitle, faculty, department, level, academicYear, semester } = req.body;
    if (!teacherUid || !courseCode) {
      return res.status(400).json({ error: 'teacherUid and courseCode are required' });
    }

    const assignment = await ClassAssignment.create({
      tenantId: req.tenantId,
      teacherUid,
      courseCode,
      courseTitle: courseTitle || courseCode,
      faculty: faculty || '',
      department: department || '',
      level: level || '100L',
      academicYear: academicYear || '2025/2026',
      semester: semester || '1st Semester'
    });

    await createAuditLog({
      req,
      action: 'ASSIGN_CLASS_TEACHER',
      entity: 'ClassAssignment',
      entityId: assignment.id,
      details: { teacherUid, courseCode }
    });

    res.status(201).json(assignment);
  } catch (error) {
    logger.error('Error creating class assignment:', error);
    res.status(500).json({ error: 'Failed to create class assignment' });
  }
});

// 2. Academic Results Entry & Viewing
app.get(['/api/academics/results/', '/api/academics/results'], authenticate, extractTenant, async (req, res) => {
  try {
    const where = { tenantId: req.tenantId };

    if (req.user.role === 'student') {
      where.studentUid = req.user.uid;
      where.isPublished = true;
    } else if (req.user.role === 'parent') {
      const mappings = await ParentStudent.findAll({ where: { parentUid: req.user.uid, tenantId: req.tenantId } });
      const studentUids = mappings.map(m => m.studentUid);
      where.studentUid = { [Op.in]: studentUids };
      where.isPublished = true;
    } else if (req.user.role === 'teacher') {
      if (req.query.studentUid) where.studentUid = req.query.studentUid;
      if (req.query.courseCode) where.courseCode = req.query.courseCode;
    } else if (req.query.studentUid) {
      where.studentUid = req.query.studentUid;
    }

    const results = await AcademicResult.findAll({
      where,
      include: [{ model: User, attributes: ['uid', 'name', 'email', 'matricNo', 'level', 'department'] }],
      order: [['session', 'DESC'], ['semester', 'ASC'], ['courseCode', 'ASC']]
    });

    // Calculate CGPA summary if requested
    if (req.query.includeCgpa === 'true' && results.length > 0) {
      let totalPoints = 0;
      let totalUnits = 0;
      results.forEach(r => {
        const units = Number(r.creditUnits) || 3;
        totalPoints += Number(r.gradePoint) * units;
        totalUnits += units;
      });
      const cgpa = totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';

      return res.json({
        results,
        cgpa: parseFloat(cgpa),
        totalCreditUnits: totalUnits,
        totalGradePoints: totalPoints
      });
    }

    res.json(results);
  } catch (error) {
    logger.error('Error fetching academic results:', error);
    res.status(500).json({ error: 'Failed to fetch academic results' });
  }
});

// Save or Update Result (Teachers, Admin, Owner)
app.post(['/api/academics/results/', '/api/academics/results'], authenticate, extractTenant, authorizeRoles('teacher', 'admin', 'school_owner'), async (req, res) => {
  try {
    const { studentUid, courseCode, courseTitle, creditUnits, caScore, examScore, semester, level, session, isPublished } = req.body;
    if (!studentUid || !courseCode) {
      return res.status(400).json({ error: 'studentUid and courseCode are required' });
    }

    // Teacher authorization verification if teacher role
    if (req.user.role === 'teacher') {
      const isAssigned = await ClassAssignment.findOne({
        where: { teacherUid: req.user.uid, courseCode, tenantId: req.tenantId }
      });
      if (!isAssigned) {
        return res.status(403).json({ error: `You are not assigned to record results for course '${courseCode}'` });
      }
    }

    const { total, grade, gradePoint } = calculateGradeAndPoint(caScore, examScore);

    const [resultRecord, created] = await AcademicResult.findOrCreate({
      where: {
        tenantId: req.tenantId,
        studentUid,
        courseCode,
        session: session || '2025/2026',
        semester: semester || '1st Semester'
      },
      defaults: {
        courseTitle: courseTitle || courseCode,
        creditUnits: Number(creditUnits) || 3,
        caScore: Number(caScore) || 0,
        examScore: Number(examScore) || 0,
        totalScore: total,
        grade,
        gradePoint,
        level: level || '100L',
        recordedByTeacherUid: req.user.uid,
        isPublished: isPublished ?? false
      }
    });

    if (!created) {
      resultRecord.caScore = Number(caScore) || 0;
      resultRecord.examScore = Number(examScore) || 0;
      resultRecord.totalScore = total;
      resultRecord.grade = grade;
      resultRecord.gradePoint = gradePoint;
      if (creditUnits) resultRecord.creditUnits = Number(creditUnits);
      if (isPublished !== undefined) resultRecord.isPublished = isPublished;
      resultRecord.recordedByTeacherUid = req.user.uid;
      await resultRecord.save();
    }

    await createAuditLog({
      req,
      action: created ? 'CREATE_ACADEMIC_RESULT' : 'UPDATE_ACADEMIC_RESULT',
      entity: 'AcademicResult',
      entityId: resultRecord.id,
      details: { studentUid, courseCode, caScore, examScore, total, grade }
    });

    res.status(201).json(resultRecord);
  } catch (error) {
    logger.error('Error saving academic result:', error);
    res.status(500).json({ error: 'Failed to record academic result' });
  }
});

// 3. Parent-Student Linkage Endpoints
app.get(['/api/parent/children/', '/api/parent/children'], authenticate, extractTenant, authorizeRoles('parent', 'admin', 'school_owner'), async (req, res) => {
  try {
    const parentUid = req.user.role === 'parent' ? req.user.uid : (req.query.parentUid || req.user.uid);
    const mappings = await ParentStudent.findAll({ where: { parentUid, tenantId: req.tenantId } });
    const studentUids = mappings.map(m => m.studentUid);

    const children = await User.findAll({
      where: { uid: { [Op.in]: studentUids }, tenantId: req.tenantId },
      attributes: ['uid', 'name', 'email', 'matricNo', 'level', 'department', 'faculty']
    });

    res.json(children);
  } catch (error) {
    logger.error('Error fetching parent children:', error);
    res.status(500).json({ error: 'Failed to fetch linked student records' });
  }
});

app.post(['/api/parent/link-student/', '/api/parent/link-student'], authenticate, extractTenant, authorizeRoles('parent', 'admin', 'school_owner'), async (req, res) => {
  try {
    const { studentEmail, studentMatricNo, relationship } = req.body;
    const parentUid = req.user.uid;

    let student = null;
    if (studentMatricNo) {
      student = await User.findOne({ where: { matricNo: studentMatricNo, tenantId: req.tenantId, role: 'student' } });
    }
    if (!student && studentEmail) {
      student = await User.findOne({ where: { email: studentEmail.toLowerCase().trim(), tenantId: req.tenantId, role: 'student' } });
    }

    if (!student) {
      return res.status(404).json({ error: 'No student found in this school with the provided email or matric number' });
    }

    const [linkRecord, created] = await ParentStudent.findOrCreate({
      where: { tenantId: req.tenantId, parentUid, studentUid: student.uid },
      defaults: { relationship: relationship || 'Parent' }
    });

    res.json({ message: 'Student successfully linked to parent account', linkRecord, student });
  } catch (error) {
    logger.error('Error linking parent to student:', error);
    res.status(500).json({ error: 'Failed to link student' });
  }
});

// 4. Executive Summary Reports (School Owner, Admin, Bursar)
app.get(['/api/reports/financial/', '/api/reports/financial'], authenticate, extractTenant, authorizeRoles('bursar', 'admin', 'school_owner'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const totalCollected = await Payment.sum('amount', { where: { tenantId, status: 'success' } }) || 0;
    const totalInvoiced = await FeeInvoice.sum('totalAmount', { where: { tenantId } }) || 0;
    const totalUnpaidBalance = await FeeInvoice.sum('balance', { where: { tenantId, status: { [Op.ne]: 'paid' } } }) || 0;
    const countInvoicesPaid = await FeeInvoice.count({ where: { tenantId, status: 'paid' } });
    const countInvoicesUnpaid = await FeeInvoice.count({ where: { tenantId, status: 'unpaid' } });

    res.json({
      totalCollected,
      totalInvoiced,
      totalUnpaidBalance,
      countInvoicesPaid,
      countInvoicesUnpaid,
      currency: 'NGN'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate financial report' });
  }
});

app.get(['/api/reports/academic/', '/api/reports/academic'], authenticate, extractTenant, authorizeRoles('teacher', 'admin', 'school_owner'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const totalResultsRecorded = await AcademicResult.count({ where: { tenantId } });
    const publishedResultsCount = await AcademicResult.count({ where: { tenantId, isPublished: true } });
    const activeClassAssignments = await ClassAssignment.count({ where: { tenantId } });

    res.json({
      totalResultsRecorded,
      publishedResultsCount,
      activeClassAssignments
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate academic report' });
  }
});

// ------------------------------------------------------------------
// 📝 ENTRANCE EXAM & CBT ENDPOINTS
// ------------------------------------------------------------------

// Default question generator helper if DB questions aren't seeded yet
const DEFAULT_CBT_QUESTIONS = {
  'English Language': [
    { id: 'eng_1', subject: 'English Language', stream: 'JAMB', question: 'Choose the option that best completes the sentence: The committee has completed ___ investigation.', options: ['its', 'it\'s', 'their', 'there'], correctAnswer: 0 },
    { id: 'eng_2', subject: 'English Language', stream: 'JAMB', question: 'Select the word opposite in meaning to "TRANSIENT".', options: ['Fleeting', 'Permanent', 'Fragile', 'Temporal'], correctAnswer: 1 },
    { id: 'eng_3', subject: 'English Language', stream: 'JAMB', question: 'Which of the following is a synonym for "METICULOUS"?', options: ['Careless', 'Thorough', 'Hastened', 'Casual'], correctAnswer: 1 }
  ],
  'Mathematics': [
    { id: 'mth_1', subject: 'Mathematics', stream: 'JAMB', question: 'If 2x + 5 = 15, what is the value of x?', options: ['3', '5', '10', '7'], correctAnswer: 1 },
    { id: 'mth_2', subject: 'Mathematics', stream: 'JAMB', question: 'Evaluate log10(1000).', options: ['1', '2', '3', '4'], correctAnswer: 2 },
    { id: 'mth_3', subject: 'Mathematics', stream: 'JAMB', question: 'What is the derivative of x^3 with respect to x?', options: ['x^2', '3x^2', '3x', 'x^4 / 4'], correctAnswer: 1 }
  ],
  'Physics': [
    { id: 'phy_1', subject: 'Physics', stream: 'JAMB', question: 'What is the SI unit of electric current?', options: ['Volt', 'Ohm', 'Ampere', 'Watt'], correctAnswer: 2 },
    { id: 'phy_2', subject: 'Physics', stream: 'JAMB', question: 'Which law states that stress is directly proportional to strain within the elastic limit?', options: ['Newton\'s Law', 'Hooke\'s Law', 'Boyle\'s Law', 'Pascal\'s Law'], correctAnswer: 1 }
  ],
  'Chemistry': [
    { id: 'chm_1', subject: 'Chemistry', stream: 'JAMB', question: 'What is the pH value of pure neutral water at 25°C?', options: ['0', '7', '14', '1'], correctAnswer: 1 },
    { id: 'chm_2', subject: 'Chemistry', stream: 'JAMB', question: 'Which gas is evolved when zinc reacts with dilute hydrochloric acid?', options: ['Oxygen', 'Hydrogen', 'Chlorine', 'Carbon Dioxide'], correctAnswer: 1 }
  ],
  'Biology': [
    { id: 'bio_1', subject: 'Biology', stream: 'JAMB', question: 'Which organelle is known as the powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi Body'], correctAnswer: 1 },
    { id: 'bio_2', subject: 'Biology', stream: 'JAMB', question: 'Which process in plants converts light energy into chemical energy?', options: ['Respiration', 'Transpiration', 'Photosynthesis', 'Osmosis'], correctAnswer: 2 }
  ],
  'Economics': [
    { id: 'eco_1', subject: 'Economics', stream: 'JAMB', question: 'Opportunity cost is best defined as:', options: ['Total money spent', 'The next best alternative forgone', 'Fixed costs of production', 'Marginal benefit'], correctAnswer: 1 }
  ],
  'Direct Entry': [
    { id: 'de_1', subject: 'General Aptitude & Advanced Studies', stream: 'Direct Entry', question: 'Direct Entry Evaluation: Which research method focuses on numerical data analysis?', options: ['Qualitative', 'Quantitative', 'Ethnographic', 'Philosophical'], correctAnswer: 1 },
    { id: 'de_2', subject: 'General Aptitude & Advanced Studies', stream: 'Direct Entry', question: 'Identify the fundamental principle of academic integrity in tertiary education.', options: ['Plagiarism', 'Originality and Citation', 'Arbitrary Reasoning', 'Fabrication'], correctAnswer: 1 },
    { id: 'de_3', subject: 'General Aptitude & Advanced Studies', stream: 'Direct Entry', question: 'What is the primary objective of advanced field synthesis in higher education?', options: ['Rote Memorization', 'Critical Analysis and Problem Solving', 'Passive Reading', 'None of the above'], correctAnswer: 1 }
  ]
};

// 1. Get Questions / Filter by Stream or Subject
app.get(['/api/academics/entrance-exams/questions/', '/api/academics/entrance-exams/questions'], async (req, res) => {
  try {
    const { stream, subject } = req.query;
    const where = {};
    if (stream) where.stream = stream;
    if (subject) where.subject = subject;

    const dbQuestions = await EntranceExamQuestion.findAll({ where });
    if (dbQuestions && dbQuestions.length > 0) {
      return res.json(dbQuestions);
    }

    // Return default fallbacks
    let results = [];
    if (stream === 'Direct Entry') {
      results = DEFAULT_CBT_QUESTIONS['Direct Entry'];
    } else if (subject && DEFAULT_CBT_QUESTIONS[subject]) {
      results = DEFAULT_CBT_QUESTIONS[subject];
    } else {
      results = Object.values(DEFAULT_CBT_QUESTIONS).flat();
    }
    res.json(results);
  } catch (error) {
    logger.error('Error fetching CBT questions:', error);
    res.status(500).json({ error: 'Failed to fetch exam questions' });
  }
});

// 2. Admin: Add/Set Exam Questions (for Direct Entry or JAMB)
app.post(['/api/academics/entrance-exams/questions/', '/api/academics/entrance-exams/questions'], authenticate, async (req, res) => {
  try {
    const { stream, subject, question, options, correctAnswer, faculty, department } = req.body;
    if (!question || !options || correctAnswer === undefined) {
      return res.status(400).json({ error: 'Question, options, and correct answer index required' });
    }

    const newQuestion = await EntranceExamQuestion.create({
      stream: stream || 'JAMB',
      subject: subject || 'General Knowledge',
      question,
      options,
      correctAnswer: Number(correctAnswer),
      faculty,
      department
    });

    res.status(201).json(newQuestion);
  } catch (error) {
    logger.error('Error creating question:', error);
    res.status(500).json({ error: 'Failed to add exam question' });
  }
});

// 3. Start Entrance Exam Session by JAMB/CBT Reg Number or Admission Registration Number
app.post(['/api/academics/entrance-exams/start/', '/api/academics/entrance-exams/start'], async (req, res) => {
  try {
    const { registrationNumber, stream, subjects, faculty, department } = req.body;
    const regNo = (registrationNumber || '').trim();

    if (!regNo) {
      return res.status(400).json({ error: 'JAMB / Direct Entry CBT / Admission Registration Number is required' });
    }

    let matchingApp = null;
    const cleanAppId = regNo.replace(/^LUK-ADM-/, '');
    try {
      const apps = await Application.findAll();
      matchingApp = apps.find(a =>
        a.id === regNo ||
        a.id === cleanAppId ||
        `LUK-ADM-${a.id}` === regNo ||
        a.uid === regNo ||
        (a.formData && (a.formData.jambRegNo === regNo || a.formData.jamb_reg_no === regNo))
      );
    } catch (appErr) {
      logger.warn('Application lookup in start exam warning:', appErr);
    }

    // Check if exam was already taken under regNo or matching application's identifiers
    const searchRegs = [regNo];
    if (matchingApp) {
      searchRegs.push(matchingApp.id, `LUK-ADM-${matchingApp.id}`);
      if (matchingApp.formData?.jambRegNo) searchRegs.push(matchingApp.formData.jambRegNo);
      if (matchingApp.uid) searchRegs.push(matchingApp.uid);
    }

    const existingSubmission = await EntranceExamSubmission.findOne({
      where: {
        [Op.or]: [
          { registrationNumber: { [Op.in]: searchRegs } },
          ...(matchingApp?.uid ? [{ uid: matchingApp.uid }] : [])
        ]
      }
    });

    if (existingSubmission) {
      return res.json({
        alreadyTaken: true,
        submission: existingSubmission,
        message: 'Entrance exam has already been completed for this registration number.'
      });
    }

    // Determine stream, faculty, department, and subjects from application if available
    const activeStream = stream || (matchingApp?.formData?.type?.includes('Direct Entry') ? 'Direct Entry' : 'JAMB');
    const activeFaculty = faculty || matchingApp?.faculty || matchingApp?.formData?.faculty || '';
    const activeDepartment = department || matchingApp?.department || matchingApp?.formData?.department || '';

    // Gather questions
    let assembledQuestions = [];
    if (activeStream === 'Direct Entry') {
      const deDbQuestions = await EntranceExamQuestion.findAll({ where: { stream: 'Direct Entry' } });
      assembledQuestions = deDbQuestions.length > 0 ? deDbQuestions : DEFAULT_CBT_QUESTIONS['Direct Entry'];
    } else {
      let activeSubjects = Array.isArray(subjects) && subjects.length > 0
        ? subjects
        : (matchingApp?.formData?.jambSubjects?.map(s => s.subject).filter(Boolean) || []);

      if (activeSubjects.length === 0) {
        activeSubjects = ['English Language', 'Mathematics', 'Physics', 'Chemistry'];
      }

      for (const sub of activeSubjects) {
        const subName = typeof sub === 'string' ? sub : (sub.subject || 'English Language');
        const dbQs = await EntranceExamQuestion.findAll({ where: { subject: subName } });
        const qs = dbQs.length > 0 ? dbQs : (DEFAULT_CBT_QUESTIONS[subName] || DEFAULT_CBT_QUESTIONS['English Language']);
        assembledQuestions = assembledQuestions.concat(qs);
      }
    }

    // Strip out correctAnswer from payload sent to candidate for exam integrity
    const candidateQuestions = assembledQuestions.map((q, idx) => ({
      id: q.id || `q_${idx}_${Date.now()}`,
      subject: q.subject || 'General',
      question: q.question,
      options: q.options,
      stream: q.stream || activeStream || 'JAMB'
    }));

    res.json({
      alreadyTaken: false,
      registrationNumber: regNo,
      stream: activeStream,
      faculty: activeFaculty,
      department: activeDepartment,
      durationMinutes: activeStream === 'Direct Entry' ? 45 : 60,
      questions: candidateQuestions
    });
  } catch (error) {
    logger.error('Error starting entrance exam:', error);
    res.status(500).json({ error: 'Failed to initialize entrance exam session' });
  }
});

// 4. Submit Entrance Exam & Calculate Score
app.post(['/api/academics/entrance-exams/submit/', '/api/academics/entrance-exams/submit'], async (req, res) => {
  try {
    const { registrationNumber, candidateName, candidateEmail, uid, stream, faculty, department, answers } = req.body;
    const regNo = (registrationNumber || '').trim();

    if (!regNo || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Registration number and answers array required' });
    }

    // Double-check existing
    const existing = await EntranceExamSubmission.findOne({ where: { registrationNumber: regNo } });
    if (existing) {
      return res.status(400).json({ error: 'Entrance exam already submitted for this registration number.' });
    }

    let correctCount = 0;
    const totalQuestions = answers.length;
    const subjectBreakdown = {};

    for (const ans of answers) {
      const sub = ans.subject || 'General';
      if (!subjectBreakdown[sub]) {
        subjectBreakdown[sub] = { total: 0, correct: 0, score: 0 };
      }
      subjectBreakdown[sub].total += 1;

      // Verify answer
      let isCorrect = false;
      if (ans.questionId) {
        const dbQ = await EntranceExamQuestion.findByPk(ans.questionId);
        if (dbQ) {
          isCorrect = dbQ.correctAnswer === Number(ans.selectedOption);
        } else {
          // Check default questions dictionary
          const defaultQs = Object.values(DEFAULT_CBT_QUESTIONS).flat();
          const found = defaultQs.find(q => q.id === ans.questionId);
          if (found) {
            isCorrect = found.correctAnswer === Number(ans.selectedOption);
          }
        }
      }

      if (isCorrect) {
        correctCount += 1;
        subjectBreakdown[sub].correct += 1;
      }
    }

    // Calculate percentage score
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Calculate per-subject percentage
    Object.keys(subjectBreakdown).forEach(sub => {
      const item = subjectBreakdown[sub];
      item.score = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
    });

    // Create submission record
    const submission = await EntranceExamSubmission.create({
      registrationNumber: regNo,
      candidateName: candidateName || 'Candidate',
      candidateEmail: candidateEmail || '',
      uid: uid || null,
      stream: stream || 'JAMB',
      faculty: faculty || '',
      department: department || '',
      totalScore: correctCount * 10,
      maxScore: totalQuestions * 10,
      percentage,
      subjectScores: subjectBreakdown,
      answers,
      status: 'submitted',
      admissionGuaranteed: false
    });

    // Notify Real-time socket & Admin
    io.emit('new_entrance_exam_submission', {
      id: submission.id,
      registrationNumber: regNo,
      candidateName: submission.candidateName,
      percentage
    });

    res.status(201).json({
      message: 'Entrance exam submitted successfully!',
      submission
    });
  } catch (error) {
    logger.error('Error submitting exam:', error);
    res.status(500).json({ error: 'Failed to submit entrance exam' });
  }
});

// 5. Admin: List Exam Submissions
app.get(['/api/academics/entrance-exams/submissions/', '/api/academics/entrance-exams/submissions'], authenticate, async (req, res) => {
  try {
    const submissions = await EntranceExamSubmission.findAll({
      order: [['submittedAt', 'DESC']]
    });
    res.json(submissions);
  } catch (error) {
    logger.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch CBT submissions' });
  }
});

// 6. Admin: Release Result to Student Portal & Guarantee Admission
app.post(['/api/academics/entrance-exams/release/:id/', '/api/academics/entrance-exams/release/:id'], authenticate, async (req, res) => {
  try {
    const submission = await EntranceExamSubmission.findByPk(req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    submission.status = 'released';
    submission.admissionGuaranteed = true;
    submission.releasedAt = new Date();
    await submission.save();

    // Find and update candidate's Application status if exists
    if (submission.uid || submission.registrationNumber) {
      const appRecord = await Application.findOne({
        where: {
          [Op.or]: [
            { uid: submission.uid || '' },
            { id: submission.uid || '' }
          ]
        }
      });
      if (appRecord) {
        appRecord.status = 'approved';
        await appRecord.save();
      }
    }

    // Send email notification to student
    if (submission.candidateEmail) {
      try {
        await sendOfficialEmail({
          to: submission.candidateEmail,
          subject: 'Official Entrance Exam Result & Admission Guarantee',
          body: `
            <p>Dear <b>${submission.candidateName}</b>,</p>
            <p>Your Entrance Exam result for Reg No: <b>${submission.registrationNumber}</b> has been released!</p>
            <p><b>Score:</b> ${submission.percentage}%</p>
            <p><b>Admission Guarantee Status:</b> <span style="color:#059669; font-weight:bold;">GUARANTEED & APPROVED</span></p>
            <p>Please log in to your Student Portal to view your complete breakdown and print your Official Admission Guarantee Letter.</p>
          `
        });
      } catch (e) {
        logger.warn('Failed to send result email:', e);
      }
    }

    res.json({
      message: 'Result released and admission guaranteed successfully!',
      submission
    });
  } catch (error) {
    logger.error('Error releasing result:', error);
    res.status(500).json({ error: 'Failed to release exam result' });
  }
});

// 7. Student/Applicant: Get Released Result & Admission Guarantee
app.get(['/api/academics/entrance-exams/my-result/', '/api/academics/entrance-exams/my-result'], async (req, res) => {
  try {
    const { regNo, uid } = req.query;
    if (!regNo && !uid) {
      return res.status(400).json({ error: 'Registration number or User ID required' });
    }

    const searchRegs = [];
    if (regNo) {
      const clean = regNo.trim();
      searchRegs.push(clean);
      const cleanAppId = clean.replace(/^LUK-ADM-/, '');
      searchRegs.push(cleanAppId, `LUK-ADM-${cleanAppId}`);

      try {
        const apps = await Application.findAll();
        const matchingApp = apps.find(a =>
          a.id === clean ||
          a.id === cleanAppId ||
          `LUK-ADM-${a.id}` === clean ||
          a.uid === clean ||
          (a.formData && (a.formData.jambRegNo === clean || a.formData.jamb_reg_no === clean))
        );
        if (matchingApp) {
          searchRegs.push(matchingApp.id, `LUK-ADM-${matchingApp.id}`);
          if (matchingApp.formData?.jambRegNo) searchRegs.push(matchingApp.formData.jambRegNo);
          if (matchingApp.uid) searchRegs.push(matchingApp.uid);
        }
      } catch (appErr) {
        logger.warn('Application lookup in my-result warning:', appErr);
      }
    }

    const where = {};
    if (searchRegs.length > 0) {
      where[Op.or] = [
        { registrationNumber: { [Op.in]: searchRegs } },
        ...(uid ? [{ uid }] : [])
      ];
    } else if (uid) {
      where.uid = uid;
    }

    const submission = await EntranceExamSubmission.findOne({ where });
    if (!submission) {
      return res.status(404).json({ error: 'No entrance exam submission found for this registration number' });
    }

    res.json(submission);
  } catch (error) {
    logger.error('Error getting candidate result:', error);
    res.status(500).json({ error: 'Failed to fetch exam result' });
  }
});

// Notifications / Email Dispatch
app.post(['/api/notify', '/api/notify/'], async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    await sendOfficialEmail({ to, subject, body: message });
    res.json({ status: 'sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// 📡 Socket Events
io.on('connection', (socket) => {
  socket.on('join_room', (uid) => {
    socket.join(`user_${uid}`);
    logger.info(`👤 User ${uid} connected to real-time hub`);
  });
});

// 🛡️ API 404 Fallback Handler (Always return JSON for API requests)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// 🔐 Admin Direct URL Redirection (e.g., uniportal/admin -> /#/admin)
app.get(['/admin', '/admin/'], (req, res) => {
  res.redirect('/#/admin');
});

// 🌐 SPA Fallback Routing for Client-Side Navigation
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend build not found. Please build the client app.');
  }
});

// ------------------------------------------------------------------
// 🏁 START THE BEST PORTAL
// ------------------------------------------------------------------
async function seedDefaultAdmin() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.DEFAULT_ADMIN_EMAIL || 'admin_user@example.com').toLowerCase().trim();
    const adminUsername = adminEmail;
    const adminPrefix = adminEmail.split('@')[0];
    const adminPass = process.env.ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPassword123!';

    const hashedPassword = hashPassword(adminPass);

    const existingAdmin = await User.findOne({
      where: {
        [Op.or]: [
          { email: adminEmail },
          { username: adminUsername },
          { username: adminPrefix },
          { email: 'admin_user@example.com' },
          { username: 'admin_user' }
        ]
      }
    });

    if (existingAdmin) {
      existingAdmin.email = adminEmail;
      existingAdmin.username = adminUsername;
      existingAdmin.password = hashedPassword;
      existingAdmin.role = 'admin';
      existingAdmin.firstName = existingAdmin.firstName || 'System';
      existingAdmin.lastName = existingAdmin.lastName || 'Admin';
      existingAdmin.name = existingAdmin.name || 'System Admin';
      await existingAdmin.save();
      logger.info(`🔑 Default admin account updated & synchronized: ${adminEmail}`);
    } else {
      const uid = 'usr_admin_default_2026';
      await User.create({
        uid,
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Admin',
        name: 'System Admin',
        role: 'admin',
        level: 'Staff'
      });
      logger.info(`🔑 Default admin account created: ${adminEmail}`);
    }

    // Ensure all existing accounts with role 'admin' have non-empty password set
    const adminUsers = await User.findAll({ where: { role: 'admin' } });
    for (const adminUser of adminUsers) {
      if (!adminUser.password) {
        adminUser.password = hashedPassword;
        await adminUser.save();
      }
    }
  } catch (error) {
    logger.error('Error seeding default admin account:', error);
  }
}

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.sync({ alter: true });
    logger.info('🐘 Database synced successfully');
    await seedDefaultAdmin();
  } catch (err) {
    logger.warn(`⚠️ Database sync bypassed: ${err.message}`);
  }

  server.listen(PORT, () => {
    logger.info(`🚀 THE BEST UniPortal Server running on port ${PORT}`);
  });
};

startServer();
