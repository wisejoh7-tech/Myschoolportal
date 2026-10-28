import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'sonner';
import { Lock, Mail, ShieldCheck, Eye, EyeOff, ArrowRight, User, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile } from '../../types';

interface AdminAuthProps {
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

export default function AdminAuth({ onLoginSuccess }: AdminAuthProps) {
  const [name, setName] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [signUpMode, setSignUpMode] = useState(false);
  const navigate = useNavigate();

  const ADMIN_SECRET = 'LUKKE-ADMIN-26';

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (resetMode) {
        toast.info('Administrative Recovery Protocol Dispatched (Simulation)');
        setResetMode(false);
      } else if (signUpMode) {
        if (secretCode.toUpperCase().trim() !== ADMIN_SECRET) {
          toast.error('Invalid Administrative Secret Key');
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          setLoading(false);
          return;
        }

        if (getPasswordStrength(password) < 80) {
          toast.error('Password too weak — must include symbols/special characters');
          setLoading(false);
          return;
        }
        
        const names = name.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        await api.post('/accounts/register/', {
          username: email,
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          role: 'admin'
        });

        toast.success('Admin account created successfully.');
        setSignUpMode(false);
      } else {
        const response = await api.post('/token/', {
          username: username || email,
          password,
        });

        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);

        // Verify role
        const userResponse = await api.get('/accounts/user/');
        if (['admin', 'school_owner'].includes(userResponse.data.role)) {
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
          toast.success(`Welcome back, ${djangoUser.role === 'school_owner' ? 'School Owner' : 'Admin'}`);
          navigate(djangoUser.role === 'school_owner' ? '/owner' : '/admin');
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          toast.error('Access Denied: Administrative Role Required');
        }
      }
    } catch (error: any) {
      console.error('Admin Auth error:', error);
      let errorMsg = 'Authentication failed';

      if (!error.response) {
        errorMsg = 'Server unreachable. Is the Django backend running on port 8000?';
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
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-6 bg-slate-50 font-sans selection:bg-emerald-500 selection:text-white">

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        {/* LOGO & HEADER */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{signUpMode ? 'Admin Registry' : 'Admin Login'}</h2>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">Institutional Access Control</p>
          </div>
        </div>

        {/* LOGIN FORM */}
        <div className="bg-white border border-slate-200 p-10 rounded-[2rem] shadow-sm">
          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div className="space-y-4">
              {signUpMode && (
                <>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                    <input
                      type="text"
                      required
                      placeholder="Your Full Name"
                      className="w-full bg-slate-50 border border-slate-200 p-3 pl-12 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />  
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                    <input
                      type="password"
                      required
                      placeholder="SECRET ACCESS KEY"
                      className="w-full bg-slate-50 border border-slate-200 p-3 pl-12 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all uppercase tracking-widest"
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                <input
                  type="text"
                  required
                  placeholder="Admin Username or Email"
                  className="w-full bg-slate-50 border border-slate-200 p-3 pl-12 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {!resetMode && (
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Password"
                    className="w-full bg-slate-50 border border-slate-200 p-3 pl-12 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              )}

              {signUpMode && (
                <div className="relative group">
                  <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Confirm Password"
                    className="w-full bg-slate-50 border border-slate-200 p-3 pl-12 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              )}

              {signUpMode && (
                <div className="px-1 pt-2 space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-400 italic">
                    <span>Security Rating</span>
                    <span>{getPasswordStrength(password)}%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${getPasswordStrength(password)}%` }} className={`h-full rounded-full ${getPasswordStrength(password) < 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  </div>
                  <p className="text-[8px] font-medium text-slate-400 uppercase leading-relaxed">
                    * Required: Symbols (!@#$%) + Uppercase + Numbers
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {resetMode ? 'Initialize Recovery' : signUpMode ? 'Create Admin Account' : 'Authorize Login'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button
              onClick={() => setSignUpMode(!signUpMode)}
              className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-emerald-600 transition-colors"
            >
              {signUpMode ? '← Return to Login' : 'Request Registry Access'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
