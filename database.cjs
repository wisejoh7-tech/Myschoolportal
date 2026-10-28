const { Sequelize, DataTypes, Op } = require('sequelize');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;

let sequelize;

if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: false,
    ...(isLocal ? {} : {
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  });
} else if (dbUrl && (dbUrl.startsWith('sqlite://') || dbUrl.startsWith('sqlite:'))) {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbUrl.replace(/^sqlite:\/\//, '').replace(/^sqlite:/, '') || './uniportal.sqlite',
    logging: false
  });
} else {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.SQLITE_PATH || './uniportal.sqlite',
    logging: false
  });
}

// Define Models
const User = sequelize.define('User', {
  uid: { type: DataTypes.STRING, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  username: { type: DataTypes.STRING, unique: true },
  email: { type: DataTypes.STRING, unique: true },
  password: { type: DataTypes.STRING },
  firstName: { type: DataTypes.STRING },
  lastName: { type: DataTypes.STRING },
  name: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING, defaultValue: 'student' }, // school_owner, admin, teacher, bursar, student, parent, applicant
  faculty: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  level: { type: DataTypes.STRING, defaultValue: '100L' },
  matricNo: { type: DataTypes.STRING },
  photoUrl: { type: DataTypes.STRING },
  phoneNumber: { type: DataTypes.STRING }
});

const ParentStudent = sequelize.define('ParentStudent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  parentUid: { type: DataTypes.STRING, allowance: false },
  studentUid: { type: DataTypes.STRING, allowance: false },
  relationship: { type: DataTypes.STRING, defaultValue: 'Parent' }
});

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  uid: { type: DataTypes.STRING },
  invoiceId: { type: DataTypes.STRING },
  amount: { type: DataTypes.DECIMAL(10, 2) },
  type: { type: DataTypes.STRING }, // tuition, hostel, acceptance, exam, etc.
  status: { type: DataTypes.STRING, defaultValue: 'pending' }, // pending, success, failed
  transactionId: { type: DataTypes.STRING, unique: true },
  method: { type: DataTypes.STRING },
  verifiedOnBackend: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const FeeInvoice = sequelize.define('FeeInvoice', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  invoiceNumber: { type: DataTypes.STRING, unique: true },
  studentUid: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING },
  feeType: { type: DataTypes.STRING, defaultValue: 'tuition' }, // tuition, hostel, acceptance, fine
  totalAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  paidAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  status: { type: DataTypes.STRING, defaultValue: 'unpaid' }, // unpaid, partial, paid, cancelled
  dueDate: { type: DataTypes.DATE },
  session: { type: DataTypes.STRING, defaultValue: '2025/2026' },
  termOrSemester: { type: DataTypes.STRING, defaultValue: '1st Semester' },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const Receipt = sequelize.define('Receipt', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  receiptNumber: { type: DataTypes.STRING, unique: true },
  paymentId: { type: DataTypes.STRING },
  invoiceId: { type: DataTypes.STRING },
  studentUid: { type: DataTypes.STRING },
  amountPaid: { type: DataTypes.DECIMAL(10, 2) },
  paymentMethod: { type: DataTypes.STRING },
  issuedBy: { type: DataTypes.STRING, defaultValue: 'System Bursar' },
  issuedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  studentId: { type: DataTypes.STRING },
  courseId: { type: DataTypes.STRING },
  teacherUid: { type: DataTypes.STRING },
  location: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'present' }, // present, absent, excused
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const Application = sequelize.define('Application', {
  id: { type: DataTypes.STRING, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  uid: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING },
  faculty: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  faceUrl: { type: DataTypes.STRING },
  formData: { type: DataTypes.JSON }
});

const EntranceExamQuestion = sequelize.define('EntranceExamQuestion', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  stream: { type: DataTypes.STRING, defaultValue: 'JAMB' }, // 'JAMB' or 'Direct Entry'
  subject: { type: DataTypes.STRING }, // e.g. 'English Language', 'General Aptitude', etc.
  question: { type: DataTypes.TEXT },
  options: { type: DataTypes.JSON }, // ["Option A", "Option B", "Option C", "Option D"]
  correctAnswer: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0-based index
  faculty: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING }
});

