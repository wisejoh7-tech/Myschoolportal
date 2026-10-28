export type UserRole = 'school_owner' | 'admin' | 'teacher' | 'bursar' | 'student' | 'parent' | 'staff' | 'applicant';
export type UniversityName = 'UniPortal' | 'LUKKE' | 'GENERAL';

export interface UserProfile {
  uid: string;
  tenantId?: string;
  email: string;
  role: UserRole;
  name: string;
  university: UniversityName;
  photoUrl?: string;
  lukkeRegNo?: string;
  faculty?: string;
  department?: string;
  level?: string;
  matricNo?: string;
  staffId?: string;
  isVerified?: boolean;
  studentEmail?: string;
  virtualAccountNumber?: string;
  
  // 🧬 Enhanced Bio-Data (UNIBEN/UNILAG style)
  gender?: 'Male' | 'Female';
  dateOfBirth?: string;
  phoneNumber?: string;
  stateOfOrigin?: string;
  lga?: string;
  permanentAddress?: string;
  bloodGroup?: string;
  genotype?: string;
  age?: number;
  locationCity?: string;
  
  // 👨‍👩‍👧 Next of Kin
  nokName?: string;
  nokPhone?: string;
  nokRelation?: string;
  nokAddress?: string;

  // 📝 Academic Record
  jambRegNo?: string;
  jambScore?: number;
  jambSubjects?: { subject: string; score: number }[];
  olevelResults?: { examType: string; year: string; results: { subject: string; grade: string }[] }[];
  
  // 📸 Triple Biometrics
  faceUrl?: string;
  leftIndexFingerUrl?: string;
  rightIndexFingerUrl?: string;
  createdAt?: string;
}

export interface LoanApplication {
  id?: string;
  uid: string;
  name: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  university: UniversityName;
  repaymentPeriod: number; // in months
  bvn?: string;
  nin?: string;
}

export interface AdmissionApplication {
  id?: string;
  uid: string;
  name: string;
  email: string;
  university: UniversityName;
  faculty: string;
  department: string;
  status: 'pending' | 'approved' | 'rejected';
  credentials?: string[];
  createdAt: string;

  // 📝 Integrated Data
  gender: 'Male' | 'Female';
  dateOfBirth: string;
  stateOfOrigin: string;
  lga: string;
  phoneNumber: string;
  age: number;
  locationCity: string;
  jambRegNo: string;
  jambScore: number;
  jambSubjects: { subject: string; score: number }[];
  olevelResults: { examType: string; year: string; results: { subject: string; grade: string }[] }[];
  
  // 📸 Triple Biometrics
  faceUrl: string;
  leftIndexFingerUrl: string;
  rightIndexFingerUrl: string;
  biometricsVerified?: boolean;
  postUtmeScore?: number;
}

export interface Course {
  id?: string;
  courseCode: string;
  title: string;
  units: number;
  faculty: string;
  department: string;
  level: string;
}

export interface Registration {
  id?: string;
  studentId: string;
  semester: string;
  level: string;
  courses: string[];
  isApproved: boolean;
  createdAt: string;
}

export interface Payment {
  id?: string;
  tenantId?: string;
  uid?: string;
  invoiceId?: string;
  amount: number;
  type: string;
  status: 'pending' | 'success' | 'failed';
  transactionId?: string;
  reference?: string;
  method?: string;
  verifiedOnBackend?: boolean;
  created_at?: string;
  createdAt?: string;
}

export interface FeeInvoice {
  id: string;
  tenantId?: string;
  invoiceNumber: string;
  studentUid: string;
  title: string;
  feeType: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
  dueDate?: string;
  session?: string;
  termOrSemester?: string;
  createdAt?: string;
  User?: Partial<UserProfile>;
}

export interface Receipt {
  id: string;
  tenantId?: string;
  receiptNumber: string;
  paymentId?: string;
  invoiceId?: string;
  studentUid: string;
  amountPaid: number;
  paymentMethod: string;
  issuedBy?: string;
  issuedAt?: string;
  User?: Partial<UserProfile>;
}

export interface ClassAssignment {
  id: string;
  tenantId?: string;
  teacherUid: string;
  courseCode: string;
  courseTitle: string;
  faculty?: string;
  department?: string;
  level?: string;
  academicYear?: string;
  semester?: string;
  User?: Partial<UserProfile>;
}

export interface AcademicResult {
  id?: string;
  tenantId?: string;
  studentUid: string;
  courseCode: string;
  courseTitle: string;
  creditUnits: number;
  caScore: number;
  examScore: number;
  totalScore: number;
  grade: string;
  gradePoint: number;
  semester?: string;
  level?: string;
  session?: string;
  recordedByTeacherUid?: string;
  isPublished?: boolean;
  createdAt?: string;
  User?: Partial<UserProfile>;
}

export interface AuditLog {
  id: string;
  tenantId?: string;
  actorUid?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  timestamp?: string;
}

export interface Hostel {
  id?: string;
  name: string;
  roomNumber: string;
  bedNumber: string;
  isOccupied: boolean;
  occupantId?: string;
}

export interface Result {
  id?: string;
  studentId: string;
  courseId: string;
  grade: string;
  score: number;
  semester: string;
  level: string;
  gp: number;
}
export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}
export type ClearanceStatus = 'uploaded' | 'verified' | 'rejected' | 'pending';
export interface ClearanceRecord {
  id?: string;
  uid: string;
  affidavitUrl?: string;
  lgaOriginUrl?: string;
  ageDeclarationUrl?: string;
  status: ClearanceStatus;
  updatedAt: string;
}
