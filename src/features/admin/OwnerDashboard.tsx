import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { ShieldCheck, Users, DollarSign, BookOpen, UserPlus, Award } from 'lucide-react';

interface OwnerDashboardProps {
  user: UserProfile;
}

export default function OwnerDashboard({ user }: OwnerDashboardProps) {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [bursars, setBursars] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [finances, setFinances] = useState<any>({ totalCollected: 0, totalInvoiced: 0 });
  const [loading, setLoading] = useState(true);

  // Teacher Assignment Form
  const [selectedTeacherUid, setSelectedTeacherUid] = useState('');
  const [courseCode, setCourseCode] = useState('CSC101');
  const [courseTitle, setCourseTitle] = useState('Introduction to Computer Science');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchOwnerData();
  }, []);

  const fetchOwnerData = async () => {
    try {
      setLoading(true);
      const [tchRes, burRes, crsRes, finRes] = await Promise.all([
        api.get('/accounts/users?role=teacher'),
        api.get('/accounts/users?role=bursar'),
        api.get('/academics/courses'),
        api.get('/reports/financial')
      ]);
      setTeachers(tchRes.data);
      setBursars(burRes.data);
      setCourses(crsRes.data);
      setFinances(finRes.data);
      if (tchRes.data.length > 0) {
        setSelectedTeacherUid(tchRes.data[0].uid);
      }
    } catch (error) {
      toast.error('Failed to load School Owner Command Portal');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherUid || !courseCode) {
      return toast.error('Please select a teacher and specify course code');
    }

    try {
      setAssigning(true);
      await api.post('/academics/class-assignments', {
        teacherUid: selectedTeacherUid,
        courseCode,
        courseTitle
      });
      toast.success('Course assigned to teacher successfully');
      fetchOwnerData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to assign course');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-emerald-800 font-bold">Loading School Owner Governance Console...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-emerald-950 text-white rounded-2xl p-6 shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">School Owner Command Console</h1>
          <p className="text-emerald-300 mt-1">
            Tenant Institution: <span className="text-white font-bold">{user.tenantId || 'Default School'}</span> • Governance & Role Control
          </p>
        </div>
        <div className="bg-emerald-800 px-4 py-2 rounded-xl text-xs font-bold text-emerald-200 border border-emerald-700">
          Executive Role Authorization Active
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex items-center gap-4">
          <div className="bg-emerald-100 p-4 rounded-xl text-emerald-800">
            <DollarSign className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Total Revenue Collected</p>
            <p className="text-2xl font-black text-emerald-900">₦{Number(finances.totalCollected).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex items-center gap-4">
          <div className="bg-blue-100 p-4 rounded-xl text-blue-800">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Active Academic Teachers</p>
            <p className="text-2xl font-black text-gray-900">{teachers.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex items-center gap-4">
          <div className="bg-purple-100 p-4 rounded-xl text-purple-800">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Treasury Bursars</p>
            <p className="text-2xl font-black text-purple-900">{bursars.length}</p>
          </div>
        </div>
      </div>

      {/* Assign Course to Teacher */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-emerald-600" />
          Assign Class & Course to Teacher
        </h2>
        <form onSubmit={handleAssignTeacher} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Teacher</label>
            <select
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={selectedTeacherUid}
              onChange={(e) => setSelectedTeacherUid(e.target.value)}
            >
              <option value="">-- Choose Teacher --</option>
              {teachers.map((t) => (
                <option key={t.uid} value={t.uid}>
                  {t.name} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Course Code</label>
            <input
              type="text"
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Course Title</label>
            <input
              type="text"
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={assigning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              {assigning ? 'Assigning...' : 'Assign Teacher to Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
