import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  // Tabs
  const [activeTab, setActiveTab] = useState('lessons'); // 'lessons' | 'students' | 'results'

  // --- LESSON STATES ---
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  const [direction, setDirection] = useState('en-uz');
  const [targetGroup, setTargetGroup] = useState('all'); // 🔥 Qaysi guruhga?
  
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);

  // --- STUDENT STATES ---
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  
  // Yangi o'quvchi qo'shish
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGroup, setNewStudentGroup] = useState('');
  const [newStudentPin, setNewStudentPin] = useState('');

  // --- RESULTS STATES ---
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => { 
    fetchGroups();
    fetchStudents();
    fetchResults();
  }, []);

  // --- FETCH FUNCTIONS ---
  const fetchGroups = async () => {
    const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchStudents = async () => {
    const q = query(collection(db, "users"), orderBy("name", "asc"));
    const snap = await getDocs(q);
    setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchResults = async () => {
    const q = query(collection(db, "results"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  // --- ACTIONS ---
  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    await addDoc(collection(db, "groups"), { name: newGroupName.trim(), createdAt: serverTimestamp() });
    setNewGroupName(''); fetchGroups();
  };

  const addStudent = async () => {
    if (!newStudentName || !newStudentGroup || !newStudentPin) return alert("Hamma maydonni to'ldiring!");
    if (newStudentPin.length < 4) return alert("PIN kod kamida 4 ta raqam bo'lsin");

    await addDoc(collection(db, "users"), {
        name: newStudentName,
        group: newStudentGroup,
        pin: newStudentPin, // 🔒 Parol
        createdAt: serverTimestamp()
    });
    alert("O'quvchi qo'shildi! ✅");
    setNewStudentName(''); setNewStudentPin(''); fetchStudents();
  };

  const saveLesson = async () => {
    if (!title) return alert("Mavzu yo'q");
    setLoading(true);
    try {
      await addDoc(collection(db, "assignments"), { 
          title, sentences, direction, 
          targetGroup, // 🔥 Dars kim uchun?
          createdAt: serverTimestamp() 
      });
      alert("Dars saqlandi! ✅");
      setTitle(''); setSentences([{ original: '', translation: '' }]); setBulkText('');
    } catch (e) { alert("Xato: " + e.message); }
    setLoading(false);
  };

  const deleteDocItem = async (col, id, refreshFunc) => {
    if(window.confirm("O'chiraymi?")) {
        await deleteDoc(doc(db, col, id));
        refreshFunc();
    }
  };

  // Bulk process
  const processBulkText = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n');
    const parsed = [];
    lines.forEach(line => {
        if(line.includes('|')) {
            const [o, t] = line.split('|');
            if(o.trim() && t.trim()) parsed.push({original: o.trim(), translation: t.trim()});
        }
    });
    if(parsed.length) { setSentences(parsed); setIsBulkMode(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      
      {/* MENU TABS */}
      <div className="flex justify-center mb-8 bg-white p-2 rounded-2xl shadow-sm max-w-xl mx-auto">
          {['lessons', 'students', 'results'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-xl font-bold capitalize transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {tab === 'lessons' ? '📝 Darslar' : tab === 'students' ? '👥 O\'quvchilar' : '📈 Natijalar'}
              </button>
          ))}
      </div>

      {/* --- 1. DARSLAR BO'LIMI --- */}
      {activeTab === 'lessons' && (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
             <h2 className="text-2xl font-bold mb-6">Yangi Dars Yaratish</h2>
             
             {/* Dars Sozlamalari */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu nomi..." className="p-3 border rounded-xl outline-none focus:ring-2 ring-blue-500"/>
                
                {/* 🔥 GURUH TANLASH */}
                <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} className="p-3 border rounded-xl bg-yellow-50 font-bold text-yellow-800">
                    <option value="all">🌍 Barcha Guruhlar Uchun</option>
                    {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
             </div>

             <div className="mb-4">
                <select value={direction} onChange={e => setDirection(e.target.value)} className="w-full p-3 border rounded-xl bg-blue-50 text-blue-800 font-bold">
                    <option value="en-uz">🇬🇧 English -> 🇺🇿 Uzbek</option>
                    <option value="uz-en">🇺🇿 Uzbek -> 🇬🇧 English</option>
                </select>
             </div>

             {/* Gaplar Kiritish */}
             <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setIsBulkMode(false)} className={`flex-1 py-2 font-bold rounded-lg ${!isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Birma-bir</button>
                <button onClick={() => setIsBulkMode(true)} className={`flex-1 py-2 font-bold rounded-lg ${isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Tezkor</button>
             </div>

             {!isBulkMode ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 mb-4 custom-scrollbar">
                  {sentences.map((s, i) => (
                    <div key={i} className="flex gap-2">
                       <input placeholder="Original..." className="flex-1 p-2 border rounded-lg" value={s.original} onChange={e => {const n=[...sentences]; n[i].original=e.target.value; setSentences(n)}}/>
                       <input placeholder="Tarjima..." className="flex-1 p-2 border rounded-lg" value={s.translation} onChange={e => {const n=[...sentences]; n[i].translation=e.target.value; setSentences(n)}}/>
                    </div>
                  ))}
                  <button onClick={() => setSentences([...sentences, {original:'', translation:''}])} className="text-blue-500 font-bold text-sm">+ Qo'shish</button>
                </div>
             ) : (
                <div className="mb-4">
                   <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} className="w-full h-32 p-3 border rounded-xl text-sm font-mono" placeholder="I go | Men boraman"/>
                   <button onClick={processBulkText} className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg font-bold mt-2">Formatlash</button>
                </div>
             )}

             <button onClick={saveLesson} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">SAQLASH ✅</button>
          </div>
      )}

      {/* --- 2. O'QUVCHILAR BO'LIMI --- */}
      {activeTab === 'students' && (
          <div className="max-w-4xl mx-auto space-y-8">
              
              {/* Guruh qo'shish */}
              <div className="bg-white p-6 rounded-3xl shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4">1. Guruhlar</h3>
                  <div className="flex gap-2 mb-4">
                      <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Guruh nomi..." className="flex-1 p-3 border rounded-xl"/>
                      <button onClick={addGroup} className="bg-gray-800 text-white px-6 rounded-xl font-bold">+ Guruh</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {groups.map(g => (
                          <div key={g.id} className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2">
                              {g.name} 
                              <button onClick={() => deleteDocItem("groups", g.id, fetchGroups)} className="text-red-500 ml-1">×</button>
                          </div>
                      ))}
                  </div>
              </div>

              {/* O'quvchi qo'shish */}
              <div className="bg-white p-6 rounded-3xl shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4">2. O'quvchi Ro'yxatga Olish</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <select value={newStudentGroup} onChange={e => setNewStudentGroup(e.target.value)} className="p-3 border rounded-xl bg-white">
                          <option value="">Guruhni tanlang</option>
                          {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                      </select>
                      <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="F.I.SH" className="p-3 border rounded-xl"/>
                      <input value={newStudentPin} onChange={e => setNewStudentPin(e.target.value)} type="number" placeholder="PIN (masalan: 1234)" className="p-3 border rounded-xl"/>
                      <button onClick={addStudent} className="bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200">Qo'shish 👤</button>
                  </div>

                  {/* Ro'yxat */}
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 text-gray-400 uppercase text-xs">
                              <tr><th className="p-3">Guruh</th><th className="p-3">Ism</th><th className="p-3">PIN</th><th className="p-3 text-right">Amal</th></tr>
                          </thead>
                          <tbody className="divide-y">
                              {students.map(s => (
                                  <tr key={s.id}>
                                      <td className="p-3 font-bold text-blue-600">{s.group}</td>
                                      <td className="p-3 font-medium">{s.name}</td>
                                      <td className="p-3 font-mono text-gray-500">****</td> {/* PINni yashirish */}
                                      <td className="p-3 text-right">
                                          <button onClick={() => deleteDocItem("users", s.id, fetchStudents)} className="text-red-500 hover:bg-red-50 p-2 rounded">O'chirish</button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- 3. NATIJALAR BO'LIMI --- */}
      {activeTab === 'results' && (
          <div className="max-w-4xl mx-auto bg-white p-6 rounded-3xl shadow-sm h-[80vh] overflow-y-auto">
             <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white shadow-sm">
                      <tr className="text-xs text-gray-400 uppercase">
                          <th className="p-3">O'quvchi</th>
                          <th className="p-3">Guruh</th>
                          <th className="p-3">Ball</th>
                          <th className="p-3 text-right">Ko'rish</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y">
                      {results.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedResult(r)}>
                              <td className="p-3 font-bold">{r.studentName}</td>
                              <td className="p-3 text-xs text-gray-500">{r.studentGroup || '-'}</td>
                              <td className="p-3 font-bold text-blue-600">{r.totalScore}</td>
                              <td className="p-3 text-right">👁️</td>
                          </tr>
                      ))}
                  </tbody>
             </table>
          </div>
      )}

      {/* MODAL VIEW */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-2xl p-6 h-[80vh] overflow-y-auto">
                <div className="flex justify-between mb-4">
                    <h2 className="text-xl font-bold">{selectedResult.studentName}</h2>
                    <button onClick={() => setSelectedResult(null)} className="text-2xl text-gray-400">×</button>
                </div>
                {selectedResult.history?.map((item, idx) => (
                    <div key={idx} className="mb-4 p-4 border rounded-xl bg-gray-50 text-sm">
                        <div className="flex justify-between font-bold mb-2">
                             <span>#{idx+1} {item.question}</span>
                             <span className={item.score===5?'text-green-600':'text-red-500'}>{item.score}/5</span>
                        </div>
                        <div className="grid gap-2 text-xs">
                             <div className="bg-white p-2 border rounded">Siz: {item.userAnswer}</div>
                             <div className="bg-blue-50 p-2 border rounded">To'g'ri: {item.teacherTrans}</div>
                        </div>
                        <p className="mt-2 text-gray-500 italic">AI: {item.feedback}</p>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAdmin;