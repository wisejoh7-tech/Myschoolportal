import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { UserProfile } from '../../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import {
  GraduationCap, Clock, CheckCircle2, AlertCircle,
  HelpCircle, ChevronRight, ChevronLeft, ShieldCheck,
  Send, Sparkles, BookOpen, Award, FileText, Printer, Check, X, Info, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CandidateRegistrationSlip from '../../components/CandidateRegistrationSlip';

interface Question {
  id: string;
  subject: string;
  question: string;
  options: string[];
  stream: string;
}

interface EntranceExamPortalProps {
  user?: UserProfile | null;
}

export default function EntranceExamPortal({ user }: EntranceExamPortalProps) {
  const [searchParams] = useSearchParams();
  const initialRegNo = searchParams.get('regNo') || user?.jambRegNo || '';

  // Step 1: Login/Reg No Entry -> Step 2: Review Instructions -> Step 3: Taking CBT Exam -> Step 4: Result Summary
  const [examStep, setExamStep] = useState<'login' | 'instructions' | 'exam' | 'submitted'>('login');

  // Registration & Stream Config
  const [regNo, setRegNo] = useState(initialRegNo);
  const [stream, setStream] = useState<'JAMB' | 'Direct Entry'>('JAMB');
  const [candidateName, setCandidateName] = useState(user?.name || '');
  const [candidateEmail, setCandidateEmail] = useState(user?.email || '');
  const [faculty, setFaculty] = useState(user?.faculty || 'Science');
  const [department, setDepartment] = useState(user?.department || 'Computer Science');
  const [jambSubjectsStr, setJambSubjectsStr] = useState('English Language, Mathematics, Physics, Chemistry');

  // Exam CBT State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeSubject, setActiveSubject] = useState<string>('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600); // 60 mins default
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  // Timer Countdown
  useEffect(() => {
    if (examStep !== 'exam' || timeLeftSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [examStep, timeLeftSeconds]);

  // Load candidate's existing result if already taken on mount
  useEffect(() => {
    const activeReg = searchParams.get('regNo') || user?.jambRegNo || '';
    if (activeReg || user?.uid) {
      checkExistingResult(activeReg, user?.uid);
    }
  }, [user, searchParams]);

  const checkExistingResult = async (reg: string, uidStr?: string) => {
    try {
      const res = await api.get('/academics/entrance-exams/my-result', {
        params: { regNo: reg || undefined, uid: uidStr || undefined }
      });
      if (res.data) {
        setSubmittedData(res.data);
        setExamStep('submitted');
      }
    } catch (e) {
      // No result found, stay on login
    }
  };

  const handleStartExam = async () => {
    if (!regNo.trim()) {
      toast.error('Please enter your Admission Registration Number or JAMB Registration Number');
      return;
    }

    try {
      const res = await api.post('/academics/entrance-exams/start', {
        registrationNumber: regNo.trim()
      });

      if (res.data.alreadyTaken) {
        toast.info('You have already taken your entrance exam.');
        setSubmittedData(res.data.submission);
        setExamStep('submitted');
        return;
      }

      if (res.data.stream) setStream(res.data.stream);
      if (res.data.faculty) setFaculty(res.data.faculty);
      if (res.data.department) setDepartment(res.data.department);

      const qList: Question[] = res.data.questions;
      if (qList.length === 0) {
        toast.error('No exam questions configured for this selection. Please contact support.');
        return;
      }

      setQuestions(qList);
      const examDuration = res.data.durationMinutes || (res.data.stream === 'Direct Entry' ? 45 : 60);
      setDurationMinutes(examDuration);
      setTimeLeftSeconds(examDuration * 60);

      const subjects = Array.from(new Set(qList.map(q => q.subject)));
      if (subjects.length > 0) {
        setActiveSubject(subjects[0]);
      } else {
        setActiveSubject('All');
      }

      setExamStep('instructions');
      toast.success('Registration verified! Please review the examination instructions.');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to initialize entrance exam session');
    }
  };

  const handleBeginExam = () => {
    setExamStep('exam');
    toast.success('Entrance Exam Started! Timer is running. Best of luck!');
  };

  const handleSelectOption = (qId: string, optionIdx: number) => {
    setUserAnswers(prev => ({ ...prev, [qId]: optionIdx }));
  };

  const handleAutoSubmit = () => {
    toast.warning('Time expired! Submitting your answers automatically...');
    handleSubmitExam();
  };

  const handleSubmitExam = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = questions.map(q => ({
        questionId: q.id,
        subject: q.subject,
        selectedOption: userAnswers[q.id] !== undefined ? userAnswers[q.id] : -1
      }));

      const payload = {
        registrationNumber: regNo.trim(),
        candidateName: candidateName || user?.name || 'Candidate',
        candidateEmail: candidateEmail || user?.email || '',
        uid: user?.uid || null,
        stream,
        faculty,
        department,
        answers: formattedAnswers
      };

      const res = await api.post('/academics/entrance-exams/submit', payload);
      toast.success('Entrance exam submitted successfully!');
      setSubmittedData(res.data.submission);
      setExamStep('submitted');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.error || 'Failed to submit entrance exam.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter questions by active subject tab
  const filteredQuestions = activeSubject === 'All'
    ? questions
    : questions.filter(q => q.subject === activeSubject);

  const subjectsList = Array.from(new Set(questions.map(q => q.subject)));

  const currentQ = filteredQuestions[currentIndex] || questions[0];

  const formatTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6 px-4 font-sans text-slate-900">

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-8 md:p-10 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-300 border border-emerald-400/30">
              <Sparkles className="w-3.5 h-3.5" /> Official CBT Testing Engine
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight italic">
              UniPortal Entrance Examination
            </h1>
            <p className="text-xs text-emerald-100/70 font-medium">
              UTME / JAMB Subject-Aligned CBT & Direct Entry Entrance Assessment
            </p>
          </div>

          {examStep === 'exam' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowInstructionsModal(true)}
                className="bg-emerald-700/80 hover:bg-emerald-700 text-white border border-emerald-500/40 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Info className="w-4 h-4 text-emerald-300" />
                <span className="hidden sm:inline">Exam Instructions</span>
              </button>
              <div className="bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 px-6 py-3 rounded-2xl flex items-center gap-3">
                <Clock className={`w-5 h-5 ${timeLeftSeconds < 300 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-emerald-300/60 font-black">Time Remaining</p>
                  <p className={`text-2xl font-black font-mono tracking-tight ${timeLeftSeconds < 300 ? 'text-rose-400' : 'text-white'}`}>
                    {formatTime(timeLeftSeconds)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* IN-EXAM INSTRUCTIONS MODAL */}
      <AnimatePresence>
        {showInstructionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Entrance Examination Instructions</h3>
                    <p className="text-xs text-slate-500">CBT Guidelines & Regulations</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstructionsModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
                  <Clock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 block mb-0.5">Time Limit & Countdown</span>
                    Total exam duration is <strong>{durationMinutes} minutes</strong>. When the timer hits 00:00, your current answers are automatically submitted.
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 block">Question Navigation & Answering</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>Use the <strong>Subject Tabs</strong> above the question to filter between different subjects.</li>
                    <li>Use the <strong>Question Navigator</strong> grid to instantly jump to any question.</li>
                    <li>Answered questions will turn <strong>green</strong> in the navigator.</li>
                    <li>You may change your selected option at any time before submitting.</li>
                  </ul>
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-start gap-3">
                  <Award className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-900 block mb-0.5">Post-Exam Result Release to Student Dashboard</span>
                    Once submitted, your responses are scored and forwarded to the <strong>Admin Control Panel</strong>. The Registry Admin will review and release your score directly to your <strong>Student Dashboard</strong> to guarantee your official admission.
                  </div>
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowInstructionsModal(false)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Return to Exam
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STEP 1: LOGIN / ENTRANCE REGISTRATION NUMBER */}
      {examStep === 'login' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">
                Candidate CBT Verification
              </h2>
              <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
                Enter your Admission Registration Number (e.g. LUK-ADM-...) or JAMB Registration Number to access your customized entrance examination player.
              </p>
            </div>

            {/* Registration Inputs */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Admission Reg Number / JAMB Reg Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 202510928374AB or LUK-ADM-..."
                  value={regNo}
                  onChange={e => setRegNo(e.target.value)}
                  className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleStartExam}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95"
            >
              Verify & Read Exam Instructions <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 2: EXAM INSTRUCTIONS & CODE OF CONDUCT */}
      {examStep === 'instructions' && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                <BookOpen className="w-8 h-8" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight italic">
                CBT Examination Instructions
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Please review candidate verification details and test rules carefully before launching your examination player.
              </p>
            </div>

            {/* Candidate Verification Card */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidate ID / Reg No</span>
                <span className="font-mono font-black text-emerald-700 text-sm">{regNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessment Stream</span>
                <span className="font-bold text-slate-800">{stream}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Questions</span>
                <span className="font-black text-slate-900">{questions.length} Questions</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Time Allowed</span>
                <span className="font-black text-emerald-700">{durationMinutes} Minutes</span>
              </div>
            </div>

            {/* Rules & Guidelines */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Test Regulations & Protocol
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <Clock className="w-4 h-4 text-emerald-600" /> 1. Countdown Timer & Auto-Submit
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Once you begin, your {durationMinutes}-minute countdown starts. The test will automatically finalize and submit when the timer reaches 00:00.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <BookOpen className="w-4 h-4 text-emerald-600" /> 2. Question Navigator & Tabs
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Filter questions by subject using the top tabs. Use the Question Navigator grid to jump to any question; answered questions turn green.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 3. Options & Answer Modification
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Select any option (A, B, C, or D). Your selection is recorded immediately. You can review and modify your answers at any point prior to final submission.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <Award className="w-4 h-4 text-amber-600" /> 4. Admin Release to Student Dashboard
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    When you submit your exam, your score is transmitted to the Admin Dashboard. The Admin reviews and releases the result to your <strong>Student Dashboard</strong>, officially guaranteeing your admission.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExamStep('login')}
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold uppercase tracking-wider transition-all"
              >
                ← Back to Verification
              </button>

              <button
                type="button"
                onClick={handleBeginExam}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95"
              >
                I Understand All Instructions — Begin Exam Now <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 3: ACTIVE CBT EXAM INTERFACE */}
      {examStep === 'exam' && currentQ && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* Subject Navigation Tabs */}
          <div className="flex bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto gap-2">
            <button
              onClick={() => { setActiveSubject('All'); setCurrentIndex(0); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeSubject === 'All' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All Questions ({questions.length})
            </button>
            {subjectsList.map(sub => (
              <button
                key={sub}
                onClick={() => { setActiveSubject(sub); setCurrentIndex(0); }}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                  activeSubject === sub ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {sub} ({questions.filter(q => q.subject === sub).length})
              </button>
            ))}
          </div>

          {/* Main Question Card & Jump Grid Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Question Display (8 cols) */}
            <div className="lg:col-span-8 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-emerald-100">
                  Subject: {currentQ.subject}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Question {currentIndex + 1} of {filteredQuestions.length}
                </span>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 leading-relaxed">
                  {currentQ.question}
                </h3>

                <div className="space-y-3 pt-2">
                  {currentQ.options?.map((option, idx) => {
                    const isSelected = userAnswers[currentQ.id] === idx;
                    const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, idx)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-black shadow-sm ring-1 ring-emerald-500'
                            : 'border-slate-200 bg-slate-50/50 text-slate-700 font-medium hover:bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {optionLetter}
                        </span>
                        <span className="text-sm">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  className="px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 disabled:opacity-40 transition-all flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                {currentIndex < filteredQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(prev => Math.min(filteredQuestions.length - 1, prev + 1))}
                    className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitExam}
                    disabled={submitting}
                    className="px-6 py-3 rounded-xl bg-emerald-800 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-900 transition-all flex items-center gap-2 shadow-lg shadow-emerald-800/20"
                  >
                    <Send className="w-4 h-4" /> Submit Entrance Exam
                  </button>
                )}
              </div>
            </div>

            {/* Jump Grid & Status (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" /> Question Navigator
                </h4>

                <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1">
                  {filteredQuestions.map((q, idx) => {
                    const isAnswered = userAnswers[q.id] !== undefined;
                    const isCurrent = idx === currentIndex;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                          isCurrent
                            ? 'ring-2 ring-emerald-500 bg-emerald-600 text-white font-black scale-105'
                            : isAnswered
                            ? 'bg-emerald-100 text-emerald-800 font-black border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex justify-between text-slate-500">
                    <span>Total Questions:</span>
                    <span className="text-slate-900 font-black">{questions.length}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Answered:</span>
                    <span className="font-black">{Object.keys(userAnswers).length}</span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>Unanswered:</span>
                    <span className="font-black">{questions.length - Object.keys(userAnswers).length}</span>
                  </div>
                </div>

                <button
                  onClick={handleSubmitExam}
                  disabled={submitting}
                  className="w-full mt-4 bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Final Submit
                </button>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* STEP 3: SUBMITTED / RESULT RELEASED STATUS */}
      {examStep === 'submitted' && submittedData && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
          {showSlipModal && (
            <CandidateRegistrationSlip
              candidate={{
                candidateId: `LUK-CBT-${submittedData.registrationNumber}`,
                name: submittedData.candidateName,
                email: submittedData.candidateEmail,
                role: 'Entrance Exam Candidate',
                programType: submittedData.stream,
                faculty: submittedData.faculty,
                department: submittedData.department,
                jambRegNo: submittedData.registrationNumber,
                status: submittedData.admissionGuaranteed ? 'ADMISSION GUARANTEED & APPROVED' : 'ENTRANCE EXAM COMPLETED',
                registrationDate: submittedData.submittedAt ? new Date(submittedData.submittedAt).toLocaleDateString() : new Date().toLocaleDateString()
              }}
              onClose={() => setShowSlipModal(false)}
            />
          )}

          <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8 text-center">

            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight italic">
                Entrance Exam Completed
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Registration Number: <span className="font-bold text-slate-900">{submittedData.registrationNumber}</span>
              </p>
            </div>

            {/* Admission Guaranteed Banner if Released */}
            {submittedData.status === 'released' || submittedData.admissionGuaranteed ? (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 rounded-2xl shadow-lg space-y-3 max-w-xl mx-auto">
                <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest bg-white/20 py-1.5 px-4 rounded-full w-fit mx-auto">
                  <Award className="w-4 h-4" /> Official Admission Released
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight italic">
                  ADMISSION GUARANTEED & APPROVED!
                </h3>
                <p className="text-xs text-emerald-100 font-medium">
                  Your CBT result has been reviewed and released by the Registry. Your admission to Federal University Lukke is officially guaranteed!
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl max-w-xl mx-auto space-y-2">
                <div className="flex items-center justify-center gap-2 text-amber-700 font-black text-xs uppercase tracking-wider">
                  <Clock className="w-4 h-4" /> Result Pending Registry Approval
                </div>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Your entrance exam score has been recorded and submitted to the Admin Dashboard. Once approved and released by the Admin, your score and admission guarantee will display here and in your Student Portal.
                </p>
              </div>
            )}

            {/* Score Breakdown Cards */}
            <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-left pt-4">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Overall Percentage</p>
                <p className="text-3xl font-black text-emerald-600">{submittedData.percentage}%</p>
                <p className="text-[10px] text-slate-500">Stream: {submittedData.stream}</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status & Admission</p>
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                  submittedData.admissionGuaranteed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {submittedData.admissionGuaranteed ? 'Admission Guaranteed' : 'Pending Admin Release'}
                </span>
                <p className="text-[10px] text-slate-500">Submitted: {new Date(submittedData.submittedAt || Date.now()).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Subject Breakdown if available */}
            {submittedData.subjectScores && Object.keys(submittedData.subjectScores).length > 0 && (
              <div className="max-w-2xl mx-auto space-y-3 text-left pt-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Subject Performance Breakdown</h4>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 divide-y divide-slate-100">
                  {Object.entries(submittedData.subjectScores).map(([sub, data]: any) => (
                    <div key={sub} className="py-2.5 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{sub}</span>
                      <span className="font-black text-emerald-600">{data.score || 0}% ({data.correct || 0}/{data.total || 0} correct)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex flex-wrap justify-center gap-4">
              <Link
                to="/portal"
                className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                Go to Student Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowSlipModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all shadow-md active:scale-95"
              >
                <Printer className="w-5 h-5" /> Print Examination Slip / Guarantee (PDF)
              </button>
            </div>

          </div>
        </motion.div>
      )}

    </div>
  );
}
