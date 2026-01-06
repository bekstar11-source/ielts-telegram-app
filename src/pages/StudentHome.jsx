import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const StudentHome = () => {
  const [assignments, setAssignments] = useState([]);
  const [myResults, setMyResults] = useState([]);
  
  // Ma'lumotlar
  const [groups, setGroups] = useState([]);
  const [groupStudents, setGroupStudents] = useState([]); // Tanlangan guruhdagi o'quvchilar
  
  const [activeTab, setActiveTab] = useState('lessons');
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  
  // Auth State
  const [userName, setUserName] = useState(localStorage.getItem('studentName') || '');
  const [groupName, setGroupName] = useState(localStorage.getItem('groupName') || '');
  
  // Login Modal State
  const [showLogin, setShowLogin] = useState(!userName || !groupName);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // 1. Darslarni yuklash (Faqat o'z guruhiga tegishli)
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const allLessons = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 🔥 FILTRLASH: Faqat o'z guruhi yoki 'all'
        const filtered = allLessons.filter(l => 
             l.targetGroup === 'all' || l.targetGroup === groupName
        );
        setAssignments(filtered);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    if (userName && groupName) {
        fetchAssignments();
    }
  }, [userName, groupName]);

  // 2. Dastlabki yuklash (Guruhlar)
  useEffect(() => {
    const fetchGroups = async () => {
        const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchGroups();
  }, []);

  // 3. Guruh tanlanganda o'quvchilarni yuklash
  useEffect(() => {
    const fetchStudentsByGroup = async () => {
        if (!selectedGroup) return;
        // Index kerak bo'lishi mumkin: users -> group (Asc)
        const q = query(collection(db, "users"), where("group", "==", selectedGroup));
        const snap = await getDocs(q);
        setGroupStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchStudentsByGroup();
  }, [selectedGroup]);

  // 4. Natijalarni yuklash
  useEffect(() => {
    const fetchMyResults = async () => {
      if (!userName) return;
      try {
        const q = query(collection(db, "results"), where("studentName", "==", userName), orderBy("date", "desc"));
        const snap = await getDocs(q);
        setMyResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) { console.log(error); }
    };
    if (activeTab === 'results') fetchMyResults();
  }, [activeTab, userName]);


  // --- LOGIN MANTIGI ---
  const handleLogin = () => {
    if (!selectedStudentId || !pinInput) return setLoginError("Tanlang va PIN kiriting");

    const student = groupStudents.find(s => s.id === selectedStudentId);
    
    // PIN TEKSHIRISH
    if (student && student.pin === pinInput) {
        localStorage.setItem('studentName', student.name);
        localStorage.setItem('groupName', student.group);
        setUserName(student.name);
        setGroupName(student.group);
        setShowLogin(false);
    } else {
        setLoginError("PIN kod noto'g'ri! ❌");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserName('');
    setGroupName('');
    setShowLogin(true);
    setSelectedGroup('');
    setGroupStudents([]);
    setPinInput('');
  };

  return (
    <div className="min-h-screen bg-[#f4f4f5] p-4 font-sans">
      
      {/* 🔐 LOGIN MODAL */}
      {showLogin && (
        <div className="fixed inset-0 bg-[#2481cc] z-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">Kirish 🔐</h1>
                    <p className="text-gray-500 text-sm">O'quv markazi tizimi</p>
                </div>

                {/* 1. Guruh Tanlash */}
                <div className="mb-4">
                    <label className="text-xs font-bold text-gray-400 ml-1">GURUHINGIZ</label>
                    <select 
                        className="w-full p-3 mt-1 border rounded-xl bg-gray-50 font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500"
                        value={selectedGroup} 
                        onChange={e => { setSelectedGroup(e.target.value); setPinInput(''); setLoginError(''); }}
                    >
                        <option value="">Tanlang...</option>
                        {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                </div>

                {/* 2. Ism Tanlash (Guruh tanlangandan keyin chiqadi) */}
                {selectedGroup && (
                    <div className="mb-4 animate-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-gray-400 ml-1">ISMINGIZ</label>
                        <select 
                            className="w-full p-3 mt-1 border rounded-xl bg-gray-50 font-bold text-gray-700 outline-none focus:ring-2 ring-blue-500"
                            value={selectedStudentId} 
                            onChange={e => setSelectedStudentId(e.target.value)}
                        >
                            <option value="">Ro'yxatdan toping...</option>
                            {groupStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}

                {/* 3. PIN Kiritish */}
                {selectedStudentId && (
                    <div className="mb-6 animate-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-gray-400 ml-1">PIN KOD</label>
                        <input 
                            type="tel" 
                            maxLength="4"
                            placeholder="****"
                            className="w-full p-3 mt-1 border rounded-xl bg-gray-50 font-bold text-center text-xl tracking-widest outline-none focus:ring-2 ring-blue-500"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                        />
                    </div>
                )}

                {loginError && <p className="text-red-500 text-center font-bold mb-4">{loginError}</p>}

                <button 
                    onClick={handleLogin} 
                    disabled={!selectedStudentId || pinInput.length < 4}
                    className="w-full bg-[#2481cc] text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50 active:scale-95 transition"
                >
                    KIRISH →
                </button>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Mening Darslarim</h1>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{groupName}</span>
        </div>
        <div onClick={handleLogout} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded-full shadow-sm">
          <span className="text-sm font-bold text-gray-700">{userName}</span>
          <span className="text-red-500 text-xs font-bold">CHIQISH</span>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6">
        <button onClick={() => setActiveTab('lessons')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'lessons' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}>📚 Vazifalar</button>
        <button onClick={() => setActiveTab('results')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'results' ? 'bg-[#2481cc] text-white shadow-md' : 'text-gray-500'}`}>🏆 Natijalarim</button>
      </div>

      {/* LESSONS LIST */}
      {activeTab === 'lessons' && (
        <div className="space-y-4">
            {assignments.length === 0 && !loading && <p className="text-center text-gray-400 mt-10">Sizning guruhingiz uchun hozircha vazifa yo'q.</p>}
            
            {assignments.map((lesson) => (
                <div key={lesson.id} onClick={() => navigate('/lesson/' + lesson.id)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">
                            {lesson.direction === 'uz-en' ? '🇬🇧' : '🇺🇿'}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800">{lesson.title}</h4>
                            <p className="text-xs text-gray-400">
                                {lesson.direction === 'uz-en' ? 'UZ -> EN' : 'EN -> UZ'} • {lesson.sentences?.length} ta
                            </p>
                        </div>
                    </div>
                    <div className="text-gray-300">→</div>
                </div>
            ))}
        </div>
      )}

      {/* RESULTS LIST */}
      {activeTab === 'results' && (
        <div className="space-y-4">
             {myResults.map((res) => (
                <div key={res.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
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
    </div>
  );
};

export default StudentHome;