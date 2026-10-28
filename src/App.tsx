/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './api/axios';
import { UserProfile } from './types';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import AdminDashboard from './features/admin/AdminDashboard';
import OwnerDashboard from './features/admin/OwnerDashboard';
import AdminAuth from './features/auth/AdminAuth';
import StudentPortal from './features/student/StudentPortal';
import ParentDashboard from './features/parent/ParentDashboard';
import BursarDashboard from './features/finances/BursarDashboard';
import TeacherDashboard from './features/academics/TeacherDashboard';
import AdmissionForm from './features/academics/AdmissionForm';
import CourseRegistration from './features/academics/CourseRegistration';
import PaymentPortal from './features/finances/PaymentPortal';
import HostelAllocation from './features/hostel/HostelAllocation';
import Results from './features/academics/Results';
import ResultChecker from './features/academics/ResultChecker';
import PostgradPrograms from './features/academics/PostgradPrograms';
import PostgradAdmissionForm from './features/academics/PostgradAdmissionForm';
import LoanApplicationForm from './features/finances/LoanApplicationForm';
import Auth from './features/auth/Auth';
import EntranceExamPortal from './features/academics/EntranceExamPortal';
import RemitaPayment from './features/finances/RemitaPayment';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster, toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [simulatedUser, setSimulatedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const response = await api.get('/accounts/user/');
          // Mapping Django user to the existing UserProfile type
          const djangoUser = response.data;
          const userProfile: UserProfile = {
            uid: djangoUser.id.toString(),
            email: djangoUser.email,
            role: djangoUser.role,
            name: `${djangoUser.first_name} ${djangoUser.last_name}`.trim() || djangoUser.username,
            university: 'UniPortal', // default placeholder for now
            photoUrl: '',
            faculty: djangoUser.faculty,
            department: djangoUser.department,
          };
          setUser(userProfile);
        } catch (error) {
          console.error('Failed to load user:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#008751]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(22,163,74,0.4)]" />
          <p className="text-green-400 font-bold animate-pulse">Initializing UniPortal...</p>
        </div>
      </div>
    );
  }

  // Secret Admin Path (Change this in your .env or keep it private)
  const SECRET_ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || "lukke-core-admin-002";

  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" richColors />
        <ErrorBoundary>
          <Layout user={user}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/auth" element={<Auth onLoginSuccess={setUser} />} />

          {/* 🔐 HIDDEN ADMIN ENTRY: Only accessible via the secret path */}
          <Route path={`/${SECRET_ADMIN_PATH}`} element={<AdminAuth onLoginSuccess={setUser} />} />

          <Route path="/entrance-exam" element={<EntranceExamPortal user={user} />} />
          <Route path="/admission" element={user ? <AdmissionForm user={user} /> : <Navigate to="/auth" />} />
          <Route path="/portal" element={
            (simulatedUser || user)?.role === 'parent' ? <ParentDashboard user={(simulatedUser || user)!} /> :
            (simulatedUser || user)?.role === 'bursar' ? <BursarDashboard user={(simulatedUser || user)!} /> :
            (simulatedUser || user)?.role === 'teacher' ? <TeacherDashboard user={(simulatedUser || user)!} /> :
            (simulatedUser || user)?.role === 'school_owner' ? <OwnerDashboard user={(simulatedUser || user)!} /> :
            (simulatedUser || user)?.role === 'student' ? <StudentPortal user={(simulatedUser || user)!} /> :
            <Navigate to="/auth" />
          } />
          <Route path="/courses" element={(simulatedUser || user)?.role === 'student' ? <CourseRegistration user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/payments" element={(simulatedUser || user) ? <PaymentPortal user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/remita-payment" element={(simulatedUser || user) ? <RemitaPayment user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/hostels" element={(simulatedUser || user)?.role === 'student' ? <HostelAllocation user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/results" element={(simulatedUser || user) ? <Results user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/loan" element={(simulatedUser || user) ? <LoanApplicationForm user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />

          {/* Role Dashboards */}
          <Route path="/parent" element={(simulatedUser || user)?.role === 'parent' ? <ParentDashboard user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/bursar" element={(simulatedUser || user)?.role === 'bursar' ? <BursarDashboard user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/teacher" element={(simulatedUser || user)?.role === 'teacher' ? <TeacherDashboard user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />
          <Route path="/owner" element={(simulatedUser || user)?.role === 'school_owner' ? <OwnerDashboard user={(simulatedUser || user)!} /> : <Navigate to="/auth" />} />

          {/* Protected Admin Dashboard */}
          <Route path="/admin" element={['admin', 'school_owner'].includes((simulatedUser || user)?.role || '') ? <AdminDashboard user={(simulatedUser || user)!} onSimulateLogin={setSimulatedUser} /> : <Navigate to={`/${SECRET_ADMIN_PATH}`} />} />
          <Route path="/admin/" element={<Navigate to="/admin" replace />} />

              {/* Catch-all for deleted /admin/login */}
              <Route path="/admin/login" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}

