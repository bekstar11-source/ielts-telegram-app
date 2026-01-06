import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const StudentHome = () => {
  const [assignments, setAssignments] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [activeTab, setActiveTab] = useState('lessons');
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  
  // O'quvchi ma'lumotlari
  const [userName, setUserName] = useState(localStorage.getItem('studentName') || '');
  const [groupName, setGroupName] = useState(localStorage.getItem('groupName') || '');
  
  const [selectedHistory, setSelectedHistory] = useState(null);

  // Ism va Guruhni kiritish oynasi (Modal)
  const [showLogin, setShowLogin] = useState(!userName || !groupName);
  const [tempName, setTempName] = useState('');
  const [tempGroup, setTempGroup] = useState('');

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

  // 2. Natijalarni yuklash
  useEffect(() => {
    const fetchMyResults = async () => {
      if (!userName) return;
      try {
        const q = query(collection(db, "results"), where("studentName", "==", userName), orderBy("date", "desc"));
        const snap = await getDocs(q);
        setMyResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { console.log("Index error:", error); }
    };
    if (activeTab === 'results') fetchMyResults();
  }, [activeTab, userName]);

  // Login qilish (Ism va Guruhni saqlash)
  const handleLogin = () => {
    if (!tempName.trim() || !tempGroup.trim()) return alert("Ism va Guruhni kiriting!");
    
    localStorage.setItem('studentName', tempName);
    localStorage.setItem('groupName', tempGroup);
    setUserName(tempName);
    setGroupName(tempGroup);
    setShowLogin(false);
  };

  const handleStart = (id) => {
    navigate('/lesson/' + id);
  };

  // Chiqish (Logout)
  const handleLogout = () => {
    localStorage.clear();
    setUserName('');
    setGroupName('');
    setShowLogin(true);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f5] p-4 font-sans">
      
      {/* Login Modal (Agar ism yoki guruh yo'q bo'lsa) */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                <h2 className="text-xl font-bold text-center mb-4">Xush kelibsiz! 👋</h2>
                <input 
                    placeholder="Ism Familiya (Masalan: Ali Valiyev)" 
                    className="w-full p-3 mb-3 border rounded-xl outline-none focus:ring-2 ring-blue-500"
                    value={tempName} onChange={e => setTempName(e.target.value)}
                />
                <input 
                    placeholder="Guruh nomi (Masalan: IELTS-1)" 
                    className="w-full p-3 mb-4 border rounded-xl outline-none focus:ring-2 ring-blue-500"
                    value={tempGroup} onChange={e => setTempGroup(e.target.value)}
                />
                <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Boshlash 🚀</button>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">IELTS App</h1>
            <p className="text-xs text-gray-500 font-bold">{groupName || 'Guruh yo\'q'}</p>
        </div>
        <div onClick={handleLogout} className="w-10 h-10 bg-[#2481cc] rounded-full flex items-center justify-center text-white font-bold shadow-md cursor-pointer">
          {userName ? userName[0].toUpperCase() : '?'}
        </div>
      </div>

      {/* Tablar */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6">
        <button onClick={() => setActiveTab('lessons')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'lessons' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}>📚 Darslar</button>
        <button onClick={() => setActiveTab('results')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'results' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}>🏆 Natijalar</button>
      </div>

      {/* Darslar */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
            {assignments.map((lesson) => (
                <div key={lesson.id} onClick={() => handleStart(lesson.id)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">
                            {lesson.direction === 'uz-en' ? '🇬🇧' : '🇺🇿'}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">{lesson.title}</h4>
                            <p className="text-xs text-gray-400">{lesson.direction === 'uz-en' ? 'UZ -> EN' : 'EN -> UZ'} • {lesson.sentences?.length} ta</p>
                        </div>
                    </div>
                    <div className="text-gray-300">→</div>
                </div>
            ))}
        </div>
      )}

      {/* Natijalar */}
      {activeTab === 'results' && (
        <div className="space-y-4">
            {myResults.map((res) => (
                <div key={res.id} onClick={() => setSelectedHistory(res)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-gray-800">{res.lessonTitle}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${res.totalScore/res.maxScore > 0.8 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {res.totalScore} / {res.maxScore}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400">{res.date?.toDate().toLocaleDateString()}</p>
                </div>
            ))}
        </div>
      )}

      {/* Natija Tafsilotlari (Modal) */}
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
                                <span className={`font-bold ${item.score === 5 ? 'text-green-600' : 'text-red-500'}`}>{item.score}/5</span>
                            </div>
                            <div className="grid gap-2 mt-2">
                                <div className="p-2 rounded border bg-white">
                                    <span className="text-[10px] uppercase font-bold opacity-50 block">Siz:</span>
                                    {item.userAnswer}
                                </div>
                                <div className="p-2 rounded border bg-blue-50">
                                    <span className="text-[10px] uppercase font-bold opacity-50 block">To'g'ri:</span>
                                    {item.teacherTrans}
                                </div>
                            </div>
                            <p className="text-xs text-gray-600 italic mt-2 border-t pt-2">🤖 {item.feedback}</p>
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