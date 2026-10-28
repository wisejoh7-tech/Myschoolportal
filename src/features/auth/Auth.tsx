import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import { Mail, Lock, User, LogIn, UserPlus, Eye, EyeOff, AlertCircle, ArrowRight, GraduationCap, Building2, Bell, BookOpen, Fingerprint, CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UniversityName, UserProfile } from '../../types';
import CandidateRegistrationSlip, { CandidateData } from '../../components/CandidateRegistrationSlip';

interface AuthProps {
  onLoginSuccess?: (user: UserProfile) => void;
}

const getPasswordStrength = (password: string) => {
  let strength = 0;
  if (password.length >= 8) strength += 20;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/[a-z]/.test(password)) strength += 20;
  if (/[0-9]/.test(password)) strength += 20;
  if (/[^A-Za-z0-9]/.test(password)) strength += 20;
  return strength;
};

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [university, setUniversity] = useState<UniversityName>('LUKKE');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [registeredCandidate, setRegisteredCandidate] = useState<CandidateData | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (resetMode) {
        toast.info('Password reset link sent (Simulation)');
        setResetMode(false);
      } else if (isLogin) {
        const response = await api.post('/token/', {
          username: username || email,
          password: password,
        });
        
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        
        try {
          const userResponse = await api.get('/accounts/user/');
          const djangoUser = userResponse.data;
          const userProfile: UserProfile = {
            uid: djangoUser.id.toString(),
            email: djangoUser.email,
            role: djangoUser.role,
            name: `${djangoUser.first_name || ''} ${djangoUser.last_name || ''}`.trim() || djangoUser.username,
            university: 'UniPortal',
            photoUrl: '',
            faculty: djangoUser.faculty,
            department: djangoUser.department,
          };
          if (onLoginSuccess) {
            onLoginSuccess(userProfile);
          }
          toast.success('Login successful');
          if (userProfile.role === 'admin') {
            navigate('/admin');
          } else if (userProfile.role === 'school_owner') {
            navigate('/owner');
          } else if (userProfile.role === 'bursar') {
            navigate('/bursar');
          } else if (userProfile.role === 'teacher') {
            navigate('/teacher');
          } else if (userProfile.role === 'parent') {
            navigate('/parent');
          } else if (userProfile.role === 'student') {
            navigate('/portal');
          } else {
            navigate('/');
          }
        } catch (e) {
          console.error('Failed to load user profile on login:', e);
          toast.success('Login successful');
          navigate('/');
        }
      } else {
        // Validation for Registration
        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }

        if (getPasswordStrength(password) < 80) {
          toast.error('Password must include uppercase, lowercase, numbers, and symbols');
          setLoading(false);
          return;
        }

        const names = name.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        await api.post('/accounts/register/', {
          username: email,
          email: email,
          password: password,
          first_name: firstName,
          last_name: lastName,
          role: 'applicant'
        });

        const newCandidate: CandidateData = {
          name: name || email,
          email: email,
          role: 'Applicant Candidate',
          registrationDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          status: 'Registered Candidate'
        };

        setRegisteredCandidate(newCandidate);
        setShowSlipModal(true);
        toast.success('Candidate registration successful! You can now print your slip.');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMsg = 'Authentication failed';

      if (!error.response) {
        errorMsg = 'Server unreachable. Please check if the backend is running.';
      } else if (typeof error.response.data === 'string') {
        errorMsg = error.response.data;
      } else if (error.response.data) {
        const data = error.response.data;
        if (data.detail) {
          errorMsg = data.detail;
        } else if (data.error) {
          errorMsg = data.error;
        } else if (typeof data === 'object') {
          const firstVal = Object.values(data).flat()[0];
          if (firstVal) {
            errorMsg = Array.isArray(firstVal) ? firstVal[0] : String(firstVal);
          }
        }
      }

      toast.error(String(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] grid grid-cols-1 xl:grid-cols-12 gap-0 overflow-hidden rounded-2xl bg-white border border-[#008751]/10 shadow-[0_20px_80px_rgba(0,135,81,0.06)]">
      {showSlipModal && registeredCandidate && (
        <CandidateRegistrationSlip
          candidate={registeredCandidate}
          onClose={() => {
            setShowSlipModal(false);
            setIsLogin(true);
          }}
        />
      )}
      
      {/* LEFT: AUTH FORM */}
      <div className="lg:col-span-12 xl:col-span-5 p-8 md:p-12 space-y-8 border-r border-[#008751]/8 flex flex-col justify-center bg-white">
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-[#008751] tracking-tight uppercase leading-none">
              {resetMode ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account')}
            </h2>
            {(resetMode || !isLogin) && (
              <p className="text-sm font-medium text-[#008751]/40 leading-relaxed max-w-sm">
                {resetMode ? 'Enter your email to receive a password reset link.' : 'Create your candidate profile with a secure password.'}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {!isLogin && !resetMode && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#008751]/50 uppercase tracking-widest pl-1">Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#008751]/25 group-focus-within:text-[#008751] transition-colors" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 border border-[#008751]/10 focus:border-[#008751]/30 focus:bg-white outline-none transition-all text-[#008751] font-semibold placeholder:text-[#008751]/20 text-sm"
                  placeholder="e.g. John Doe Adebayo"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#008751]/50 uppercase tracking-widest pl-1">
              {isLogin ? 'Email Address or Username' : 'Email Address'}
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#008751]/25 group-focus-within:text-[#008751] transition-colors" />
              <input
                type={isLogin ? 'text' : 'email'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 border border-[#008751]/10 focus:border-[#008751]/30 focus:bg-white outline-none transition-all text-[#008751] font-semibold placeholder:text-[#008751]/20 text-sm"
                placeholder={isLogin ? "Username or email@example.com" : "you@example.com"}
              />
            </div>
          </div>

          {!resetMode && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-bold text-[#008751]/50 uppercase tracking-widest">Password</label>
                {isLogin && (
                  <button type="button" onClick={() => setResetMode(true)} className="text-[11px] font-bold text-[#008751]/50 hover:text-[#008751] hover:underline transition-colors">Forgot password?</button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#008751]/25 group-focus-within:text-[#008751] transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 rounded-xl bg-slate-50 border border-[#008751]/10 focus:border-[#008751]/30 focus:bg-white outline-none transition-all text-[#008751] font-semibold placeholder:text-[#008751]/20 text-sm"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#008751]/25 hover:text-[#008751] transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-1.5 mt-4">
                    <label className="text-[11px] font-bold text-[#008751]/50 uppercase tracking-widest pl-1">Confirm Password</label>
                    <div className="relative group">
                      <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#008751]/25 group-focus-within:text-[#008751] transition-colors" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 border border-[#008751]/10 focus:border-[#008751]/30 focus:bg-white outline-none transition-all text-[#008751] font-semibold placeholder:text-[#008751]/20 text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div className="px-1 pt-4 space-y-2">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-[#008751]/40 italic">
                      <span>Security Strength</span>
                      <span>{getPasswordStrength(password)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${getPasswordStrength(password)}%` }} className={`h-full rounded-full ${getPasswordStrength(password) < 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                    </div>
                    <p className="text-[8px] font-bold text-[#008751]/40 uppercase leading-relaxed tracking-wider">
                      * Required: Uppercase, Lowercase, Number, and Special Character (!@#$%)
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#008751] text-white py-4 rounded-xl font-black hover:bg-[#006e41] transition-all shadow-[0_8px_25px_rgba(0,135,81,0.2)] flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] text-sm tracking-wider uppercase"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
              <> {resetMode ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Create Account')} <ArrowRight className="w-4 h-4" /> </>
            )}
          </button>
        </form>

        <div className="pt-6 border-t border-[#008751]/8 text-center space-y-4">
            <button
               onClick={() => { if (resetMode) setResetMode(false); else setIsLogin(!isLogin); }}
               className="text-sm font-semibold text-[#008751]/50 hover:text-[#008751] transition-colors block w-full text-center"
            >
               {resetMode ? '← Back to Sign In' : (isLogin ? "Don't have an account? Create one" : 'Already have an account? Sign in')}
            </button>
            <div className="pt-2">
              <Link
                to="/lukke-core-admin-002"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#008751]/60 hover:text-[#008751] transition-colors bg-slate-50 border border-[#008751]/10 px-4 py-2 rounded-xl"
              >
                <ShieldCheck className="w-4 h-4 text-[#008751]" />
                <span>Admin Access Portal</span>
              </Link>
            </div>
        </div>
      </div>

      {/* RIGHT: INFO PANEL */}
      <div className="hidden xl:block xl:col-span-7 bg-slate-50/50 p-12 overflow-y-auto max-h-[85vh] scrollbar-hide border-l border-[#008751]/8">
         <div className="space-y-10">
            <div className="flex items-center justify-between border-b border-[#008751]/8 pb-5">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-white border border-[#008751]/10 rounded-2xl shadow-sm text-[#008751]"><Bell className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-sm font-black text-[#008751] tracking-tight uppercase">Notice Board</h3>
                    <p className="text-[9px] font-bold text-[#008751]/30 uppercase tracking-widest">Latest Updates</p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#008751] animate-pulse" />
                  <span className="text-[10px] font-bold text-[#008751]/50 bg-white border border-[#008751]/10 px-3 py-1 rounded-full uppercase tracking-tight">Online</span>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
               {[
                  { title: '2025/2026 Admission Screening Update', date: 'April 03, 2026', tag: 'URGENT', icon: <GraduationCap className="w-5 h-5" /> },
                  { title: 'Harmattan Semester Course Registration', date: 'April 01, 2026', tag: 'SESSION', icon: <BookOpen className="w-5 h-5" /> },
                  { title: 'New Biometric Verification Protocol', date: 'March 28, 2026', tag: 'SECURITY', icon: <Fingerprint className="w-5 h-5" /> },
               ].map((item, idx) => (
                  <motion.div 
                    key={idx} 
                    whileHover={{ x: 4 }}
                    className="bg-white p-6 rounded-xl border border-[#008751]/8 hover:border-[#008751]/20 shadow-sm hover:shadow-[0_4px_20px_rgba(0,135,81,0.06)] transition-all group cursor-default"
                  >
                     <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-slate-50 border border-[#008751]/8 text-[#008751]/40 rounded-xl flex items-center justify-center group-hover:text-[#008751] group-hover:border-[#008751]/20 transition-all">
                           {item.icon}
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="flex items-center gap-3">
                              <span className="text-[9px] font-black text-[#008751] uppercase tracking-widest bg-[#008751]/8 px-2.5 py-0.5 rounded-full">{item.tag}</span>
                              <span className="text-[9px] font-medium text-[#008751]/30 uppercase tracking-widest">{item.date}</span>
                           </div>
                           <h4 className="text-sm font-bold text-[#008751] tracking-tight leading-snug">{item.title}</h4>
                        </div>
                        <div className="w-9 h-9 bg-slate-50 border border-[#008751]/8 rounded-full flex items-center justify-center group-hover:bg-[#008751] group-hover:text-white group-hover:border-[#008751] transition-all">
                           <ArrowRight className="w-4 h-4 opacity-20 group-hover:opacity-100" />
                        </div>
                     </div>
                  </motion.div>
               ))}
            </div>

            <div className="p-8 bg-white border border-[#008751]/8 rounded-2xl shadow-sm">
               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-[#008751]/8 rounded-xl text-[#008751]"><Building2 className="w-6 h-6" /></div>
                     <div>
                       <p className="text-[10px] font-bold text-[#008751]/30 uppercase tracking-widest">Support</p>
                       <h3 className="text-lg font-black text-[#008751] tracking-tight uppercase">Need Help?</h3>
                     </div>
                  </div>
                  <p className="text-sm text-[#008751]/40 leading-relaxed font-medium">Having trouble signing in? Contact the registry helpdesk with your JAMB number for verification.</p>
                  <button className="w-full py-4 bg-[#008751] text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#006e41] transition-all shadow-[0_8px_25px_rgba(0,135,81,0.2)] active:scale-[0.98] flex items-center justify-center gap-2">
                     <Mail className="w-4 h-4" /> Contact Support
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
