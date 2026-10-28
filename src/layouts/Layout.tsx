import { ReactNode, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { auth, signOut } from '../firebase';
import { UserProfile } from '../types';
import { useSocket } from '../hooks/useSocket';
import AITutor from '../components/AITutor';
import {
  GraduationCap, LogOut, User as UserIcon, ShieldCheck, 
  Home, BookOpen, LayoutGrid, FileText, CreditCard, Menu, X, Bot
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  user: UserProfile | null;
}

export default function Layout({ children, user }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Initialize Real-time Socket Connection
  useSocket(user?.uid);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/');
      setIsMenuOpen(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-[#008751] flex flex-col selection:bg-[#008751] selection:text-white">
      <AITutor user={user} />
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-[#008751]/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-10">
          <div className="flex justify-between h-14 sm:h-20 items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0" onClick={() => setIsMenuOpen(false)}>
              <div className="w-9 h-9 sm:w-12 sm:h-12 bg-slate-50 border border-[#008751]/20 text-[#008751] rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                <GraduationCap className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div className="flex flex-col">
                <span className="text-base sm:text-xl font-black uppercase tracking-tighter italic leading-none">LUKKE PORTAL</span>
                <span className="text-[8px] sm:text-[9px] font-bold opacity-40 uppercase tracking-[0.2em] mt-1 hidden sm:block">Federal University Lukke</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2">
              <NavLink to="/" active={isActive('/')} icon={<Home className="w-4 h-4" />}>Home</NavLink>
              <NavLink to="/entrance-exam" active={isActive('/entrance-exam')} icon={<GraduationCap className="w-4 h-4" />}>Entrance Exam</NavLink>
              {user && (
                <>
                  <NavLink to="/admission" active={isActive('/admission')} icon={<FileText className="w-4 h-4" />}>Registry</NavLink>
                  {user.role === 'student' && (
                    <>
                      <NavLink to="/portal" active={isActive('/portal')} icon={<LayoutGrid className="w-4 h-4" />}>Dashboard</NavLink>
                      <NavLink to="/courses" active={isActive('/courses')} icon={<BookOpen className="w-4 h-4" />}>Academics</NavLink>
                      <NavLink to="/payments" active={isActive('/payments')} icon={<CreditCard className="w-4 h-4" />}>Treasury</NavLink>
                    </>
                  )}
                  {['bursar', 'admin', 'school_owner'].includes(user.role) && (
                    <NavLink to="/reconciliation" active={isActive('/reconciliation')} icon={<CreditCard className="w-4 h-4" />}>Reconciliation</NavLink>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {user ? (
                <div className="hidden sm:flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-[#008751]/10">
                  <div className="text-right">
                    <div className="text-xs font-black uppercase tracking-tighter">{user.name.split(' ')[0]}</div>
                    <div className="text-[7px] font-black opacity-30 uppercase tracking-[0.3em]">Verified {user.role}</div>
                  </div>
                  <div className="w-9 h-9 bg-white border border-[#008751]/20 rounded-xl flex items-center justify-center overflow-hidden ring-2 ring-white">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-5 h-5" />
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-[#008751] text-white px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-xs hover:bg-[#006e41] transition active:scale-95 hidden sm:block"
                >
                  Login
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-1.5 sm:p-2.5 rounded-xl bg-slate-50 border border-[#008751]/10 text-[#008751] hover:bg-[#008751]/5 transition-colors"
                aria-label="Toggle Menu"
              >
                {isMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`lg:hidden transition-all duration-300 ease-in-out border-b border-[#008751]/10 bg-white/95 backdrop-blur-xl overflow-hidden ${isMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 py-3 space-y-2">
            <MobileNavLink to="/" active={isActive('/')} onClick={() => setIsMenuOpen(false)}>Home</MobileNavLink>
            <MobileNavLink to="/entrance-exam" active={isActive('/entrance-exam')} onClick={() => setIsMenuOpen(false)}>Entrance Exam</MobileNavLink>
            {user && (
              <>
                <MobileNavLink to="/admission" active={isActive('/admission')} onClick={() => setIsMenuOpen(false)}>Registry</MobileNavLink>
                {user.role === 'student' && (
                  <>
                    <MobileNavLink to="/portal" active={isActive('/portal')} onClick={() => setIsMenuOpen(false)}>Dashboard</MobileNavLink>
                    <MobileNavLink to="/courses" active={isActive('/courses')} onClick={() => setIsMenuOpen(false)}>Academics</MobileNavLink>
                    <MobileNavLink to="/payments" active={isActive('/payments')} onClick={() => setIsMenuOpen(false)}>Treasury</MobileNavLink>
                  </>
                )}
                {user.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-600 font-bold uppercase tracking-wider text-xs border border-amber-200"
                  >
                    <ShieldCheck className="w-4 h-4" /> Admin Control
                  </Link>
                )}
                <div className="pt-2 mt-2 border-t border-[#008751]/10">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-red-50 text-red-600 font-bold uppercase tracking-wider text-xs border border-red-100"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </>
            )}
            {!user && (
              <Link 
                to="/auth" 
                onClick={() => setIsMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#008751] text-white font-bold uppercase tracking-wider text-xs shadow-md"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Admin Quick Access bar for Admin users on desktop */}
      {user?.role === 'admin' && !location.pathname.startsWith('/admin') && (
        <div className="bg-amber-500 py-2.5 px-6 flex justify-between items-center text-white text-[10px] font-black uppercase tracking-[0.3em] animate-in fade-in slide-in-from-top duration-500">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3" />
            Superuser Administrative Session Active
          </span>
          <Link to="/admin" className="underline underline-offset-4 hover:opacity-80 transition-opacity">
            Open Admin Control Panel
          </Link>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-grow relative overflow-hidden bg-white">
        <div className="absolute top-0 right-0 w-[1200px] h-[1200px] bg-[#008751]/5 blur-[200px] rounded-full -translate-y-1/3 translate-x-1/2 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 relative z-10">
          {children}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-50 border-t border-[#008751]/10 py-8 sm:py-16 mt-8 sm:mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8">
           <div className="flex justify-center gap-10 opacity-30 text-[#008751]">
              <ShieldCheck className="w-6 h-6" />
              <GraduationCap className="w-6 h-6" />
              <FileText className="w-6 h-6" />
           </div>
 
           <p className="text-[9px] font-black text-[#008751]/40 uppercase tracking-[0.1em]">
             © 2026 Federal University Lukke • Central Registry Synchronization Active
           </p>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, children, active, icon }: { to: string; children: ReactNode; active: boolean; icon?: ReactNode }) {
  return (
    <Link
      to={to}
      className={`
        px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all duration-300
        ${active 
          ? 'bg-[#008751]/10 text-[#008751] ring-1 ring-[#008751]/20' 
          : 'text-[#008751]/50 hover:text-[#008751] hover:bg-[#008751]/5'
        }
      `}
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileNavLink({ to, children, active, onClick }: { to: string; children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        block py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-all
        ${active 
          ? 'bg-[#008751] text-white shadow-md shadow-[#008751]/20'
          : 'bg-slate-50 text-[#008751]/60 border border-[#008751]/5'
        }
      `}
    >
      {children}
    </Link>
  );
}

