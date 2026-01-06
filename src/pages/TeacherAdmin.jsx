import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  const [direction, setDirection] = useState('en-uz');
  
  // 🔥 GURUH BOSHQARUVI
  const [groups, setGroups] = useState([]); 
  const [newGroupName, setNewGroupName] = useState('');

  // Bulk Mode
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Natijalar
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => { 
    fetchResults(); 
    fetchGroups(); // Guruhlarni yuklash
  }, []);

  // 1. GURUHLARNI YUKLASH
  const fetchGroups = async () => {
    const q = query(collection(db, "groups"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setGroups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  // 2. YANGI GURUH QO'SHISH
  const addGroup = async () => {
    if (!newGroupName.trim()) return alert("Guruh nomini yozing!");
    try {
      await addDoc(collection(db, "groups"), { 
        name: newGroupName.trim(), 
        createdAt: serverTimestamp() 
      });
      setNewGroupName('');
      fetchGroups();
    } catch (e) { alert("Xato: " + e.message); }
  };

  // 3. GURUHNI O'CHIRISH
  const deleteGroup = async (id) => {
    if (window.confirm("Bu guruhni o'chirmoqchimisiz?")) {
      await deleteDoc(doc(db, "groups", id));
      fetchGroups();
    }
  };

  // Natijalarni yuklash
  const fetchResults = async () => {
    const q = query(collection(db, "results"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setResults(data);
    setFilteredResults(data);
  };

  // Filtrlash
  useEffect(() => {
    if (selectedGroupFilter === 'all') {
        setFilteredResults(results);
    } else {
        setFilteredResults(results.filter(r => (r.studentGroup || "Guruhsiz") === selectedGroupFilter));
    }
  }, [selectedGroupFilter, results]);

  const saveLesson = async () => {
    if (!title) return alert("Mavzu yozilmadi!");
    setLoading(true);
    try {
      await addDoc(collection(db, "assignments"), { title, sentences, direction, createdAt: serverTimestamp() });
      alert("Dars saqlandi! ✅");
      setTitle(''); setSentences([{ original: '', translation: '' }]); setBulkText('');
    } catch (e) { alert("Xato: " + e.message); }
    setLoading(false);
  };

  // Bulk text processor
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
  
  const handleDelete = async (id) => { if (window.confirm("O'chiraymi?")) { await deleteDoc(doc(db, "results", id)); fetchResults(); } };
  
  const exportToExcel = () => {
    const data = filteredResults.map(r => ({ Guruh: r.studentGroup, Ism: r.studentName, Mavzu: r.lessonTitle, Ball: r.totalScore }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Natijalar");
    XLSX.writeFile(wb, "Natijalar.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      
      {/* 🔥 1. GURUHLARNI BOSHQARISH PANEL */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8 max-w-6xl mx-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Guruhlarni Sozlash 👥</h2>
        <div className="flex gap-2 mb-4">
            <input 
                value={newGroupName} 
                onChange={e => setNewGroupName(e.target.value)}
                placeholder="Yangi guruh nomi (masalan: Pre-IELTS A)" 
                className="flex-1 p-3 border rounded-xl outline-none focus:ring-2 ring-blue-500"
            />
            <button onClick={addGroup} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-700">+ Qo'shish</button>
        </div>
        <div className="flex flex-wrap gap-2">
            {groups.map(g => (
                <div key={g.id} className="bg-blue-50 px-4 py-2 rounded-full text-blue-800 font-bold text-sm flex items-center gap-2 border border-blue-100">
                    {g.name}
                    <button onClick={() => deleteGroup(g.id)} className="text-red-400 hover:text-red-600 ml-1">×</button>
                </div>
            ))}
            {groups.length === 0 && <span className="text-gray-400 text-sm">Hozircha guruhlar yo'q.</span>}
        </div>
      </div>

      {/* Statistika va Filtr */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-6xl mx-auto">
        <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg">
            <h2 className="text-3xl font-bold">{filteredResults.length}</h2>
            <p className="opacity-80">Jami Natijalar</p>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-lg flex items-center justify-center">
            <select 
                value={selectedGroupFilter} 
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="w-full p-3 bg-gray-100 rounded-xl font-bold text-gray-700 outline-none"
            >
                <option value="all">🌍 Barcha Guruhlar</option>
                {groups.map(g => (
                    <option key={g.id} value={g.name}>👥 {g.name}</option>
                ))}
            </select>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-lg flex items-center justify-center">
           <button onClick={exportToExcel} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-green-700">📊 Excel</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Dars Yaratish */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold mb-4">Yangi Dars 📝</h2>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu nomi..." className="w-full p-3 border rounded-xl mb-4 bg-gray-50 outline-none focus:ring-2 ring-blue-500"/>
          
          <div className="mb-4">
             <select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-full p-3 border rounded-xl bg-blue-50 text-blue-800 font-bold">
                 <option value="en-uz">🇬🇧 English {'>'} 🇺🇿 Uzbek</option>
                 <option value="uz-en">🇺🇿 Uzbek {'>'} 🇬🇧 English</option>
             </select>
          </div>

          <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
             <button onClick={() => setIsBulkMode(false)} className={`flex-1 py-2 font-bold rounded-lg ${!isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Birma-bir</button>
             <button onClick={() => setIsBulkMode(true)} className={`flex-1 py-2 font-bold rounded-lg ${isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Tezkor</button>
          </div>

          {!isBulkMode ? (
             <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 mb-4">
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
                <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} className="w-full h-32 p-3 border rounded-xl text-sm" placeholder="Savol | Javob"/>
                <button onClick={processBulkText} className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg font-bold mt-2">Formatlash</button>
             </div>
          )}

          <button onClick={saveLesson} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">SAQLASH ✅</button>
        </div>

        {/* Natijalar Ro'yxati */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[600px] flex flex-col">
            <h2 className="text-xl font-bold mb-4">Natijalar</h2>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {filteredResults.map(r => (
                    <div key={r.id} className="flex justify-between items-center p-3 hover:bg-gray-50 border-b cursor-pointer" onClick={() => setSelectedResult(r)}>
                        <div>
                            <div className="flex gap-2 items-center">
                                <p className="font-bold text-gray-800">{r.studentName}</p>
                                <span className="bg-gray-200 text-gray-600 text-[10px] px-2 rounded-full">{r.studentGroup || "Guruhsiz"}</span>
                            </div>
                            <p className="text-xs text-gray-400">{r.lessonTitle} • {r.totalScore} ball</p>
                        </div>
                        <span className="text-xl">👁️</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Modal - Details */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-2xl p-6 h-[80vh] overflow-y-auto">
                <div className="flex justify-between mb-4">
                    <h2 className="text-xl font-bold">{selectedResult.studentName}</h2>
                    <button onClick={() => setSelectedResult(null)} className="text-2xl text-gray-400">×</button>
                </div>
                {selectedResult.history?.map((item, idx) => (
                    <div key={idx} className="mb-4 p-4 border rounded-xl bg-gray-50">
                        <div className="flex justify-between">
                             <span className="font-bold text-sm">#{idx+1} {item.question}</span>
                             <span className={`font-bold ${item.score === 5 ? 'text-green-600' : 'text-red-500'}`}>{item.score}/5</span>
                        </div>
                        <div className="grid gap-2 mt-2 text-sm">
                            <div className="bg-white p-2 border rounded"><span className="text-xs font-bold text-gray-400 block">O'quvchi:</span>{item.userAnswer}</div>
                            <div className="bg-blue-50 p-2 border rounded"><span className="text-xs font-bold text-gray-400 block">Ustoz:</span>{item.teacherTrans}</div>
                        </div>
                        <p className="text-xs text-gray-500 italic mt-2 border-t pt-1">AI: {item.feedback}</p>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAdmin;