import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const StudentHome = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [userName, setUserName] = useState(localStorage.getItem('studentName') || '');

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const q = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAssignments(data);
      } catch (error) {
        console.error("Xatolik:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const handleStart = (id) => {
    if (!userName.trim()) {
      const name = prompt("Davom etish uchun ismingizni kiriting:");
      if (!name) return;
      localStorage.setItem('studentName', name);
      setUserName(name);
    }
    navigate('/lesson/' + id);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f5] p-4">
      {/* Header - Telegram Style */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IELTS Lessons</h1>
          <p className="text-sm text-gray-500">Bugun nimani o'rganamiz?</p>
        </div>
        <div className="w-10 h-10 bg-[#2481cc] rounded-full flex items-center justify-center text-white font-bold shadow-md">
          {userName ? userName[0].toUpperCase() : '?'}
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-[#2481cc] to-[#3ca5f1] p-5 rounded-2xl shadow-lg mb-8 text-white">
        <p className="text-blue-100 text-sm">Xush kelibsiz,</p>
        <h2 className="text-xl font-bold">{userName || "O'quvchi"}!</h2>
        <div className="mt-4 flex gap-4">
          <div className="bg-white/20 px-3 py-1 rounded-lg text-xs">
            🔥 {assignments.length} ta dars tayyor
          </div>
        </div>
      </div>

      {/* Lessons List */}
      <div className="space-y-4">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Mavjud darslar</h3>
        
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          assignments.map((lesson) => (
            <div 
              key={lesson.id} 
              onClick={() => handleStart(lesson.id)}
              className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">
                  📚
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">{lesson.title}</h4>
                  <p className="text-xs text-gray-400">{lesson.sentences?.length || 0} ta mashq</p>
                </div>
              </div>
              <div className="text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer info */}
      <p className="text-center text-gray-400 text-[10px] mt-10">
        AI IELTS Teacher v2.0 • Telegram Web App
      </p>
    </div>
  );
};

export default StudentHome;