const EntranceExamSubmission = sequelize.define('EntranceExamSubmission', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  registrationNumber: { type: DataTypes.STRING, unique: true }, // JAMB Reg No or DE CBT Reg No
  candidateName: { type: DataTypes.STRING },
  candidateEmail: { type: DataTypes.STRING },
  uid: { type: DataTypes.STRING },
  stream: { type: DataTypes.STRING, defaultValue: 'JAMB' }, // 'JAMB' or 'Direct Entry'
  faculty: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  totalScore: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  maxScore: { type: DataTypes.DECIMAL(5, 2), defaultValue: 100 },
  percentage: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  subjectScores: { type: DataTypes.JSON }, // e.g. { "English Language": 80, "Mathematics": 70 }
  answers: { type: DataTypes.JSON },
  status: { type: DataTypes.STRING, defaultValue: 'submitted' }, // 'submitted' or 'released'
  admissionGuaranteed: { type: DataTypes.BOOLEAN, defaultValue: false },
  releasedAt: { type: DataTypes.DATE },
  submittedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const ClassAssignment = sequelize.define('ClassAssignment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  teacherUid: { type: DataTypes.STRING },
  courseCode: { type: DataTypes.STRING },
  courseTitle: { type: DataTypes.STRING },
  faculty: { type: DataTypes.STRING },
  department: { type: DataTypes.STRING },
  level: { type: DataTypes.STRING },
  academicYear: { type: DataTypes.STRING, defaultValue: '2025/2026' },
  semester: { type: DataTypes.STRING, defaultValue: '1st Semester' }
});

const AcademicResult = sequelize.define('AcademicResult', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  studentUid: { type: DataTypes.STRING },
  courseCode: { type: DataTypes.STRING },
  courseTitle: { type: DataTypes.STRING },
  creditUnits: { type: DataTypes.INTEGER, defaultValue: 3 },
  caScore: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }, // Continuous Assessment (0-30/40)
  examScore: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }, // Exam (0-60/70)
  totalScore: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }, // 0-100
  grade: { type: DataTypes.STRING }, // A, B, C, D, E, F
  gradePoint: { type: DataTypes.DECIMAL(3, 2), defaultValue: 0 }, // 5.0, 4.0, 3.0...
  semester: { type: DataTypes.STRING, defaultValue: '1st Semester' },
  level: { type: DataTypes.STRING, defaultValue: '100L' },
  session: { type: DataTypes.STRING, defaultValue: '2025/2026' },
  recordedByTeacherUid: { type: DataTypes.STRING },
  isPublished: { type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.STRING, defaultValue: 'default_school' },
  actorUid: { type: DataTypes.STRING },
  actorEmail: { type: DataTypes.STRING },
  actorRole: { type: DataTypes.STRING },
  action: { type: DataTypes.STRING }, // UPDATE_GRADE, VERIFY_PAYMENT, CHANGE_USER_ROLE, CREATE_INVOICE, etc.
  entity: { type: DataTypes.STRING }, // User, Payment, AcademicResult, FeeInvoice, etc.
  entityId: { type: DataTypes.STRING },
  details: { type: DataTypes.JSON },
  ipAddress: { type: DataTypes.STRING },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// Relationships
User.hasMany(Payment, { foreignKey: 'uid' });
Payment.belongsTo(User, { foreignKey: 'uid' });

User.hasMany(Attendance, { foreignKey: 'studentId' });
Attendance.belongsTo(User, { foreignKey: 'studentId' });

User.hasOne(Application, { foreignKey: 'uid' });
Application.belongsTo(User, { foreignKey: 'uid' });

User.hasMany(FeeInvoice, { foreignKey: 'studentUid' });
FeeInvoice.belongsTo(User, { foreignKey: 'studentUid' });

User.hasMany(Receipt, { foreignKey: 'studentUid' });
Receipt.belongsTo(User, { foreignKey: 'studentUid' });

User.hasMany(AcademicResult, { foreignKey: 'studentUid' });
AcademicResult.belongsTo(User, { foreignKey: 'studentUid' });

User.hasMany(ClassAssignment, { foreignKey: 'teacherUid' });
ClassAssignment.belongsTo(User, { foreignKey: 'teacherUid' });

module.exports = {
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
};
