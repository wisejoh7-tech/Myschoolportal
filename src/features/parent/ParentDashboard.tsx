import React, { useState, useEffect } from 'react';
import { UserProfile, AcademicResult, FeeInvoice, Receipt } from '../../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { Users, BookOpen, CreditCard, Award, Plus, Link, CheckCircle2 } from 'lucide-react';

interface ParentDashboardProps {
  user: UserProfile;
}

export default function ParentDashboard({ user }: ParentDashboardProps) {
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [results, setResults] = useState<AcademicResult[]>([]);
  const [cgpa, setCgpa] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Link Form
  const [studentMatricNo, setStudentMatricNo] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetchChildren();
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      fetchStudentRecords(selectedStudent.uid);
    }
  }, [selectedStudent]);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const res = await api.get('/parent/children');
      setChildren(res.data);
      if (res.data.length > 0) {
        setSelectedStudent(res.data[0]);
      }
    } catch (error) {
      toast.error('Failed to load linked children');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentRecords = async (studentUid: string) => {
    try {
      const [invRes, recRes, resRes] = await Promise.all([
        api.get(`/finances/invoices?studentUid=${studentUid}`),
        api.get(`/finances/receipts?studentUid=${studentUid}`),
        api.get(`/academics/results?studentUid=${studentUid}&includeCgpa=true`)
      ]);
      setInvoices(invRes.data);
      setReceipts(recRes.data);
      setResults(resRes.data.results || resRes.data);
      if (resRes.data.cgpa !== undefined) {
        setCgpa(resRes.data.cgpa);
      }
    } catch (error) {
      toast.error('Failed to fetch child academic/financial records');
    }
  };

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentMatricNo && !studentEmail) {
      return toast.error('Please enter student email or matriculation number');
    }
    try {
      setLinking(true);
      await api.post('/parent/link-student', { studentMatricNo, studentEmail });
      toast.success('Child successfully linked to your Parent Account');
      setStudentMatricNo('');
      setStudentEmail('');
      fetchChildren();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to link child');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-emerald-800 font-bold">Loading Parent Portal Dashboard...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Parent Command Portal</h1>
          <p className="text-emerald-200 mt-1">
            Welcome, <span className="font-semibold text-white">{user.name}</span>. Monitor linked ward's academic results, attendance, and fee invoices.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-800 px-4 py-2 rounded-xl border border-emerald-700">
          <Users className="w-5 h-5 text-emerald-300" />
          <span className="font-bold text-emerald-100">{children.length} Wards Linked</span>
        </div>
      </div>

      {/* Link New Ward Form */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
          <Link className="w-5 h-5 text-emerald-600" />
          Link Your Ward / Student
        </h2>
        <form onSubmit={handleLinkStudent} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Student Matric Number (e.g. CSC/2026/001)"
            className="p-3 border rounded-xl border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={studentMatricNo}
            onChange={(e) => setStudentMatricNo(e.target.value)}
          />
          <input
            type="email"
            placeholder="Student Email Address"
            className="p-3 border rounded-xl border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={linking}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            {linking ? 'Linking...' : 'Link Student Account'}
          </button>
        </form>
      </div>

      {/* Children Selection Tabs */}
      {children.length > 0 ? (
        <div className="space-y-6">
          <div className="flex gap-4 border-b border-gray-200 pb-2">
            {children.map((child) => (
              <button
                key={child.uid}
                onClick={() => setSelectedStudent(child)}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition flex items-center gap-2 ${
                  selectedStudent?.uid === child.uid
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4" />
                {child.name} ({child.matricNo || 'Student'})
              </button>
            ))}
          </div>

          {selectedStudent && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Academic Results & CGPA */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Award className="w-6 h-6 text-emerald-600" />
                        Academic Performance & CGPA
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedStudent.name} • {selectedStudent.department} • {selectedStudent.level}
                      </p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl font-extrabold text-lg border border-emerald-200">
                      CGPA: {cgpa.toFixed(2)} / 5.00
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                        <tr>
                          <th className="p-3">Course</th>
                          <th className="p-3">Units</th>
                          <th className="p-3">CA (40)</th>
                          <th className="p-3">Exam (60)</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {results.length > 0 ? (
                          results.map((res, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="p-3 font-semibold text-gray-800">
                                {res.courseCode} - {res.courseTitle}
                              </td>
                              <td className="p-3 text-gray-600">{res.creditUnits}</td>
                              <td className="p-3 text-gray-600">{res.caScore}</td>
                              <td className="p-3 text-gray-600">{res.examScore}</td>
                              <td className="p-3 font-bold text-gray-900">{res.totalScore}</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  res.grade === 'A' ? 'bg-green-100 text-green-800' :
                                  res.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                                  res.grade === 'C' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {res.grade} ({res.gradePoint.toFixed(1)})
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-gray-400">
                              No published academic results available yet for this ward.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Invoices & Receipts */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                    Fee Invoices & Balance
                  </h3>

                  <div className="space-y-4">
                    {invoices.length > 0 ? (
                      invoices.map((inv) => (
                        <div key={inv.id} className="p-4 border rounded-xl border-gray-100 bg-gray-50 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-gray-800">{inv.title}</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                              inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              inv.status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {inv.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 flex justify-between">
                            <span>Total: ₦{Number(inv.totalAmount).toLocaleString()}</span>
                            <span className="font-semibold text-red-600">Balance: ₦{Number(inv.balance).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">No fee invoices issued yet.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Official Payment Receipts
                  </h3>

                  <div className="space-y-3">
                    {receipts.length > 0 ? (
                      receipts.map((rec) => (
                        <div key={rec.id} className="p-3 border rounded-xl border-emerald-100 bg-emerald-50/40 flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-emerald-900">{rec.receiptNumber}</p>
                            <p className="text-xs text-emerald-700">{new Date(rec.issuedAt || '').toLocaleDateString()}</p>
                          </div>
                          <span className="font-extrabold text-emerald-800">₦{Number(rec.amountPaid).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">No verified receipts found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-2xl shadow border border-gray-100 text-gray-500">
          No students currently linked. Please enter your child's Matriculation Number or Email above to link records.
        </div>
      )}
    </div>
  );
}
