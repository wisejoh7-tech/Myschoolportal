import React, { useState, useEffect } from 'react';
import { UserProfile, FeeInvoice, Receipt } from '../../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { CreditCard, FileText, Plus, DollarSign, Download, CheckCircle2, TrendingUp, Building2, RefreshCw } from 'lucide-react';
import BankReconciliation from './BankReconciliation';

interface BursarDashboardProps {
  user: UserProfile;
}

export default function BursarDashboard({ user }: BursarDashboardProps) {
  const [activeTab, setActiveTab] = useState<'invoicing' | 'reconciliation'>('invoicing');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [analytics, setAnalytics] = useState({ totalCollected: 0, totalInvoiced: 0, totalUnpaidBalance: 0 });
  const [loading, setLoading] = useState(true);

  // New Invoice Form State
  const [selectedStudentUid, setSelectedStudentUid] = useState('');
  const [title, setTitle] = useState('First Semester School Fees');
  const [feeType, setFeeType] = useState('tuition');
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchBursarData();
  }, []);

  const fetchBursarData = async () => {
    try {
      setLoading(true);
      const [stuRes, invRes, recRes, reportRes] = await Promise.all([
        api.get('/accounts/users?role=student'),
        api.get('/finances/invoices'),
        api.get('/finances/receipts'),
        api.get('/reports/financial')
      ]);
      setStudents(stuRes.data);
      setInvoices(invRes.data);
      setReceipts(recRes.data);
      setAnalytics(reportRes.data);
    } catch (error) {
      toast.error('Failed to load Bursar portal data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentUid || !totalAmount) {
      return toast.error('Please select a student and enter fee amount');
    }

    try {
      setCreating(true);
      await api.post('/finances/invoices', {
        studentUid: selectedStudentUid,
        title,
        feeType,
        totalAmount: Number(totalAmount),
        dueDate: dueDate || null
      });
      toast.success('Fee invoice issued successfully');
      setTotalAmount('');
      fetchBursarData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to issue invoice');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-emerald-800 font-bold">Loading Bursar Treasury Portal...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-emerald-950 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Treasury & Bursar Command</h1>
          <p className="text-emerald-300 mt-1">
            School Bursar Office • <span className="text-white font-semibold">{user.name}</span>
          </p>
        </div>
        <div className="flex gap-2 bg-emerald-900/80 p-1.5 rounded-xl border border-emerald-800">
          <button
            onClick={() => setActiveTab('invoicing')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'invoicing' ? 'bg-[#008751] text-white shadow' : 'text-emerald-200 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Invoicing & Receipts
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'reconciliation' ? 'bg-[#008751] text-white shadow' : 'text-emerald-200 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" /> Banking & Reconciliation
          </button>
        </div>
      </div>

      {activeTab === 'reconciliation' ? (
        <BankReconciliation user={user} />
      ) : (
        <>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex items-center gap-4">
          <div className="bg-emerald-100 p-4 rounded-xl text-emerald-700">
            <DollarSign className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Total Revenue Collected</p>
            <p className="text-2xl font-black text-emerald-900">₦{Number(analytics.totalCollected).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex items-center gap-4">
          <div className="bg-blue-100 p-4 rounded-xl text-blue-700">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Total Invoiced Amount</p>
            <p className="text-2xl font-black text-gray-900">₦{Number(analytics.totalInvoiced).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex items-center gap-4">
          <div className="bg-amber-100 p-4 rounded-xl text-amber-700">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Outstanding Balance</p>
            <p className="text-2xl font-black text-amber-900">₦{Number(analytics.totalUnpaidBalance).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Issue Invoice Section */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Plus className="w-5 h-5 text-emerald-600" />
          Generate New Student Fee Invoice
        </h2>
        <form onSubmit={handleCreateInvoice} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Select Student</label>
            <select
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={selectedStudentUid}
              onChange={(e) => setSelectedStudentUid(e.target.value)}
            >
              <option value="">-- Choose Student --</option>
              {students.map((s) => (
                <option key={s.uid} value={s.uid}>
                  {s.name} ({s.matricNo || s.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Invoice Title</label>
            <input
              type="text"
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Total Fee Amount (₦)</label>
            <input
              type="number"
              placeholder="e.g. 150000"
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              {creating ? 'Issuing Invoice...' : 'Generate & Send Fee Invoice'}
            </button>
          </div>
        </form>
      </div>

      {/* Invoices List */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Issued Fee Invoices & Payment Statuses</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 font-bold border-b">
              <tr>
                <th className="p-3">Invoice No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3">Title</th>
                <th className="p-3">Total Amount</th>
                <th className="p-3">Paid Amount</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono text-emerald-800 font-bold">{inv.invoiceNumber}</td>
                  <td className="p-3 font-semibold text-gray-800">{inv.User?.name || inv.studentUid}</td>
                  <td className="p-3 text-gray-600">{inv.title}</td>
                  <td className="p-3 font-bold">₦{Number(inv.totalAmount).toLocaleString()}</td>
                  <td className="p-3 text-emerald-700">₦{Number(inv.paidAmount).toLocaleString()}</td>
                  <td className="p-3 text-red-600 font-bold">₦{Number(inv.balance).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                      inv.status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
