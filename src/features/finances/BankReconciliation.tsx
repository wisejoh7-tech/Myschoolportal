import React, { useState, useEffect } from 'react';
import { UserProfile, BankAccount, BankStatement, FeeInvoice, BankCharge, FeeRefund, ReconciliationReport } from '../../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
  Building2, Upload, RefreshCw, CheckCircle2, AlertCircle, FileText,
  DollarSign, Plus, ArrowUpRight, ArrowDownRight, Search, Filter,
  ShieldCheck, HelpCircle, Layers, PieChart, RotateCcw, Link2, Unlink
} from 'lucide-react';

interface BankReconciliationProps {
  user: UserProfile;
}

export default function BankReconciliation({ user }: BankReconciliationProps) {
  const [activeTab, setActiveTab] = useState<'accounts' | 'import' | 'workbench' | 'charges_refunds' | 'reports'>('workbench');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [statusFilter, setStatusFilter] = useState<string>('unmatched');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Add Bank Account Form State
  const [newBankName, setNewBankName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newOpeningBalance, setNewOpeningBalance] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  // Statement Import State
  const [rawStatementInput, setRawStatementInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  // Auto-Match State
  const [autoMatching, setAutoMatching] = useState(false);

  // Manual Match Modal State
  const [matchModalStatement, setMatchModalStatement] = useState<BankStatement | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedMatchCategory, setSelectedMatchCategory] = useState<'student_fee' | 'bank_charge' | 'refund' | 'transfer' | 'ignored'>('student_fee');
  const [matchNotes, setMatchNotes] = useState('');
  const [submittingMatch, setSubmittingMatch] = useState(false);

  // Bank Charges & Refunds State
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeType, setChargeType] = useState('maintenance');
  const [chargeDesc, setChargeDesc] = useState('');
  const [submittingCharge, setSubmittingCharge] = useState(false);

  const [refundStudentUid, setRefundStudentUid] = useState('');
  const [refundInvoiceId, setRefundInvoiceId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Verification Search State
  const [verifyRefInput, setVerifyRefInput] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'workbench' || activeTab === 'reports') {
      fetchStatementsAndReport();
    }
  }, [selectedAccountId, statusFilter, categoryFilter, activeTab]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [accRes, invRes, stuRes] = await Promise.all([
        api.get('/finances/bank-accounts'),
        api.get('/finances/invoices'),
        api.get('/accounts/users?role=student')
      ]);
      setBankAccounts(accRes.data);
      if (accRes.data.length > 0) {
        setSelectedAccountId(accRes.data[0].id);
      }
      setInvoices(invRes.data);
      setStudents(stuRes.data);
      await fetchStatementsAndReport();
    } catch (error) {
      toast.error('Failed to load banking reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatementsAndReport = async () => {
    try {
      let query = '/finances/bank-statements?';
      if (selectedAccountId) query += `bankAccountId=${selectedAccountId}&`;
      if (statusFilter) query += `reconciliationStatus=${statusFilter}&`;
      if (categoryFilter) query += `category=${categoryFilter}&`;
      if (searchTerm) query += `search=${encodeURIComponent(searchTerm)}&`;

      const [stmtRes, reportRes] = await Promise.all([
        api.get(query),
        api.get(`/finances/reconciliation-report${selectedAccountId ? `?bankAccountId=${selectedAccountId}` : ''}`)
      ]);
      setStatements(stmtRes.data);
      setReport(reportRes.data);
    } catch (error) {
      console.error('Failed to update statement records:', error);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName || !newAccountName || !newAccountNumber) {
      return toast.error('Bank Name, Account Name, and Account Number are required');
    }

    try {
      setAddingAccount(true);
      const res = await api.post('/finances/bank-accounts', {
        bankName: newBankName,
        accountName: newAccountName,
        accountNumber: newAccountNumber,
        openingBalance: Number(newOpeningBalance) || 0
      });
      toast.success('Business Bank Account registered successfully');
      setNewBankName('');
      setNewAccountName('');
      setNewAccountNumber('');
      setNewOpeningBalance('');
      setBankAccounts([...bankAccounts, res.data]);
      if (!selectedAccountId) setSelectedAccountId(res.data.id);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add bank account');
    } finally {
      setAddingAccount(false);
    }
  };

  const handleParseStatementText = () => {
    if (!rawStatementInput.trim()) {
      return toast.error('Please paste or enter bank statement data');
    }

    try {
      // Check if JSON
      if (rawStatementInput.trim().startsWith('[') || rawStatementInput.trim().startsWith('{')) {
        const json = JSON.parse(rawStatementInput);
        const list = Array.isArray(json) ? json : [json];
        setParsedPreview(list);
        toast.success(`Parsed ${list.length} JSON statement entries`);
        return;
      }

      // CSV parsing
      const lines = rawStatementInput.trim().split('\n');
      const parsed: any[] = [];
      lines.forEach((line, idx) => {
        const parts = line.split(',').map((p) => p.trim().replace(/^"/, '').replace(/"$/, ''));
        if (parts.length >= 3) {
          // If header row
          if (idx === 0 && (parts[0].toLowerCase().includes('date') || parts[1].toLowerCase().includes('desc'))) {
            return;
          }
          const txDate = parts[0] || new Date().toISOString().split('T')[0];
          const desc = parts[1] || 'Bank Transaction';
          const ref = parts[2] || '';
          const amtStr = parts[3] || '0';
          const amt = Math.abs(parseFloat(amtStr.replace(/[^0-9.-]+/g, '')) || 0);
          const type = (parts[4] || (parseFloat(amtStr) >= 0 ? 'credit' : 'debit')).toLowerCase();

          parsed.push({
            transactionDate: txDate,
            description: desc,
            transactionRef: ref,
            amount: amt,
            type: type.includes('debit') ? 'debit' : 'credit'
          });
        }
      });

      if (parsed.length === 0) {
        toast.error('Could not parse valid CSV statement entries. Please check formatting.');
      } else {
        setParsedPreview(parsed);
        toast.success(`Parsed ${parsed.length} CSV statement entries for preview`);
      }
    } catch (e) {
      toast.error('Failed to parse statement input. Ensure JSON or CSV format.');
    }
  };

  const handleImportCommit = async () => {
    if (!selectedAccountId) {
      return toast.error('Please select a business bank account');
    }
    if (parsedPreview.length === 0) {
      return toast.error('No statement entries parsed for import');
    }

    try {
      setImporting(true);
      const res = await api.post('/finances/bank-statements/import', {
        bankAccountId: selectedAccountId,
        statements: parsedPreview
      });
      toast.success(res.data.message || 'Bank statement imported successfully');
      setParsedPreview([]);
      setRawStatementInput('');
      await fetchInitialData();
      setActiveTab('workbench');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to import bank statement');
    } finally {
      setImporting(false);
    }
  };

  const handleRunAutoMatch = async () => {
    try {
      setAutoMatching(true);
      const res = await api.post('/finances/reconcile/auto-match', {
        bankAccountId: selectedAccountId
      });
      toast.success(res.data.message);
      await fetchStatementsAndReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Auto-matching engine failed');
    } finally {
      setAutoMatching(false);
    }
  };

  const handleManualMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchModalStatement) return;

    try {
      setSubmittingMatch(true);
      await api.post('/finances/reconcile/manual-match', {
        statementId: matchModalStatement.id,
        invoiceId: selectedInvoiceId || undefined,
        category: selectedMatchCategory,
        notes: matchNotes
      });
      toast.success('Bank statement reconciled successfully');
      setMatchModalStatement(null);
      setSelectedInvoiceId('');
      setMatchNotes('');
      await fetchStatementsAndReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reconcile statement');
    } finally {
      setSubmittingMatch(false);
    }
  };

  const handleUnmatch = async (stmtId: string) => {
    try {
      await api.post('/finances/reconcile/unmatch', { statementId: stmtId });
      toast.success('Statement status reset to unmatched');
      await fetchStatementsAndReport();
    } catch (error) {
      toast.error('Failed to unmatch statement');
    }
  };

  const handleRecordCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !chargeAmount) {
      return toast.error('Bank account and charge amount required');
    }

    try {
      setSubmittingCharge(true);
      await api.post('/finances/bank-charges', {
        bankAccountId: selectedAccountId,
        chargeType,
        amount: Number(chargeAmount),
        description: chargeDesc || 'Bank Service Charge'
      });
      toast.success('Bank charge logged successfully');
      setChargeAmount('');
      setChargeDesc('');
      await fetchStatementsAndReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to record bank charge');
    } finally {
      setSubmittingCharge(false);
    }
  };

  const handleRecordRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundStudentUid || !refundAmount) {
      return toast.error('Student and refund amount required');
    }

    try {
      setSubmittingRefund(true);
      await api.post('/finances/refunds', {
        studentUid: refundStudentUid,
        invoiceId: refundInvoiceId || undefined,
        amount: Number(refundAmount),
        reason: refundReason || 'Student Fee Refund'
      });
      toast.success('Student fee refund processed successfully');
      setRefundStudentUid('');
      setRefundInvoiceId('');
      setRefundAmount('');
      setRefundReason('');
      await fetchStatementsAndReport();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handleVerifyProviderRef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyRefInput.trim()) return;

    try {
      setVerifying(true);
      const res = await api.post('/finances/payment-provider/verify', {
        reference: verifyRefInput.trim()
      });
      setVerifyResult(res.data);
    } catch (error) {
      toast.error('Gateway reference verification lookup failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-[#008751] font-bold flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Loading Banking & School Fee Reconciliation Engine...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#008751] to-emerald-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-widest mb-1">
            <Building2 className="w-4 h-4" /> Treasury & Bursar Office
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Banking & Fee Reconciliation</h1>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1">
            Automated Bank Statement Matching • Duplicate Prevention • Audit Ledgers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="bg-emerald-900 border border-emerald-700 text-white text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-white"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            <option value="">-- All Bank Accounts --</option>
            {bankAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.bankName} - {acc.accountNumber} (₦{Number(acc.currentBalance).toLocaleString()})
              </option>
            ))}
          </select>

          <button
            onClick={handleRunAutoMatch}
            disabled={autoMatching}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-lg transition flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoMatching ? 'animate-spin' : ''}`} />
            {autoMatching ? 'Matching...' : 'Auto-Match Engine'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('workbench')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
            activeTab === 'workbench'
              ? 'bg-[#008751] text-white shadow-md'
              : 'bg-slate-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4" /> Reconciliation Workbench
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
            activeTab === 'import'
              ? 'bg-[#008751] text-white shadow-md'
              : 'bg-slate-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Upload className="w-4 h-4" /> Import Statement
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
            activeTab === 'accounts'
              ? 'bg-[#008751] text-white shadow-md'
              : 'bg-slate-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-4 h-4" /> Bank Accounts ({bankAccounts.length})
        </button>
        <button
          onClick={() => setActiveTab('charges_refunds')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
            activeTab === 'charges_refunds'
              ? 'bg-[#008751] text-white shadow-md'
              : 'bg-slate-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <DollarSign className="w-4 h-4" /> Charges & Fee Refunds
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'bg-[#008751] text-white shadow-md'
              : 'bg-slate-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <PieChart className="w-4 h-4" /> Executive Summary & Reports
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: RECONCILIATION WORKBENCH */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'workbench' && (
        <div className="space-y-6">
          {/* Summary Mini Cards */}
          {report && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Statement Credits</p>
                <p className="text-lg font-black text-emerald-700">₦{Number(report.totalStatementCredits).toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Reconciled Fee Credits</p>
                <p className="text-lg font-black text-blue-700">₦{Number(report.matchedCreditAmount).toLocaleString()}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Unreconciled Items</p>
                <p className="text-lg font-black text-amber-600">{report.unmatchedCount} Items (₦{Number(report.unmatchedCreditAmount).toLocaleString()})</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Bank Charges / Refunds</p>
                <p className="text-lg font-black text-purple-700">₦{(Number(report.totalBankCharges) + Number(report.totalFeeRefunds)).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </span>
              <select
                className="p-2 border rounded-xl text-xs font-semibold border-gray-200"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="unmatched">Unmatched Only</option>
                <option value="matched">Matched / Reconciled</option>
                <option value="ignored">Ignored</option>
              </select>

              <select
                className="p-2 border rounded-xl text-xs font-semibold border-gray-200"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="student_fee">Student Fee Payments</option>
                <option value="bank_charge">Bank Service Charges</option>
                <option value="refund">Fee Refunds</option>
                <option value="unclassified">Unclassified</option>
              </select>
            </div>

            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search ref or narration..."
                className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs border-gray-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Statements Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-gray-800">
                Bank Statement Transactions ({statements.length})
              </h3>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Data Isolation Enforced
              </span>
            </div>

            {statements.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                No statement records found. Upload a statement via "Import Statement" or adjust filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold uppercase border-b">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Description / Narration</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {statements.map((stmt) => (
                      <tr key={stmt.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 whitespace-nowrap text-gray-600 font-medium">
                          {new Date(stmt.transactionDate).toLocaleDateString()}
                        </td>
                        <td className="p-3 font-mono text-emerald-800 font-bold whitespace-nowrap">
                          {stmt.transactionRef}
                        </td>
                        <td className="p-3 text-gray-800 font-medium max-w-xs truncate" title={stmt.description}>
                          {stmt.description}
                        </td>
                        <td className="p-3 whitespace-nowrap font-bold">
                          <span className={`flex items-center gap-1 ${stmt.type === 'credit' ? 'text-emerald-700' : 'text-red-600'}`}>
                            {stmt.type === 'credit' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            ₦{Number(stmt.amount).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 uppercase">
                            {stmt.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            stmt.reconciliationStatus === 'matched' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            stmt.reconciliationStatus === 'ignored' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {stmt.reconciliationStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          {stmt.reconciliationStatus === 'unmatched' ? (
                            <button
                              onClick={() => {
                                setMatchModalStatement(stmt);
                                setSelectedInvoiceId(stmt.matchedInvoiceId || '');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-bold text-[11px] shadow transition flex items-center gap-1 ml-auto"
                            >
                              <Link2 className="w-3 h-3" /> Reconcile Match
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnmatch(stmt.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-lg font-bold text-[11px] border border-red-200 transition flex items-center gap-1 ml-auto"
                            >
                              <Unlink className="w-3 h-3" /> Unmatch
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: IMPORT BANK STATEMENT */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'import' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" /> Safe Bank Statement Import
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Import CSV or JSON formatted bank statement files. Duplicate transactions are automatically detected and prevented.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Target Business Bank Account</label>
                <select
                  className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="">-- Choose Target Account --</option>
                  {bankAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountNumber} ({acc.accountName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Paste Bank Statement Data (CSV or JSON)
                </label>
                <textarea
                  rows={8}
                  placeholder={`Example CSV lines:\n2026-03-01, Tuition Fee Payment John, TX_9001, 150000, credit\n2026-03-02, Bank Charge, CHG_882, 50, debit`}
                  className="w-full p-3 font-mono text-xs border rounded-xl border-gray-200 focus:ring-2 focus:ring-emerald-500"
                  value={rawStatementInput}
                  onChange={(e) => setRawStatementInput(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleParseStatementText}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-3 rounded-xl transition flex items-center gap-2"
                >
                  <Search className="w-4 h-4" /> Preview Parsed Statements
                </button>
              </div>
            </div>

            {/* Preview Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-xs text-gray-700 uppercase tracking-wider mb-2">
                  Parsed Entry Preview ({parsedPreview.length} entries)
                </h3>

                {parsedPreview.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    No entries parsed yet. Paste CSV/JSON statement data and click "Preview Parsed Statements".
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {parsedPreview.map((item, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-gray-200 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-800">{item.description}</p>
                          <p className="text-[10px] text-gray-400 font-mono">Ref: {item.transactionRef || 'Auto-Ref'} • Date: {item.transactionDate}</p>
                        </div>
                        <span className={`font-bold ${item.type === 'debit' ? 'text-red-600' : 'text-emerald-700'}`}>
                          ₦{Number(item.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {parsedPreview.length > 0 && (
                <div className="pt-4 border-t border-gray-200 mt-4 flex justify-end">
                  <button
                    onClick={handleImportCommit}
                    disabled={importing}
                    className="bg-[#008751] hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg transition flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {importing ? 'Importing...' : `Confirm Safe Import (${parsedPreview.length} Entries)`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: BUSINESS BANK ACCOUNTS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" /> Register Business Bank Account
            </h2>
            <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. First Bank, Access Bank"
                  className="w-full p-3 border rounded-xl text-xs border-gray-200"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. UniPortal Main Registry"
                  className="w-full p-3 border rounded-xl text-xs border-gray-200"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Account Number</label>
                <input
                  type="text"
                  placeholder="10-digit Account No"
                  className="w-full p-3 border rounded-xl text-xs border-gray-200"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Opening Balance (₦)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000000"
                  className="w-full p-3 border rounded-xl text-xs border-gray-200"
                  value={newOpeningBalance}
                  onChange={(e) => setNewOpeningBalance(e.target.value)}
                />
              </div>

              <div className="md:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={addingAccount}
                  className="bg-[#008751] hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow transition flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  {addingAccount ? 'Saving...' : 'Add Business Account'}
                </button>
              </div>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                      Active Account
                    </span>
                    <h3 className="font-extrabold text-base text-gray-900 mt-2">{acc.bankName}</h3>
                    <p className="text-xs font-semibold text-gray-500">{acc.accountName}</p>
                    <p className="text-xs font-mono font-bold text-gray-800 mt-1">{acc.accountNumber}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Current Ledger Balance</p>
                    <p className="text-xl font-black text-emerald-800">₦{Number(acc.currentBalance).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAccountId(acc.id);
                      setActiveTab('workbench');
                    }}
                    className="text-xs font-bold text-[#008751] hover:underline"
                  >
                    View Ledger &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: BANK CHARGES & FEE REFUNDS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'charges_refunds' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Record Bank Charge */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" /> Log Bank Service Charge
            </h2>
            <form onSubmit={handleRecordCharge} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Select Bank Account</label>
                <select
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="">-- Choose Account --</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.bankName} - {a.accountNumber}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Charge Type</label>
                <select
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={chargeType}
                  onChange={(e) => setChargeType(e.target.value)}
                >
                  <option value="maintenance">Monthly Account Maintenance Fee</option>
                  <option value="transfer_fee">Electronic Transfer Fee</option>
                  <option value="stamp_duty">Government Stamp Duty</option>
                  <option value="other">Other Bank Fee</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Charge Amount (₦)</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="Narration details"
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={chargeDesc}
                  onChange={(e) => setChargeDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submittingCharge}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-3 rounded-xl transition"
              >
                {submittingCharge ? 'Logging...' : 'Record Bank Service Charge'}
              </button>
            </form>
          </div>

          {/* Record Student Fee Refund */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-purple-600" /> Process Student Fee Refund
            </h2>
            <form onSubmit={handleRecordRefund} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Select Student</label>
                <select
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={refundStudentUid}
                  onChange={(e) => setRefundStudentUid(e.target.value)}
                >
                  <option value="">-- Select Student --</option>
                  {students.map((s) => (
                    <option key={s.uid} value={s.uid}>{s.name} ({s.matricNo || s.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Linked Invoice (Optional)</label>
                <select
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={refundInvoiceId}
                  onChange={(e) => setRefundInvoiceId(e.target.value)}
                >
                  <option value="">-- None / General Refund --</option>
                  {invoices.filter(i => !refundStudentUid || i.studentUid === refundStudentUid).map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - {inv.title} (₦{Number(inv.totalAmount).toLocaleString()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Refund Amount (₦)</label>
                <input
                  type="number"
                  placeholder="e.g. 20000"
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Reason for Refund</label>
                <input
                  type="text"
                  placeholder="e.g. Duplicate overpayment refund"
                  className="w-full p-2.5 border rounded-xl text-xs border-gray-200"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submittingRefund}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-3 rounded-xl transition"
              >
                {submittingRefund ? 'Processing...' : 'Process & Audit Student Refund'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 5: EXECUTIVE REPORTS & VERIFICATION TOOL */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'reports' && report && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Reconciliation Report & Ledger Summary</h2>
                <p className="text-xs text-gray-500">School Bursar Official Treasury Verification Audit</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                report.isReconciled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {report.isReconciled ? '✅ Fully Reconciled & Balanced' : '⚠️ Pending Reconcile Items'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <h3 className="font-bold text-xs text-gray-700 uppercase">Bank Ledger Audit</h3>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Opening Balances:</span>
                  <span className="font-bold">₦{Number(report.totalOpeningBalance).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Bank Credits:</span>
                  <span className="font-bold text-emerald-700">+₦{Number(report.totalStatementCredits).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Bank Debits:</span>
                  <span className="font-bold text-red-600">-₦{Number(report.totalStatementDebits).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t font-extrabold text-gray-900">
                  <span>Current Bank Balance:</span>
                  <span>₦{Number(report.totalCurrentBankBalance).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <h3 className="font-bold text-xs text-gray-700 uppercase">Portal Student Fee Ledger</h3>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Portal Fee Revenue:</span>
                  <span className="font-bold text-emerald-700">₦{Number(report.totalPortalCollectedFees).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Reconciled Fee Credits:</span>
                  <span className="font-bold text-blue-700">₦{Number(report.matchedCreditAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Total Fee Refunds:</span>
                  <span className="font-bold text-purple-700">₦{Number(report.totalFeeRefunds).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t font-extrabold text-gray-900">
                  <span>Outstanding Student Fees:</span>
                  <span className="text-amber-700">₦{Number(report.totalOutstandingInvoices).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Provider Reference Lookup Tool */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Payment-Provider Gateway Verification
            </h3>
            <form onSubmit={handleVerifyProviderRef} className="flex gap-3">
              <input
                type="text"
                placeholder="Enter Transaction / Remita / Bank Reference (e.g. TX_REF_1001)"
                className="flex-grow p-3 border rounded-xl text-xs font-mono border-gray-200"
                value={verifyRefInput}
                onChange={(e) => setVerifyRefInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={verifying}
                className="bg-[#008751] text-white font-bold text-xs px-6 py-3 rounded-xl transition"
              >
                {verifying ? 'Checking...' : 'Verify Gateway Status'}
              </button>
            </form>

            {verifyResult && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                <p className="font-bold text-emerald-900">
                  Verification Status: {verifyResult.verified ? '✅ Verified Valid Transaction' : '❌ Unverified Reference'}
                </p>
                <p className="text-gray-600 font-mono">Reference: {verifyResult.reference} • Gateway: {verifyResult.provider}</p>
                {verifyResult.existingPayment && (
                  <p className="text-emerald-800 font-semibold">Matched Payment Amount: ₦{Number(verifyResult.existingPayment.amount).toLocaleString()}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Match Modal */}
      {matchModalStatement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-gray-900">Manual Reconciliation & Linkage</h3>
              <button onClick={() => setMatchModalStatement(null)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
              <p className="font-bold text-gray-800">{matchModalStatement.description}</p>
              <p className="text-gray-500 font-mono">Ref: {matchModalStatement.transactionRef} • Amount: ₦{Number(matchModalStatement.amount).toLocaleString()}</p>
            </div>

            <form onSubmit={handleManualMatchSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Classification Category</label>
                <select
                  className="w-full p-2.5 border rounded-xl text-xs"
                  value={selectedMatchCategory}
                  onChange={(e) => setSelectedMatchCategory(e.target.value as any)}
                >
                  <option value="student_fee">Student School Fee Payment</option>
                  <option value="bank_charge">Bank Service Charge</option>
                  <option value="refund">Fee Refund</option>
                  <option value="ignored">Ignore Entry</option>
                </select>
              </div>

              {selectedMatchCategory === 'student_fee' && (
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Select Student Fee Invoice to Match</label>
                  <select
                    className="w-full p-2.5 border rounded-xl text-xs"
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  >
                    <option value="">-- Choose Fee Invoice --</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} - {inv.User?.name || inv.studentUid} (Bal: ₦{Number(inv.balance).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-gray-700 block mb-1">Reconciliation Notes</label>
                <input
                  type="text"
                  placeholder="Audit reason or note"
                  className="w-full p-2.5 border rounded-xl text-xs"
                  value={matchNotes}
                  onChange={(e) => setMatchNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMatchModalStatement(null)}
                  className="px-4 py-2 border rounded-xl font-bold text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMatch}
                  className="px-5 py-2 bg-[#008751] hover:bg-emerald-700 text-white rounded-xl font-bold"
                >
                  {submittingMatch ? 'Saving...' : 'Confirm Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
