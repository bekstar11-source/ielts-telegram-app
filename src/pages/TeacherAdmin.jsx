import React, { useState, useEffect, useRef } from 'react'; // useRef qo'shildi
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  // 📱 STATE
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('create'); 

  // --- FORM STATES ---
  const [editingId, setEditingId] = useState(null); 
  const [title, setTitle] = useState('');
  const [assignmentType, setAssignmentType] = useState('translation');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  const [direction, setDirection] = useState('en-uz');
  const [targetGroup, setTargetGroup] = useState('all');
  
  // Specific inputs
  const [imageUrl, setImageUrl] = useState('');
  const [essayPrompt, setEssayPrompt] = useState('');
  const [matchingPairs, setMatchingPairs] = useState([{ textA: '', textB: '' }]);
  const [gapFillText, setGapFillText] = useState('');
  const [correctChoices, setCorrectChoices] = useState('');

  // 🔥 YANGI: DICTATION STATES
  const [audioUrl, setAudioUrl] = useState('');
  const [segments, setSegments] = useState([]); // [{start: 0, end: 2.5, text: ''}]
  const [isRecordingSegments, setIsRecordingSegments] = useState(false); // Yozish rejimi
  const [segmentStartTime, setSegmentStartTime] = useState(null); // Vaqtinchalik start vaqti
  const audioRef = useRef(null); // Audio elementga ulanish uchun

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);

  // Data States
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]); 
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedResultLesson, setSelectedResultLesson] = useState(null);

  // New Student Inputs
  const [newGroupName, setNewGroupName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGroup, setNewStudentGroup] = useState('');
  const [newStudentPin, setNewStudentPin] = useState('');
  const [bulkStudentText, setBulkStudentText] = useState('');

  useEffect(() => { 
    fetchGroups();
    fetchStudents();
    fetchAssignments(); 
    fetchResults();
  }, []);

  // 🔥 SPACE TUGMASINI ESHITISH (Audio Segmentator uchun)
  useEffect(() => {
    const handleKeyDown = (e) => {
        // Faqat Recording rejimi yoqilgan bo'lsa va Space bosilsa
        if (isRecordingSegments && e.code === 'Space') {
            e.preventDefault(); // Sahifa pastga tushib ketmasligi uchun
            
            if (!audioRef.current) return;
            const currentTime = audioRef.current.currentTime;

            if (segmentStartTime === null) {
                // 1-bosish: START
                setSegmentStartTime(currentTime);
            } else {
                // 2-bosish: END va Saqlash
                const newSegment = {
                    start: parseFloat(segmentStartTime.toFixed(2)),
                    end: parseFloat(currentTime.toFixed(2)),
                    text: "" // Matnni keyin yozadi
                };
                setSegments(prev => [...prev, newSegment]);
                setSegmentStartTime(null); // Reset
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordingSegments, segmentStartTime]);


  // --- FETCHERS ---
  const fetchGroups = async () => { try { const q = query(collection(db, "groups"), orderBy("createdAt", "desc")); const snap = await getDocs(q); setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };
  const fetchStudents = async () => { try { const q = query(collection(db, "users"), orderBy("name", "asc")); const snap = await getDocs(q); setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };
  const fetchAssignments = async () => { try { const q = query(collection(db, "assignments"), orderBy("createdAt", "desc")); const snap = await getDocs(q); setAssignments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };
  const fetchResults = async () => { try { const q = query(collection(db, "results"), orderBy("date", "desc")); const snap = await getDocs(q); setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); } catch (e) { console.error(e); } };

  // --- SAVE ACTIONS ---
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
    // 🔥 DICTATION DATA
    else if (assignmentType === 'dictation') {
        lessonData.audioUrl = audioUrl;
        lessonData.segments = segments;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "assignments", editingId), lessonData);
        alert("Yangilandi! 🔄");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "assignments"), lessonData);
        alert("Saqlandi! ✅");
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
    
    // 🔥 Dictation Edit
    if (lesson.audioUrl) setAudioUrl(lesson.audioUrl);
    if (lesson.segments) setSegments(lesson.segments);

    setActiveTab('create'); 
    setIsSidebarOpen(false); 
  };

  const resetForm = () => {
    setTitle(''); setEditingId(null); setSentences([{ original: '', translation: '' }]);
    setEssayPrompt(''); setImageUrl(''); setGapFillText(''); setMatchingPairs([{ textA: '', textB: '' }]);
    setCorrectChoices('');
    setAudioUrl(''); setSegments([]); setSegmentStartTime(null); setIsRecordingSegments(false);
  };

  const deleteItem = async (col, id, refresh) => { if(window.confirm("O'chiraymi?")) { await deleteDoc(doc(db, col, id)); refresh(); } };
  const addGroup = async () => { if (!newGroupName.trim()) return; await addDoc(collection(db, "groups"), { name: newGroupName.trim(), createdAt: serverTimestamp() }); setNewGroupName(''); fetchGroups(); };
  const addStudent = async () => { if (!newStudentName || !newStudentPin) return alert("Xato"); await addDoc(collection(db, "users"), { name: newStudentName, group: newStudentGroup, pin: newStudentPin, createdAt: serverTimestamp() }); setNewStudentName(''); setNewStudentPin(''); fetchStudents(); };
  
  const addBulkStudents = async () => {
    if (!newStudentGroup) return alert("Avval guruhni tanlang!");
    if (!bulkStudentText.trim()) return alert("Ro'yxat bo'sh!");
    setLoading(true);
    const lines = bulkStudentText.split('\n');
    const promises = [];
    for (let line of lines) {
        if (!line.trim()) continue;
        let [name, pin] = line.split(/[|,]/).map(item => item.trim());
        if (name) {
            if (!pin) pin = Math.floor(1000 + Math.random() * 9000).toString();
            promises.push(addDoc(collection(db, "users"), { name: name, group: newStudentGroup, pin: pin, createdAt: serverTimestamp() }));
        }
    }
    try { await Promise.all(promises); alert(`${promises.length} ta o'quvchi qo'shildi!`); setBulkStudentText(''); fetchStudents(); } 
    catch (error) { alert("Xato: " + error.message); }
    setLoading(false);
  };

  const processBulkText = () => { if (!bulkText.trim()) return; const lines = bulkText.split('\n'); const parsed = []; lines.forEach(line => { if(line.includes('|')) { const [o, t] = line.split('|'); if(o.trim() && t.trim()) parsed.push({original: o.trim(), translation: t.trim()}); } }); if(parsed.length) { setSentences(parsed); setIsBulkMode(false); } };
  
  const exportToExcel = () => {
    const data = results.map(r => ({ Ism: r.studentName, Guruh: r.studentGroup, Mavzu: r.lessonTitle, Ball: r.totalScore }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Natijalar.xlsx");
  };

  const getUniqueLessons = () => {
    const unique = {};
    results.forEach(r => {
        if (!unique[r.lessonTitle]) unique[r.lessonTitle] = { title: r.lessonTitle, count: 0, type: r.assignmentType };
        unique[r.lessonTitle].count += 1;
    });
    return Object.values(unique);
  };

  return (
    <div className="flex h-screen w-full bg-gray-100 font-sans overflow-hidden">
      
      {/* 🌑 OVERLAY */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* 🖥️ SIDEBAR */}
      <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white shadow-xl transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:translate-x-0 lg:flex-shrink-0
      `}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-400">Admin</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-2xl text-gray-400">×</button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button onClick={() => { setActiveTab('create'); resetForm(); setIsSidebarOpen(false); }} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'create' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📝 Yangi Dars</button>
            <button onClick={() => { setActiveTab('archive'); setIsSidebarOpen(false); }} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'archive' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📂 Arxiv</button>
            <button onClick={() => { setActiveTab('add_student'); setIsSidebarOpen(false); }} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'add_student' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>➕ O'quvchi Qo'shish</button>
            <button onClick={() => { setActiveTab('students_list'); setIsSidebarOpen(false); }} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'students_list' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>👥 O'quvchilar Ro'yxati</button>
            <button onClick={() => { setActiveTab('results'); setSelectedResultLesson(null); setIsSidebarOpen(false); }} className={`w-full text-left p-3 rounded-xl transition ${activeTab === 'results' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>📈 Natijalar</button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative w-full">
        
        {/* 📱 MOBILE HEADER */}
        <header className="bg-white border-b p-4 flex items-center justify-between lg:hidden shadow-sm z-30">
            <span className="font-bold text-slate-800 text-lg">IELTS Admin</span>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-md hover:bg-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 w-full">
            
            {/* 1. CREATE PAGE */}
            {activeTab === 'create' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 w-full max-w-4xl mx-auto">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">{editingId ? "Tahrirlash ✏️" : "Yangi Dars ➕"}</h2>
                        {editingId && <button onClick={resetForm} className="text-red-500 text-sm underline">Bekor qilish</button>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu nomi..." className="w-full p-3 border rounded-xl outline-none focus:ring-2 ring-blue-500 bg-gray-50"/>
                        <select value={assignmentType} onChange={e => setAssignmentType(e.target.value)} className="w-full p-3 border rounded-xl bg-purple-50 font-bold text-purple-800">
                            <option value="translation">Translation</option>
                            <option value="dictation">🎧 Dictation (Diktant)</option> {/* 🔥 YANGI TYPE */}
                            <option value="essay_task1">Task 1 (Report)</option>
                            <option value="essay_task2">Task 2 (Essay)</option>
                            <option value="matching">Matching</option>
                            <option value="gap_fill">Gap Filling</option>
                            <option value="multiple_choice">Multiple Choice</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)} className="w-full p-3 border rounded-xl bg-yellow-50 font-bold text-yellow-800">
                            <option value="all">🌍 Barcha Guruhlar</option>
                            {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                        {assignmentType === 'translation' && (
                            <select value={direction} onChange={e => setDirection(e.target.value)} className="w-full p-3 border rounded-xl bg-blue-50 text-blue-800 font-bold">
                                <option value="en-uz">🇬🇧 -> 🇺🇿</option>
                                <option value="uz-en">🇺🇿 -> 🇬🇧</option>
                            </select>
                        )}
                    </div>

                    {/* DYNAMIC FORMS */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                        
                        {/* 🔥 DICTATION SEGMENTATOR 🔥 */}
                        {assignmentType === 'dictation' && (
                            <div className="space-y-4">
                                <div className="bg-blue-100 p-4 rounded-xl border border-blue-200 text-blue-800 text-sm">
                                    <h4 className="font-bold mb-2">🎤 Qanday ishlatiladi?</h4>
                                    <ol className="list-decimal pl-4 space-y-1">
                                        <li>Audio URL ni qo'ying (GitHub .mp3?raw=true).</li>
                                        <li><b>"🔴 Segmentlash"</b> tugmasini bosing (ramka qizaradi).</li>
                                        <li>Audioni o'ynating (Play).</li>
                                        <li>Gap boshlanganda <b>SPACE</b> ni bosing.</li>
                                        <li>Gap tugaganda yana <b>SPACE</b> ni bosing (Yangi qator ochiladi).</li>
                                        <li>Qatorlarga matnni yozib chiqing.</li>
                                    </ol>
                                </div>

                                <input value={audioUrl} onChange={e => setAudioUrl(e.target.value)} placeholder="Audio URL (mp3)..." className="w-full p-3 border rounded-xl"/>
                                
                                <div className={`p-4 border-2 rounded-xl transition-colors ${isRecordingSegments ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}>
                                    <div className="flex items-center gap-4 mb-3">
                                        <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                                        <button 
                                            onClick={() => { setIsRecordingSegments(!isRecordingSegments); setSegmentStartTime(null); }}
                                            className={`px-4 py-2 rounded-lg font-bold text-white whitespace-nowrap ${isRecordingSegments ? 'bg-red-600 animate-pulse' : 'bg-slate-800'}`}
                                        >
                                            {isRecordingSegments ? "🔴 STOP" : "⚫ Segmentlash"}
                                        </button>
                                    </div>
                                    
                                    {/* Segment Start Indicator */}
                                    {segmentStartTime !== null && (
                                        <div className="text-center text-red-600 font-bold animate-pulse mb-2">
                                            Yozilmoqda... (Tugatish uchun SPACE bosing)
                                        </div>
                                    )}

                                    {/* Segments List */}
                                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                                        {segments.map((seg, i) => (
                                            <div key={i} className="flex gap-2 items-center">
                                                <div className="bg-gray-200 px-2 py-2 rounded text-xs font-mono font-bold w-24 text-center">
                                                    {seg.start}s - {seg.end}s
                                                </div>
                                                <input 
                                                    placeholder={`Jumla #${i+1} matni...`}
                                                    className="flex-1 p-2 border rounded-lg text-sm"
                                                    value={seg.text}
                                                    onChange={(e) => {
                                                        const newSegs = [...segments];
                                                        newSegs[i].text = e.target.value;
                                                        setSegments(newSegs);
                                                    }}
                                                />
                                                <button onClick={() => setSegments(segments.filter((_, idx) => idx !== i))} className="text-red-500 font-bold px-2">×</button>
                                            </div>
                                        ))}
                                    </div>
                                    {segments.length === 0 && <p className="text-center text-gray-400 text-sm mt-2">Hali segmentlar yo'q.</p>}
                                </div>
                            </div>
                        )}

                        {(assignmentType === 'translation' || assignmentType === 'matching') && (
                            <>
                                <div className="flex gap-2 mb-4">
                                    <button onClick={() => setIsBulkMode(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${!isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Qatorma-qator</button>
                                    <button onClick={() => setIsBulkMode(true)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>Tezkor</button>
                                </div>
                                {!isBulkMode ? (
                                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                        {(assignmentType==='matching'?matchingPairs:sentences).map((s, i) => (
                                            <div key={i} className="flex gap-2">
                                                <input placeholder="Orig" className="flex-1 p-2 border rounded-lg min-w-0" value={assignmentType==='matching'?s.textA:s.original} onChange={e => {
                                                    const list = assignmentType==='matching'?[...matchingPairs]:[...sentences];
                                                    if(assignmentType==='matching') list[i].textA=e.target.value; else list[i].original=e.target.value;
                                                    assignmentType==='matching'?setMatchingPairs(list):setSentences(list);
                                                }}/>
                                                <input placeholder="Trans" className="flex-1 p-2 border rounded-lg min-w-0" value={assignmentType==='matching'?s.textB:s.translation} onChange={e => {
                                                    const list = assignmentType==='matching'?[...matchingPairs]:[...sentences];
                                                    if(assignmentType==='matching') list[i].textB=e.target.value; else list[i].translation=e.target.value;
                                                    assignmentType==='matching'?setMatchingPairs(list):setSentences(list);
                                                }}/>
                                            </div>
                                        ))}
                                        <button onClick={() => assignmentType==='matching'?setMatchingPairs([...matchingPairs, {textA:'',textB:''}]):setSentences([...sentences, {original:'',translation:''}])} className="text-blue-600 font-bold text-sm mt-2">+ Qo'shish</button>
                                    </div>
                                ) : (
                                    <div>
                                        <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} className="w-full h-32 p-3 border rounded-xl text-sm" placeholder="Apple | Olma"/>
                                        <button onClick={processBulkText} className="text-blue-600 font-bold mt-2 text-sm">Formatlash</button>
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

                    <button onClick={saveLesson} disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-black transition">
                        {loading ? "Saqlanmoqda..." : editingId ? "YANGILASH 🔄" : "SAQLASH ✅"}
                    </button>
                </div>
            )}

            {/* 2. ARCHIVE PAGE */}
            {activeTab === 'archive' && (
                <div className="bg-white p-4 lg:p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-5xl mx-auto">
                    <h2 className="text-xl font-bold mb-4 text-slate-800">Arxiv (Vazifalar)</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-3 text-sm text-gray-500">Mavzu</th>
                                    <th className="p-3 text-sm text-gray-500">Guruh</th>
                                    <th className="p-3 text-sm text-gray-500">Tur</th>
                                    <th className="p-3 text-sm text-gray-500">Sana</th>
                                    <th className="p-3 text-sm text-gray-500 text-right">Amal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {assignments.map((lesson) => (
                                    <tr key={lesson.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-bold text-slate-700 text-sm">{lesson.title}</td>
                                        <td className="p-3"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">{lesson.targetGroup || 'All'}</span></td>
                                        <td className="p-3 text-xs uppercase text-gray-400 font-bold">{lesson.assignmentType}</td>
                                        <td className="p-3 text-xs text-gray-500">{lesson.createdAt?.toDate().toLocaleDateString()}</td>
                                        <td className="p-3 text-right flex justify-end gap-2">
                                            <button onClick={() => handleEdit(lesson)} className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200">✎</button>
                                            <button onClick={() => deleteItem("assignments", lesson.id, fetchAssignments)} className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold hover:bg-red-200">🗑</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. ADD STUDENT */}
            {activeTab === 'add_student' && (
                <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Groups Create */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-4">Yangi Guruh Yaratish</h3>
                        <div className="flex gap-2 mb-4">
                            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Nomi..." className="flex-1 p-2 border rounded-lg text-sm"/>
                            <button onClick={addGroup} className="bg-green-600 text-white px-4 rounded-lg font-bold text-sm">+</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {groups.map(g => (
                                <span key={g.id} className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    {g.name} <button onClick={() => deleteItem("groups", g.id, fetchGroups)} className="text-red-500 hover:text-red-700">×</button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Single Add */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg mb-4">Bittalab Qo'shish</h3>
                        <div className="space-y-3">
                            <select value={newStudentGroup} onChange={e => setNewStudentGroup(e.target.value)} className="w-full p-2 border rounded-lg text-sm"><option value="">Guruh...</option>{groups.map(g=><option key={g.id} value={g.name}>{g.name}</option>)}</select>
                            <input value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Ism" className="w-full p-2 border rounded-lg text-sm"/>
                            <input value={newStudentPin} onChange={e => setNewStudentPin(e.target.value)} placeholder="PIN" type="number" className="w-full p-2 border rounded-lg text-sm"/>
                            <button onClick={addStudent} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm">Qo'shish</button>
                        </div>
                    </div>

                    {/* Bulk Add */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-2">
                        <h3 className="font-bold text-lg mb-4">Ommaviy (Bulk) Qo'shish</h3>
                        <div className="text-xs text-gray-500 mb-2">Ism Familiya | PIN (yoki faqat Ism)</div>
                        <textarea 
                            value={bulkStudentText} 
                            onChange={e => setBulkStudentText(e.target.value)} 
                            placeholder="Vali Aliyev | 1234&#10;G'ani G'aniyev"
                            className="w-full h-32 p-2 border rounded-lg text-sm mb-2"
                        />
                        <button onClick={addBulkStudents} disabled={loading} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold text-sm w-full lg:w-auto">
                            {loading ? "..." : "Bulk Qo'shish"}
                        </button>
                    </div>
                </div>
            )}

            {/* 4. STUDENTS LIST */}
            {activeTab === 'students_list' && (
                <div className="max-w-6xl mx-auto space-y-6">
                    <h2 className="text-2xl font-bold text-slate-800">O'quvchilar Ro'yxati</h2>
                    {groups.map((group) => {
                        const groupStudents = students.filter(s => s.group === group.name);
                        if (groupStudents.length === 0) return null;

                        return (
                            <div key={group.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-lg text-blue-600 mb-3">{group.name} ({groupStudents.length})</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-gray-400 bg-gray-50">
                                            <tr><th className="p-2">Ism</th><th className="p-2">PIN</th><th className="p-2 text-right">Amal</th></tr>
                                        </thead>
                                        <tbody>
                                            {groupStudents.map(s => (
                                                <tr key={s.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-2 font-medium">{s.name}</td>
                                                    <td className="p-2 font-mono text-gray-400">{s.pin}</td>
                                                    <td className="p-2 text-right">
                                                        <button onClick={() => deleteItem("users", s.id, fetchStudents)} className="text-red-500 hover:text-red-700 font-bold">O'chirish</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    })}
                    {/* Guruhsizlar */}
                    {students.filter(s => !groups.some(g => g.name === s.group)).length > 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200">
                            <h3 className="font-bold text-lg text-red-600 mb-3">Guruhsiz O'quvchilar</h3>
                            {/* Jadval xuddi yuqoridagidek... */}
                        </div>
                    )}
                </div>
            )}

            {/* 5. RESULTS PAGE (Papkali) */}
            {activeTab === 'results' && (
                <div className="bg-white p-4 lg:p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-6xl mx-auto">
                    
                    {!selectedResultLesson ? (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Natijalar (Darslar Bo'yicha)</h2>
                                <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-xs">Excel</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {getUniqueLessons().map((item, index) => (
                                    <div 
                                        key={index} 
                                        onClick={() => setSelectedResultLesson(item.title)}
                                        className="bg-gray-50 p-6 rounded-2xl border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col items-center text-center"
                                    >
                                        <div className="text-4xl mb-2">📂</div>
                                        <h3 className="font-bold text-slate-800">{item.title}</h3>
                                        <span className="text-xs font-bold text-gray-400 uppercase mt-1">{item.type}</span>
                                        <span className="mt-4 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                                            {item.count} ta natija
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 mb-6">
                                <button onClick={() => setSelectedResultLesson(null)} className="text-slate-500 hover:text-blue-600 font-bold">← Ortga</button>
                                <h2 className="text-xl font-bold text-blue-600">Natijalar: {selectedResultLesson}</h2>
                            </div>
                            <div className="overflow-auto h-[600px] custom-scrollbar">
                                <table className="w-full text-left min-w-[600px]">
                                    <thead className="bg-gray-50 border-b sticky top-0">
                                        <tr>
                                            <th className="p-3 text-sm font-bold text-gray-500">O'quvchi</th>
                                            <th className="p-3 text-sm font-bold text-gray-500">Guruh</th>
                                            <th className="p-3 text-sm font-bold text-gray-500">Ball</th>
                                            <th className="p-3 text-sm font-bold text-gray-500 text-right">Ko'rish</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {results.filter(r => r.lessonTitle === selectedResultLesson).map(r => (
                                            <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedResult(r)}>
                                                <td className="p-3 text-sm font-bold text-slate-700">{r.studentName}</td>
                                                <td className="p-3 text-xs font-bold text-gray-500 bg-gray-100 rounded w-fit px-2">{r.studentGroup || '-'}</td>
                                                <td className="p-3 text-sm font-bold text-blue-600">{r.totalScore}</td>
                                                <td className="p-3 text-sm text-right">👁️</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}
        </main>
      </div>

      {/* MODAL */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-3xl rounded-2xl p-6 h-[85vh] overflow-y-auto shadow-2xl relative">
                <button onClick={() => setSelectedResult(null)} className="absolute top-4 right-4 text-3xl text-gray-400">&times;</button>
                <h2 className="text-xl font-bold text-slate-800">{selectedResult.studentName}</h2>
                <p className="text-sm text-slate-500 mb-6">{selectedResult.lessonTitle} • {selectedResult.studentGroup}</p>
                
                <div className="space-y-4">
                    {selectedResult.history?.map((item, idx) => (
                        <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex justify-between font-bold mb-2">
                                <span className="text-sm">#{idx+1} {item.question?.substring(0, 30)}...</span>
                                <span className={item.score >= 5 ? 'text-green-600 text-xs' : 'text-red-500 text-xs'}>{item.score} Ball</span>
                            </div>
                            <div className="bg-white p-2 border rounded-lg text-sm mb-2 whitespace-pre-wrap">{item.userAnswer}</div>
                            <div className="bg-yellow-50 p-2 rounded-lg border-l-4 border-yellow-400 text-xs italic whitespace-pre-wrap">{item.feedback}</div>
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