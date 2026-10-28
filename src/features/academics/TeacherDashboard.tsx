import React, { useState, useEffect } from 'react';
import { UserProfile, ClassAssignment, AcademicResult } from '../../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { BookOpen, Edit3, Award, Users, CheckCircle } from 'lucide-react';

interface TeacherDashboardProps {
  user: UserProfile;
}

export default function TeacherDashboard({ user }: TeacherDashboardProps) {
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [results, setResults] = useState<AcademicResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Result Form State
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [selectedStudentUid, setSelectedStudentUid] = useState('');
  const [caScore, setCaScore] = useState('');
  const [examScore, setExamScore] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      const [assignRes, stuRes, resRes] = await Promise.all([
        api.get('/academics/class-assignments'),
        api.get('/accounts/users?role=student'),
        api.get('/academics/results')
      ]);
      setAssignments(assignRes.data);
      setStudents(stuRes.data);
      setResults(resRes.data);
      if (assignRes.data.length > 0) {
        setSelectedCourseCode(assignRes.data[0].courseCode);
      }
    } catch (error) {
      toast.error('Failed to load teacher portal data');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentUid || !selectedCourseCode) {
      return toast.error('Please select both a student and a course assignment');
    }

    const ca = Number(caScore) || 0;
    const exam = Number(examScore) || 0;

    if (ca < 0 || ca > 40) return toast.error('CA Score must be between 0 and 40');
    if (exam < 0 || exam > 60) return toast.error('Exam Score must be between 0 and 60');

    try {
      setSaving(true);
      const assigned = assignments.find(a => a.courseCode === selectedCourseCode);
      await api.post('/academics/results', {
        studentUid: selectedStudentUid,
        courseCode: selectedCourseCode,
        courseTitle: assigned?.courseTitle || selectedCourseCode,
        caScore: ca,
        examScore: exam,
        isPublished: true
      });
      toast.success('Student result recorded and published successfully');
      setCaScore('');
      setExamScore('');
      fetchTeacherData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to record result');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-emerald-800 font-bold">Loading Academic Teacher Portal...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-emerald-900 text-white rounded-2xl p-6 shadow-xl flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Academic Faculty Hub</h1>
          <p className="text-emerald-200 mt-1">
            Instructor Portal • <span className="text-white font-semibold">{user.name}</span>
          </p>
        </div>
        <div className="bg-emerald-800 px-4 py-2 rounded-xl text-xs font-bold text-emerald-200 border border-emerald-700">
          {assignments.length} Assigned Class Courses
        </div>
      </div>

      {/* Course Assignments List */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          My Assigned Courses & Classes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {assignments.length > 0 ? (
            assignments.map((a) => (
              <div key={a.id} className="p-4 border rounded-xl border-emerald-100 bg-emerald-50/50 space-y-1">
                <span className="text-xs font-bold text-emerald-800 uppercase">{a.courseCode}</span>
                <p className="font-bold text-gray-900">{a.courseTitle}</p>
                <p className="text-xs text-gray-500">{a.department || 'General'} • {a.level || '100L'}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400">No courses assigned yet. Contact School Admin.</p>
          )}
        </div>
      </div>

      {/* Record Grades & Marks */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Edit3 className="w-5 h-5 text-emerald-600" />
          Record Student Assessment & Exam Scores
        </h2>
        <form onSubmit={handleRecordResult} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Course</label>
            <select
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={selectedCourseCode}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.courseCode}>
                  {a.courseCode} - {a.courseTitle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Student</label>
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
            <label className="text-xs font-bold text-gray-600 mb-1 block">CA Score (Max 40)</label>
            <input
              type="number"
              placeholder="0 - 40"
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={caScore}
              onChange={(e) => setCaScore(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Exam Score (Max 60)</label>
            <input
              type="number"
              placeholder="0 - 60"
              className="w-full p-3 border rounded-xl text-sm border-gray-200 focus:ring-2 focus:ring-emerald-500"
              value={examScore}
              onChange={(e) => setExamScore(e.target.value)}
            />
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              {saving ? 'Saving...' : 'Submit & Publish Result'}
            </button>
          </div>
        </form>
      </div>

      {/* Recorded Results Summary */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recorded Academic Results</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 font-bold border-b">
              <tr>
                <th className="p-3">Student Name</th>
                <th className="p-3">Course</th>
                <th className="p-3">CA (40)</th>
                <th className="p-3">Exam (60)</th>
                <th className="p-3">Total (100)</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Grade Point</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold text-gray-800">{r.User?.name || r.studentUid}</td>
                  <td className="p-3 text-gray-600 font-mono">{r.courseCode}</td>
                  <td className="p-3">{r.caScore}</td>
                  <td className="p-3">{r.examScore}</td>
                  <td className="p-3 font-bold text-gray-900">{r.totalScore}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                      {r.grade}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-emerald-700">{r.gradePoint.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
