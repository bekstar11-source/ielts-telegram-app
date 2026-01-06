import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'; // where qo'shildi
import { useNavigate } from 'react-router-dom';

const StudentHome = () => {
  const [assignments, setAssignments] = useState([]);
  const [myResults, setMyResults] = useState([]); // 🔥 O'quvchi natijalari
  const [activeTab, setActiveTab] = useState('lessons'); // 'lessons' yoki 'results'
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const [userName, setUserName] = useState(localStorage.getItem('studentName') || '');
  const [selectedHistory, setSelectedHistory] = useState(null); // Modaldagi tarix

  // 1. Darslarni yuklash
  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const q = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setAssignments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchAssignments();
  }, []);

  // 2. O'quvchi natijalarini yuklash
  useEffect(() => {
    const fetchMyResults = async () => {
      if (!userName) return;
      try {
        // Faqat shu o'quvchi topshirgan natijalarni olamiz
        const q = query(collection(db, "results"), where("studentName", "==", userName), orderBy("date", "desc"));
        const snap = await getDocs(q);
        setMyResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { 
        console.log("Indeks xatosi bo'lishi mumkin (console ga qarang)"); 
      }
    };
    if (activeTab === 'results') {
        fetchMyResults();
    }
  }, [activeTab, userName]);

  const handleStart = (id) => {
    if (!userName.trim()) {
      const name = prompt("Ismingizni kiriting:");
      if (!name) return;
      localStorage.setItem('studentName', name);
      setUserName(name);
    }
    navigate('/lesson/' + id);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f5] p-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <h1 className="text-2xl font-bold text-gray-900">IELTS App</h1>
        <div className="w-10 h-10 bg-[#2481cc] rounded-full flex items-center justify-center text-white font-bold shadow-md">
          {userName ? userName[0].toUpperCase() : '?'}
        </div>
      </div>

      {/* Ismni tahrirlash (ixtiyoriy) */}
      {!userName && (
        <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-200 text-yellow-800 text-sm mb-4">
            Iltimos, darsni boshlashdan oldin ismingizni kiriting.
        </div>
      )}

      {/* 🔥 TABLAR (MENU) */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6">
        <button 
            onClick={() => setActiveTab('lessons')} 
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'lessons' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}
        >
            📚 Darslar
        </button>
        <button 
            onClick={() => setActiveTab('results')} 
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'results' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}
        >
            🏆 Natijalarim
        </button>
      </div>

      {/* 1. DARSLAR RO'YXATI */}
      {activeTab === 'lessons' && (
        <div className="space-y-4 animate-in fade-in">
            {loading ? <p className="text-center text-gray-400">Yuklanmoqda...</p> : assignments.map((lesson) => (
                <div key={lesson.id} onClick={() => handleStart(lesson.id)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">
                            {lesson.direction === 'uz-en' ? '🇬🇧' : '🇺🇿'}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">{lesson.title}</h4>
                            <p className="text-xs text-gray-400">
                                {lesson.direction === 'uz-en' ? 'Uzbek -> English' : 'English -> Uzbek'} • {lesson.sentences?.length || 0} ta
                            </p>
                        </div>
                    </div>
                    <div className="text-gray-300">→</div>
                </div>
            ))}
        </div>
      )}

      {/* 2. NATIJALAR TARIXI */}
      {activeTab === 'results' && (
        <div className="space-y-4 animate-in fade-in">
            {myResults.length === 0 ? (
                <p className="text-center text-gray-400 mt-10">Hali natijalar yo'q. Dars bajaring!</p>
            ) : (
                myResults.map((res) => (
                    <div key={res.id} onClick={() => setSelectedHistory(res)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50">
                        <div className="flex justify-between items-center mb-1">
                            <h4 className="font-bold text-gray-800">{res.lessonTitle}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${res.totalScore/res.maxScore > 0.8 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {res.totalScore} / {res.maxScore}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400">
                            {res.date?.toDate().toLocaleDateString()} {res.date?.toDate().toLocaleTimeString()}
                        </p>
                    </div>
                ))
            )}
        </div>
      )}

      {/* 🔥 RESULT DETAILS MODAL (O'quvchi o'z xatolarini ko'rishi uchun) */}
      {selectedHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
             <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl h-[80vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">{selectedHistory.lessonTitle}</h3>
                    <button onClick={() => setSelectedHistory(null)} className="text-2xl text-gray-400">×</button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    {selectedHistory.history?.map((item, idx) => (
                        <div key={idx} className="mb-4 p-4 border rounded-xl bg-gray-50 text-sm">
                            <div className="flex justify-between mb-2">
                                <span className="font-bold text-gray-700">#{idx+1} Savol</span>
                                <span className="font-bold">{item.score}/5</span>
                            </div>
                            <p className="mb-1 text-gray-600">{item.question}</p>
                            
                            <div className="grid gap-2 mt-2">
                                <div className={`p-2 rounded border ${item.score === 5 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                    <span className="text-[10px] uppercase font-bold opacity-50 block">Siz:</span>
                                    {item.userAnswer}
                                </div>
                                {item.score < 5 && (
                                    <div className="p-2 rounded border bg-blue-50 border-blue-200">
                                        <span className="text-[10px] uppercase font-bold opacity-50 block">To'g'ri:</span>
                                        {item.teacherTrans}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 italic mt-2 border-t pt-1">💡 {item.feedback}</p>
                        </div>
                    ))}
                </div>
             </div>
        </div>
      )}

    </div>
  );
};

export default StudentHome;