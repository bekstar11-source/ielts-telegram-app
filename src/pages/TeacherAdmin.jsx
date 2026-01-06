import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  const [activeTab, setActiveTab] = useState('create'); 

  // --- FORM STATES ---
  const [editingId, setEditingId] = useState(null); 
  const [title, setTitle] = useState('');
  const [assignmentType, setAssignmentType] = useState('translation');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  const [direction, setDirection] = useState('en-uz');
  const [targetGroup, setTargetGroup] = useState('all');
  
  const [imageUrl, setImageUrl] = useState('');
  const [essayPrompt, setEssayPrompt] = useState('');
  const [matchingPairs, setMatchingPairs] = useState([{ textA: '', textB: '' }]);
  const [gapFillText, setGapFillText] = useState('');
  const [correctChoices, setCorrectChoices] = useState('');

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);

  // --- DATA STATES ---
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]); 
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);

  // --- NEW STUDENT STATES ---
  const [newGroupName, setNewGroupName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGroup, setNewStudentGroup] = useState('');
  const [newStudentPin, setNewStudentPin] = useState('');

  useEffect(() => { 
    fetchGroups();
    fetchStudents();
    fetchAssignments(); 
    fetchResults();
  }, []);

  // --- FETCHERS ---
  const fetchGroups = async () => { try { const q = query(collection(db, "groups"), orderBy("createdAt", "desc")); const snap = await getDocs(q); setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };
  const fetchStudents = async () => { try { const q = query(collection(db, "users"), orderBy("name", "asc")); const snap = await getDocs(q); setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };
  const fetchAssignments = async () => { try { const q = query(collection(db, "assignments"), orderBy("createdAt", "desc")); const snap = await getDocs(q); setAssignments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };
  const fetchResults = async () => { try { const q = query(collection(db, "results"), orderBy("date", "desc")); const snap = await getDocs(q); setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };

  // --- ACTIONS ---
  const saveLesson = async () => {
    if (!title) return alert("Mavzu yozilmadi!");
    setLoading(true);

    let lessonData = { title, assignmentType, direction, targetGroup, updatedAt: serverTimestamp() };
    if (!editingId) lessonData.createdAt = serverTimestamp(); 

    if (assignmentType === 'translation') lessonData.sentences = sentences;
    else if (assignmentType === 'essay_task1') { lessonData.essayPrompt = essayPrompt; lessonData.imageUrl = imageUrl; }
    else if (assignmentType === 'essay_task2') { lessonData.essayPrompt = essayPrompt; }
    else if (assignmentType === 'matching') { lessonData.matchingPairs = matchingPairs; }
    else if (assignmentType === 'gap_fill') { lessonData.gapFillText = gapFillText; }
    else if (assignmentType === 'multiple_choice') {
        lessonData.sentences = sentences.map(s => ({...s, choices: s.choices ? (typeof s.choices === 'string' ? s.choices.split(',') : s.choices) : []}));
        lessonData.correctChoices = correctChoices;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "assignments", editingId), lessonData);
        alert("Dars yangilandi! 🔄");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "assignments"), lessonData);
        alert("Yangi dars qo'shildi! ✅");
      }
      resetForm();
      fetchAssignments(); 
    } catch (e) { alert("Xato: " + e.message); }
    setLoading(false);
  };

  const handleEdit = (lesson) => {
    setEditingId(lesson.id); setTitle(lesson.title); setAssignmentType(lesson.assignmentType);
    setDirection(lesson.direction || 'en-uz'); setTargetGroup(lesson.targetGroup || 'all');
    if (lesson.sentences) setSentences(lesson.sentences);
    if (lesson.essayPrompt) setEssayPrompt(lesson.essayPrompt);
    if (lesson.imageUrl) setImageUrl(lesson.imageUrl);
    if (lesson.gapFillText) setGapFillText(lesson.gapFillText);
    if (lesson.matchingPairs) setMatchingPairs(lesson.matchingPairs);
    if (lesson.correctChoices) setCorrectChoices(lesson.correctChoices);
    setActiveTab('create'); 
  };

  const resetForm = () => {
    setTitle(''); setEditingId(null); setSentences([{ original: '', translation: '' }]);
    setEssayPrompt(''); setImageUrl(''); setGapFillText(''); setMatchingPairs([{ textA: '', textB: '' }]);
    setCorrectChoices('');
  };

  const deleteItem = async (col, id, refresh) => { if(window.confirm("Rostdan ham o'chirasizmi?")) { await deleteDoc(doc(db, col, id)); refresh(); } };
  const addGroup = async () => { if (!newGroupName.trim()) return; await addDoc(collection(db, "groups"), { name: newGroupName.trim(), createdAt: serverTimestamp() }); setNewGroupName(''); fetchGroups(); };
  const addStudent = async () => { if (!newStudentName || !newStudentPin) return alert("Xato"); await addDoc(collection(db, "users"), { name: newStudentName, group: newStudentGroup, pin: newStudentPin, createdAt: serverTimestamp() }); setNewStudentName(''); setNewStudentPin(''); fetchStudents(); };
  
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

  const exportToExcel = () => {
    const data = results.map(r => ({ Ism: r.studentName, Guruh: r.studentGroup, Mavzu: r.lessonTitle, Ball: r.totalScore }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Natijalar.xlsx");
  };

  // 🔥 YANGILANGAN LAYOUT (100% EKRAN)
  return (
    <div className="flex w-screen h-screen bg-gray-100 font-sans overflow-hidden">
      
      {/* SIDEBAR - Chap tomon (o'zgarmas kenglik) */}
      <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-xl z-20 h-full">
        <div className="p-6">
            <h1 className="text-2xl font-bold text-center text-blue-400">Admin Panel</h1>
            <div className="text-xs text-slate-500 text-center mt-1">v2.3 Fullscreen</div>
        </div>
        
        <nav className="space-y-2 flex-1 px-4 overflow-y-auto">
            <button onClick={() => { setActiveTab('create'); resetForm(); }} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'create' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                📝 Yangi Dars
            </button>
            <button onClick={() => setActiveTab('archive')} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'archive' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                📂 Arxiv
            </button>
            <button onClick={() => setActiveTab('students')} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'students' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                👥 O'quvchilar
            </button>
            <button onClick={() => setActiveTab('results')} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'results' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                📈 Natijalar
            </button>
        </nav>
      </aside>

      {/* MAIN CONTENT - O'ng tomon (Qolgan barcha joyni egallaydi) */}
      <main className="flex-1 h-full overflow-hidden flex flex-col bg-gray-50 relative">
        <div className="flex-1 overflow-y-auto p-8 w-full">
            
            {/* 1. CREATE PAGE */}
            {activeTab === 'create' && (
                <div className="bg-white p-8 rounded-3xl shadow-sm max-w-5xl mx-auto border border-gray-200">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">{editingId ? "Darsni Tahrirlash ✏️" : "Yangi Dars Yaratish ➕"}</h2>
                        {editingId && <button onClick={resetForm} className="text-red-500 text-sm underline">Bekor qilish</button>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu nomi..." className="p-3 border rounded-xl outline-none focus:ring-2 ring-blue-500 bg-gray-50"/>
                        <select value={assignmentType} onChange={e => setAssignmentType(e.target.value)} className="p-3 border rounded-xl bg-purple-50 font-bold text-purple-800">
                            <option value="translation">Translation</option>
                            <option value="essay_task1">IELTS Task 1</option>
                            <option value="essay_task2">IELTS Task 2</option>
                            <option value="matching">Matching</option>
                            <option value="gap_fill">Gap Filling</option>
                            <option value="multiple_choice">Multiple Choice</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} className="p-3 border rounded-xl bg-yellow-50 font-bold text-yellow-800">
                            <option value="all">🌍 Barcha Guruhlar</option>
                            {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                        {assignmentType === 'translation' && (
                            <select value={direction} onChange={e => setDirection(e.target.value)} className="p-3 border rounded-xl bg-blue-50 text-blue-800 font-bold">
                                <option value="en-uz">🇬🇧 -&gt; 🇺🇿</option>
                                <option value="uz-en">🇺🇿 -&gt; 🇬🇧</option>
                            </select>
                        )}
                    </div>

                    {/* DYNAMIC FORMS */}
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-6">
                        {(assignmentType === 'translation' || assignmentType === 'matching') && (
                            <>
                                <div className="flex gap-2 mb-4">
                                    <button onClick={() => setIsBulkMode(false)} className={`px-4 py-2 rounded-lg text-sm font-bold ${!isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Qatorma-qator</button>
                                    <button onClick={() => setIsBulkMode(true)} className={`px-4 py-2 rounded-lg text-sm font-bold ${isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Tezkor (Paste)</button>
                                </div>
                                {!isBulkMode ? (
                                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                        {(assignmentType==='matching'?matchingPairs:sentences).map((s, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input placeholder={assignmentType==='matching'?"A":"Original"} className="flex-1 p-2 border rounded-lg" value={assignmentType==='matching'?s.textA:s.original} onChange={e => {
                                                    const list = assignmentType==='matching'?[...matchingPairs]:[...sentences];
                                                    if(assignmentType==='matching') list[i].textA=e.target.value; else list[i].original=e.target.value;
                                                    assignmentType==='matching'?setMatchingPairs(list):setSentences(list);
                                                }}/>
                                                <input placeholder={assignmentType==='matching'?"B":"Tarjima"} className="flex-1 p-2 border rounded-lg" value={assignmentType==='matching'?s.textB:s.translation} onChange={e => {
                                                    const list = assignmentType==='matching'?[...matchingPairs]:[...sentences];
                                                    if(assignmentType==='matching') list[i].textB=e.target.value; else list[i].translation=e.target.value;
                                                    assignmentType==='matching'?setMatchingPairs(list):setSentences(list);
                                                }}/>
                                            </div>
                                        ))}
                                        <button onClick={() => assignmentType==='matching'?setMatchingPairs([...matchingPairs, {textA:'',textB:''}]):setSentences([...sentences, {original:'',translation:''}])} className="text-blue-600 font-bold text-sm">+ Qo'shish</button>
                                    </div>
                                ) : (
                                    <div>
                                        <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} className="w-full h-32 p-3 border rounded-xl" placeholder="Apple | Olma"/>
                                        <button onClick={processBulkText} className="text-blue-600 font-bold mt-2">Formatlash</button>
                                    </div>
                                )}
                            </>
                        )}

                        {assignmentType === 'essay_task1' && (
                            <div className="space-y-3">
                                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL..." className="w-full p-3 border rounded-xl"/>
                                <textarea value={essayPrompt} onChange={e => setEssayPrompt(e.target.value)} placeholder="Task 1 Prompt..." className="w-full h-32 p-3 border rounded-xl"/>
                            </div>
                        )}
                        {assignmentType === 'essay_task2' && (
                            <textarea value={essayPrompt} onChange={e => setEssayPrompt(e.target.value)} placeholder="Task 2 Question..." className="w-full h-32 p-3 border rounded-xl"/>
                        )}
                        {assignmentType === 'gap_fill' && (
                            <textarea value={gapFillText} onChange={e => setGapFillText(e.target.value)} placeholder="Text with [gap]..." className="w-full h-40 p-3 border rounded-xl"/>
                        )}
                        {assignmentType === 'multiple_choice' && (
                            <div className="space-y-3">
                                {sentences.map((q, i) => (
                                    <div key={i} className="border p-2 rounded bg-white">
                                        <input value={q.original} onChange={e=>{const n=[...sentences];n[i].original=e.target.value;setSentences(n)}} placeholder="Savol" className="w-full p-1 border-b mb-1"/>
                                        <input value={q.choices} onChange={e=>{const n=[...sentences];n[i].choices=e.target.value;setSentences(n)}} placeholder="A, B, C, D" className="w-full p-1"/>
                                    </div>
                                ))}
                                <button onClick={() => setSentences([...sentences, {original:'', choices:''}])} className="text-blue-600 font-bold text-sm">+ Savol</button>
                                <input value={correctChoices} onChange={e => setCorrectChoices(e.target.value)} placeholder="To'g'ri javoblar: A,B,C..." className="w-full p-2 border rounded mt-2"/>
                            </div>
                        )}
                    </div>

                    <button onClick={saveLesson} disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition">
                        {loading ? "Saqlanmoqda..." : editingId ? "YANGILASH 🔄" : "SAQLASH ✅"}
                    </button>
                </div>
            )}

            {/* 2. ARCHIVE PAGE */}
            {activeTab === 'archive' && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
                    <h2 className="text-2xl font-bold mb-6 text-slate-800">Vazifalar Arxivi</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-4 font-bold text-gray-500">Mavzu</th>
                                    <th className="p-4 font-bold text-gray-500">Guruh</th>
                                    <th className="p-4 font-bold text-gray-500">Tur</th>
                                    <th className="p-4 font-bold text-gray-500">Sana</th>
                                    <th className="p-4 font-bold text-gray-500 text-right">Amal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {assignments.map((lesson) => (
                                    <tr key={lesson.id} className="hover:bg-gray-50 transition">
                                        <td className="p-4 font-bold text-slate-700">{lesson.title}</td>
                                        <td className="p-4"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">{lesson.targetGroup || 'All'}</span></td>
                                        <td className="p-4 text-xs uppercase text-gray-400 font-bold">{lesson.assignmentType}</td>
                                        <td className="p-4 text-sm text-gray-500">{lesson.createdAt?.toDate().toLocaleDateString()}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={() => handleEdit(lesson)} className="bg-blue-100 text-blue-600 px-3 py-1 rounded-lg font-bold hover:bg-blue-200">Edit</button>
                                            <button onClick={() => deleteItem("assignments", lesson.id, fetchAssignments)} className="bg-red-100 text-red-600 px-3 py-1 rounded-lg font-bold hover:bg-red-200">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. STUDENTS PAGE */}
            {activeTab === 'students' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-xl mb-4">Guruhlar</h3>
                        <div className="flex gap-2 mb-4">
                            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Guruh nomi..." className="flex-1 p-2 border rounded-lg"/>
                            <button onClick={addGroup} className="bg-green-600 text-white px-4 rounded-lg font-bold">+</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {groups.map(g => (
                                <span key={g.id} className="bg-gray-100 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                                    {g.name} <button onClick={() => deleteItem("groups", g.id, fetchGroups)} className="text-red-500">×</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-xl mb-4">O'quvchi Qo'shish</h3>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <select value={newStudentGroup} onChange={e => setNewStudentGroup(e.target.value)} className="p-2 border rounded-lg"><option value="">Guruh...</option>{groups.map(g=><option key={g.id} value={g.name}>{g.name}</option>)}</select>
                            <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Ism" className="p-2 border rounded-lg"/>
                        </div>
                        <div className="flex gap-2 mb-4">
                            <input value={newStudentPin} onChange={e => setNewStudentPin(e.target.value)} placeholder="PIN (4 xona)" type="number" className="flex-1 p-2 border rounded-lg"/>
                            <button onClick={addStudent} className="bg-blue-600 text-white px-6 rounded-lg font-bold">Qo'shish</button>
                        </div>
                        
                        <div className="h-96 overflow-y-auto border-t pt-2 custom-scrollbar">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-400 bg-gray-50 sticky top-0"><tr><th className="p-2">Ism</th><th className="p-2">Guruh</th><th className="p-2">PIN</th><th className="p-2"></th></tr></thead>
                                <tbody>
                                    {students.map(s => (
                                        <tr key={s.id} className="border-b hover:bg-gray-50">
                                            <td className="p-2">{s.name}</td>
                                            <td className="p-2 font-bold text-blue-600">{s.group}</td>
                                            <td className="p-2 font-mono text-gray-400">****</td>
                                            <td className="p-2 text-right"><button onClick={() => deleteItem("users", s.id, fetchStudents)} className="text-red-500 hover:text-red-700">×</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. RESULTS PAGE */}
            {activeTab === 'results' && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">Natijalar</h2>
                        <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">Excelga Yuklash</button>
                    </div>
                    <div className="overflow-auto h-[600px] custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b sticky top-0">
                                <tr>
                                    <th className="p-4 font-bold text-gray-500">O'quvchi</th>
                                    <th className="p-4 font-bold text-gray-500">Guruh</th>
                                    <th className="p-4 font-bold text-gray-500">Mavzu</th>
                                    <th className="p-4 font-bold text-gray-500">Ball</th>
                                    <th className="p-4 font-bold text-gray-500 text-right">Ko'rish</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {results.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer transition" onClick={() => setSelectedResult(r)}>
                                        <td className="p-4 font-bold text-slate-700">{r.studentName}</td>
                                        <td className="p-4 text-xs font-bold text-gray-500 bg-gray-100 rounded w-fit px-2">{r.studentGroup || '-'}</td>
                                        <td className="p-4 text-sm">{r.lessonTitle}</td>
                                        <td className="p-4 font-bold text-blue-600">{r.totalScore}</td>
                                        <td className="p-4 text-right">👁️</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* MODAL (Result Details) */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-3xl rounded-2xl p-8 h-[85vh] overflow-y-auto shadow-2xl">
                <div className="flex justify-between mb-6 border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{selectedResult.studentName}</h2>
                        <p className="text-slate-500">{selectedResult.lessonTitle} • {selectedResult.studentGroup}</p>
                    </div>
                    <button onClick={() => setSelectedResult(null)} className="text-4xl text-gray-300 hover:text-gray-500">&times;</button>
                </div>
                <div className="space-y-4">
                    {selectedResult.history?.map((item, idx) => (
                        <div key={idx} className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
                            <div className="flex justify-between font-bold mb-3">
                                <span className="text-slate-700">#{idx+1} {item.question?.substring(0, 50)}...</span>
                                <span className={item.score >= 5 ? 'text-green-600 bg-green-100 px-2 py-1 rounded' : 'text-red-500 bg-red-100 px-2 py-1 rounded'}>
                                    {item.score} Ball
                                </span>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">O'quvchi javobi:</p>
                                <div className="bg-white p-3 border rounded-xl text-slate-800 whitespace-pre-wrap">{item.userAnswer}</div>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-xl border-l-4 border-yellow-400">
                                <p className="text-xs font-bold text-yellow-800 uppercase mb-2">🤖 AI Feedback:</p>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.feedback}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAdmin;