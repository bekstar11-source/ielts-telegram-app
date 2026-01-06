import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const StudentHome = () => {
  const [assignments, setAssignments] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [groups, setGroups] = useState([]); // 🔥 Guruhlar ro'yxati
  
  const [activeTab, setActiveTab] = useState('lessons');
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  
  const [userName, setUserName] = useState(localStorage.getItem('studentName') || '');
  const [groupName, setGroupName] = useState(localStorage.getItem('groupName') || '');
  
  const [selectedHistory, setSelectedHistory] = useState(null);

  // Login Modal
  const [showLogin, setShowLogin] = useState(!userName || !groupName);
  const [tempName, setTempName] = useState('');
  const [tempGroup, setTempGroup] = useState('');

  // 1. Darslarni va Guruhlarni yuklash
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Darslar
        const qAssig = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        const snapAssig = await getDocs(qAssig);
        setAssignments(snapAssig.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        // Guruhlar
        const qGroups = query(collection(db, "groups"), orderBy("createdAt", "desc"));
        const snapGroups = await getDocs(qGroups);
        setGroups(snapGroups.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // 2. Natijalarni yuklash (MUAMMO SHU YERDA EDI)
  useEffect(() => {
    const fetchMyResults = async () => {
      if (!userName) return;
      try {
        // 🔥 MUHIM: Firebase-da bu so'rov uchun INDEX kerak.
        // Agar console da "The query requires an index" degan qizil yozuv chiqsa,
        // o'sha yerdagi ko'k linkka bosib Index yaratish kerak.
        const q = query(collection(db, "results"), where("studentName", "==", userName), orderBy("date", "desc"));
        const snap = await getDocs(q);
        setMyResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { 
        console.error("Natijalarni olishda xato (Index yetishmayapti):", error); 
        // Vaqtinchalik indexsiz ishlash uchun (orderBy ni olib tashlab)
        if(error.code === 'failed-precondition') {
             const qBackup = query(collection(db, "results"), where("studentName", "==", userName));
             const snapBackup = await getDocs(qBackup);
             setMyResults(snapBackup.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      }
    };
    if (activeTab === 'results') fetchMyResults();
  }, [activeTab, userName]);

  const handleLogin = () => {
    if (!tempName.trim()) return alert("Ismingizni yozing!");
    if (!tempGroup) return alert("Guruhni tanlang!");
    
    localStorage.setItem('studentName', tempName);
    localStorage.setItem('groupName', tempGroup);
    setUserName(tempName);
    setGroupName(tempGroup);
    setShowLogin(false);
  };

  const handleStart = (id) => {
    navigate('/lesson/' + id);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserName('');
    setGroupName('');
    setShowLogin(true);
  };

  return (
    <div className="min-h-screen bg-[#f4f4f5] p-4 font-sans">
      
      {/* LOGIN MODAL (Guruh tanlash bilan) */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                <h2 className="text-xl font-bold text-center mb-4">Xush kelibsiz! 👋</h2>
                <label className="text-xs font-bold text-gray-500 ml-1">Ism Familiya</label>
                <input 
                    placeholder="Masalan: Ali Valiyev" 
                    className="w-full p-3 mb-3 border rounded-xl outline-none focus:ring-2 ring-blue-500"
                    value={tempName} onChange={e => setTempName(e.target.value)}
                />
                
                <label className="text-xs font-bold text-gray-500 ml-1">Guruhni Tanlang</label>
                <select 
                    className="w-full p-3 mb-4 border rounded-xl outline-none focus:ring-2 ring-blue-500 bg-white"
                    value={tempGroup} onChange={e => setTempGroup(e.target.value)}
                >
                    <option value="">-- Tanlang --</option>
                    {groups.map(g => (
                        <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                </select>

                <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Boshlash 🚀</button>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">IELTS App</h1>
            <p className="text-xs text-gray-500 font-bold bg-gray-200 px-2 py-0.5 rounded-lg w-fit mt-1">{groupName || '...'}</p>
        </div>
        <div onClick={handleLogout} className="w-10 h-10 bg-[#2481cc] rounded-full flex items-center justify-center text-white font-bold shadow-md cursor-pointer">
          {userName ? userName[0].toUpperCase() : '?'}
        </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6">
        <button onClick={() => setActiveTab('lessons')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'lessons' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}>📚 Darslar</button>
        <button onClick={() => setActiveTab('results')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'results' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}>🏆 Natijalarim</button>
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
            {myResults.length === 0 ? <p className="text-center text-gray-400 mt-10">Natijalar topilmadi.</p> : myResults.map((res) => (
                <div key={res.id} onClick={() => setSelectedHistory(res)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-gray-800">{res.lessonTitle}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${res.totalScore/res.maxScore > 0.8 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {res.totalScore} / {res.maxScore}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400">{res.date?.toDate ? res.date.toDate().toLocaleDateString() : 'Sana yo\'q'}</p>
                </div>
            ))}
        </div>
      )}

      {/* Modal History */}
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