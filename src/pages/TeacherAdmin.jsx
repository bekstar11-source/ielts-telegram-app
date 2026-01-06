import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  const [activeTab, setActiveTab] = useState('lessons');

  // --- LESSON STATES ---
  const [title, setTitle] = useState('');
  const [assignmentType, setAssignmentType] = useState('translation'); // 🔥 Default
  const [direction, setDirection] = useState('en-uz');
  const [targetGroup, setTargetGroup] = useState('all');
  
  // Data for different types
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]); // Translation & Matching
  const [essayPrompt, setEssayPrompt] = useState(''); // Writing Task 1 & 2
  const [imageUrl, setImageUrl] = useState(''); // Writing Task 1
  const [gapFillText, setGapFillText] = useState(''); // Gap Fill

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);

  // --- STUDENT & GROUP STATES ---
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
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
    if (!newStudentName || !newStudentGroup || !newStudentPin) return alert("To'ldiring!");
    if (newStudentPin.length < 4) return alert("PIN 4 ta raqam bo'lsin");
    await addDoc(collection(db, "users"), { name: newStudentName, group: newStudentGroup, pin: newStudentPin, createdAt: serverTimestamp() });
    alert("Qo'shildi!"); setNewStudentName(''); setNewStudentPin(''); fetchStudents();
  };
  const deleteDocItem = async (col, id, refreshFunc) => {
    if(window.confirm("O'chiraymi?")) { await deleteDoc(doc(db, col, id)); refreshFunc(); }
  };

  // 🔥 SAVE LESSON LOGIC
  const saveLesson = async () => {
    if (!title) return alert("Mavzu yo'q");
    setLoading(true);

    let lessonData = {
        title, 
        assignmentType,
        direction,
        targetGroup, 
        createdAt: serverTimestamp() 
    };

    // Ma'lumotlarni turiga qarab saqlash
    if (assignmentType === 'translation' || assignmentType === 'matching') {
        lessonData.sentences = sentences;
    } else if (assignmentType === 'essay_task1') {
        lessonData.essayPrompt = essayPrompt;
        lessonData.imageUrl = imageUrl;
    } else if (assignmentType === 'essay_task2') {
        lessonData.essayPrompt = essayPrompt;
    } else if (assignmentType === 'gap_fill') {
        lessonData.gapFillText = gapFillText;
    }

    try {
      await addDoc(collection(db, "assignments"), lessonData);
      alert("Dars saqlandi! ✅");
      setTitle(''); setSentences([{ original: '', translation: '' }]); 
      setEssayPrompt(''); setImageUrl(''); setGapFillText('');
    } catch (e) { alert("Xato: " + e.message); }
    setLoading(false);
  };

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
      <div className="flex justify-center mb-8 bg-white p-2 rounded-2xl shadow-sm max-w-xl mx-auto">
          {['lessons', 'students', 'results'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 rounded-xl font-bold capitalize transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
                {tab === 'lessons' ? '📝 Darslar' : tab === 'students' ? '👥 O\'quvchilar' : '📈 Natijalar'}
              </button>
          ))}
      </div>

      {activeTab === 'lessons' && (
          <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
             <h2 className="text-2xl font-bold mb-6">Yangi Dars</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu nomi..." className="p-3 border rounded-xl outline-none focus:ring-2 ring-blue-500"/>
                
                {/* 🔥 Dars turi */}
                <select value={assignmentType} onChange={e => setAssignmentType(e.target.value)} className="p-3 border rounded-xl bg-purple-50 font-bold text-purple-800">
                    <option value="translation">🇺🇿↔️🇬🇧 Tarjima</option>
                    <option value="essay_task1">📊 IELTS Task 1 (Report)</option>
                    <option value="essay_task2">✍️ IELTS Task 2 (Essay)</option>
                    <option value="gap_fill">📝 Gap Filling (Bo'sh joy)</option>
                    <option value="matching">💡 Matching (Moslashtirish)</option>
                </select>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} className="p-3 border rounded-xl bg-yellow-50 font-bold text-yellow-800">
                    <option value="all">🌍 Barcha Guruhlar</option>
                    {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
                {assignmentType === 'translation' && (
                    <select value={direction} onChange={e => setDirection(e.target.value)} className="p-3 border rounded-xl bg-blue-50 text-blue-800 font-bold">
                        <option value="en-uz">🇬🇧 EN -&gt; 🇺🇿 UZ</option>
                        <option value="uz-en">🇺🇿 UZ -&gt; 🇬🇧 EN</option>
                    </select>
                )}
             </div>

             {/* DINAMIK INPUTLAR */}
             {(assignmentType === 'translation' || assignmentType === 'matching') && (
                <>
                    <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => setIsBulkMode(false)} className={`flex-1 py-2 font-bold rounded-lg ${!isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Birma-bir</button>
                        <button onClick={() => setIsBulkMode(true)} className={`flex-1 py-2 font-bold rounded-lg ${isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Tezkor</button>
                    </div>
                    {!isBulkMode ? (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 mb-4">
                        {sentences.map((s, i) => (
                            <div key={i} className="flex gap-2">
                            <input placeholder={assignmentType==='matching'?"A tomon":"Original"} className="flex-1 p-2 border rounded-lg" value={s.original} onChange={e => {const n=[...sentences]; n[i].original=e.target.value; setSentences(n)}}/>
                            <input placeholder={assignmentType==='matching'?"B tomon":"Tarjima"} className="flex-1 p-2 border rounded-lg" value={s.translation} onChange={e => {const n=[...sentences]; n[i].translation=e.target.value; setSentences(n)}}/>
                            </div>
                        ))}
                        <button onClick={() => setSentences([...sentences, {original:'', translation:''}])} className="text-blue-500 font-bold text-sm">+ Qo'shish</button>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} className="w-full h-32 p-3 border rounded-xl text-sm font-mono" placeholder="Cat | Mushuk"/>
                            <button onClick={processBulkText} className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg font-bold mt-2">Formatlash</button>
                        </div>
                    )}
                </>
             )}

             {/* WRITING TASK 1 */}
             {assignmentType === 'essay_task1' && (
                <div className="space-y-3 mb-4">
                    <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Rasm URL (https://...)" className="w-full p-3 border rounded-xl"/>
                    <textarea value={essayPrompt} onChange={e => setEssayPrompt(e.target.value)} placeholder="Task 1 savoli (The chart below shows...)" className="w-full h-32 p-3 border rounded-xl"/>
                </div>
             )}

             {/* WRITING TASK 2 */}
             {assignmentType === 'essay_task2' && (
                <div className="mb-4">
                    <textarea value={essayPrompt} onChange={e => setEssayPrompt(e.target.value)} placeholder="Task 2 mavzusi (Some people believe...)" className="w-full h-32 p-3 border rounded-xl"/>
                </div>
             )}

             {/* GAP FILL */}
             {assignmentType === 'gap_fill' && (
                <div className="mb-4">
                    <textarea value={gapFillText} onChange={e => setGapFillText(e.target.value)} placeholder="Matnni kiriting. Bo'sh joyni [gap] deb belgilang. Masalan: London is the capital of [UK]." className="w-full h-48 p-3 border rounded-xl"/>
                </div>
             )}

             <button onClick={saveLesson} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">SAQLASH ✅</button>
          </div>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'students' && (
          <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-6 rounded-3xl shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4">1. Guruhlar</h3>
                  <div className="flex gap-2 mb-4">
                      <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Guruh nomi..." className="flex-1 p-3 border rounded-xl"/>
                      <button onClick={addGroup} className="bg-gray-800 text-white px-6 rounded-xl font-bold">+ Guruh</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {groups.map(g => (
                          <div key={g.id} className="bg-gray-100 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-2">
                              {g.name} <button onClick={() => deleteDocItem("groups", g.id, fetchGroups)} className="text-red-500 ml-1">×</button>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4">2. O'quvchi Qo'shish</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <select value={newStudentGroup} onChange={e => setNewStudentGroup(e.target.value)} className="p-3 border rounded-xl bg-white">
                          <option value="">Guruh...</option>
                          {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                      </select>
                      <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Ism" className="p-3 border rounded-xl"/>
                      <input value={newStudentPin} onChange={e => setNewStudentPin(e.target.value)} type="number" placeholder="PIN" className="p-3 border rounded-xl"/>
                      <button onClick={addStudent} className="bg-green-600 text-white font-bold rounded-xl shadow-lg">Qo'shish</button>
                  </div>
                  <div className="overflow-x-auto h-64 overflow-y-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 uppercase text-xs"><tr><th className="p-3">Guruh</th><th className="p-3">Ism</th><th className="p-3">PIN</th><th className="p-3 text-right">Amal</th></tr></thead>
                          <tbody>
                              {students.map(s => (
                                  <tr key={s.id}><td className="p-3 font-bold text-blue-600">{s.group}</td><td className="p-3">{s.name}</td><td className="p-3 text-gray-400">****</td><td className="p-3 text-right"><button onClick={() => deleteDocItem("users", s.id, fetchStudents)} className="text-red-500">O'chirish</button></td></tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* RESULTS TAB */}
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

      {/* MODAL */}
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
                             <span className={item.score>=5?'text-green-600':'text-red-500'}>{item.score} ball</span>
                        </div>
                        <div className="grid gap-2 text-xs">
                             <div className="bg-white p-3 border rounded whitespace-pre-wrap"><b>Siz:</b> {item.userAnswer}</div>
                             {item.teacherTrans && <div className="bg-blue-50 p-3 border rounded whitespace-pre-wrap"><b>Model:</b> {item.teacherTrans}</div>}
                        </div>
                        <div className="mt-2 text-gray-600 italic bg-yellow-50 p-3 rounded border-l-4 border-yellow-400 whitespace-pre-wrap">
                            <b>AI Feedback:</b> {item.feedback}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAdmin;