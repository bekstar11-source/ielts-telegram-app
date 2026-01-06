import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  
  // 🔥 YANGI: Dars yo'nalishi (Default: English -> Uzbek)
  const [direction, setDirection] = useState('en-uz'); 
  
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => { fetchResults(); }, []);

  const fetchResults = async () => {
    const q = query(collection(db, "results"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const processBulkText = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n');
    const parsedSentences = [];
    lines.forEach((line) => {
      if (line.includes('|')) {
        const [orig, trans] = line.split('|');
        if (orig.trim() && trans.trim()) {
          parsedSentences.push({ original: orig.trim(), translation: trans.trim() });
        }
      }
    });
    if (parsedSentences.length > 0) {
      setSentences(parsedSentences);
      setIsBulkMode(false);
    }
  };

  const saveLesson = async () => {
    if (!title) return alert("Mavzu yozilmadi!");
    setLoading(true);
    try {
      await addDoc(collection(db, "assignments"), { 
        title, 
        sentences, 
        direction, // 🔥 Yo'nalishni bazaga saqlaymiz
        createdAt: serverTimestamp() 
      });
      alert("Dars saqlandi! ✅");
      setTitle(''); setSentences([{ original: '', translation: '' }]); setBulkText('');
    } catch (e) { alert("Xato: " + e.message); }
    setLoading(false);
  };

  // ... (Delete va Excel funksiyalari o'zgarishsiz qoladi)
  const handleDelete = async (id) => { if (window.confirm("O'chiraymi?")) { await deleteDoc(doc(db, "results", id)); fetchResults(); } };
  const exportToExcel = () => { /* Eski kod */ };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      {/* ... Dashboard kartochkalari (eski kod) ... */}
      
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        
        {/* Dars Yaratish Panel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold mb-4">Yangi Dars 📝</h2>
          
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu nomi..." className="w-full p-3 border rounded-xl mb-4 bg-gray-50 outline-none focus:ring-2 ring-blue-500"/>

          {/* 🔥 YO'NALISHNI TANLASH */}
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Tarjima yo'nalishi:</label>
            <select 
              value={direction} 
              onChange={(e) => setDirection(e.target.value)}
              className="w-full p-3 mt-1 border rounded-xl bg-blue-50 text-blue-800 font-bold outline-none"
            >
              <option value="en-uz">🇬🇧 English ➡️ 🇺🇿 Uzbek</option>
              <option value="uz-en">🇺🇿 Uzbek ➡️ 🇬🇧 English</option>
            </select>
          </div>

          <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setIsBulkMode(false)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${!isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Birma-bir</button>
            <button onClick={() => setIsBulkMode(true)} className={`flex-1 py-2 rounded-lg text-sm font-bold ${isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Tezkor</button>
          </div>

          {/* INPUTLAR (Label dinamik o'zgaradi) */}
          {!isBulkMode && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 mb-4">
              {sentences.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input 
                    placeholder={direction === 'en-uz' ? "Inglizcha..." : "O'zbekcha..."} 
                    className="flex-1 p-2 border rounded-lg text-sm" 
                    value={s.original} 
                    onChange={e => {const n=[...sentences]; n[i].original=e.target.value; setSentences(n)}} 
                  />
                  <input 
                    placeholder={direction === 'en-uz' ? "O'zbekcha..." : "Inglizcha..."} 
                    className="flex-1 p-2 border rounded-lg text-sm" 
                    value={s.translation} 
                    onChange={e => {const n=[...sentences]; n[i].translation=e.target.value; setSentences(n)}} 
                  />
                </div>
              ))}
              <button onClick={() => setSentences([...sentences, {original:'', translation:''}])} className="text-blue-500 text-sm font-bold">+ Qo'shish</button>
            </div>
          )}

          {isBulkMode && (
            <div className="mb-4">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-2">
                <b>Format:</b> Savol | Javob
              </div>
              <textarea 
                value={bulkText} onChange={e => setBulkText(e.target.value)} 
                className="w-full h-32 p-3 border rounded-xl text-sm"
                placeholder={direction === 'en-uz' ? "I go | Men boraman" : "Men boraman | I go"}
              />
              <button onClick={processBulkText} className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg font-bold mt-2">O'zgartirish</button>
            </div>
          )}

          <button onClick={saveLesson} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">SAQLASH ✅</button>
        </div>

        {/* Natijalar Jadvali (Modal oynasi bilan birga - eski kodni qo'yishingiz mumkin) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[500px] overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4">Barcha Natijalar</h2>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {results.map(r => (
                    <div key={r.id} className="flex justify-between items-center p-3 hover:bg-gray-50 border-b cursor-pointer" onClick={() => setSelectedResult(r)}>
                        <div>
                            <p className="font-bold text-gray-800">{r.studentName}</p>
                            <p className="text-xs text-gray-400">{r.lessonTitle} ({r.totalScore})</p>
                        </div>
                        <span className="text-2xl">👁️</span>
                    </div>
                ))}
            </div>
        </div>

      </div>

      {/* MODAL (O'quvchi javoblarini ko'rish uchun) */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-2xl p-6 h-[80vh] overflow-y-auto">
                <div className="flex justify-between mb-4">
                    <h2 className="text-xl font-bold">{selectedResult.studentName} - {selectedResult.lessonTitle}</h2>
                    <button onClick={() => setSelectedResult(null)} className="text-2xl">×</button>
                </div>
                {selectedResult.history?.map((item, idx) => (
                    <div key={idx} className="mb-4 p-4 border rounded-xl bg-gray-50">
                        <p className="font-bold text-gray-700 text-sm">Savol: {item.question}</p>
                        <p className="text-blue-600 font-bold my-1">Javob: {item.userAnswer}</p>
                        <p className="text-xs text-gray-500">To'g'ri: {item.teacherTrans}</p>
                        <p className="text-xs italic text-gray-400 mt-2">AI: {item.feedback}</p>
                        <span className="text-xs font-bold float-right bg-white px-2 border rounded">{item.score}/5</span>
                    </div>
                ))}
            </div>
        </div>
      )}

    </div>
  );
};

export default TeacherAdmin;