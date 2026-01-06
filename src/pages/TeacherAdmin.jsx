import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  const [title, setTitle] = useState('');
  
  // Asosiy gaplar ro'yxati
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  
  // 🔥 YANGI: Tezkor rejim holati va matni
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

  // 🔥 YANGI: Matnni avtomatik ajratib olish funksiyasi
  const processBulkText = () => {
    if (!bulkText.trim()) return alert("Matn maydoni bo'sh!");

    const lines = bulkText.split('\n'); // Yangi qator bo'yicha bo'lish
    const parsedSentences = [];

    lines.forEach((line) => {
      // "|" belgisi orqali ingliz va o'zbekchani ajratish
      if (line.includes('|')) {
        const [orig, trans] = line.split('|');
        if (orig.trim() && trans.trim()) {
          parsedSentences.push({
            original: orig.trim(),
            translation: trans.trim()
          });
        }
      }
    });

    if (parsedSentences.length === 0) {
      alert("Format noto'g'ri! 'Inglizcha | O'zbekcha' ko'rinishida yozing.");
    } else {
      setSentences(parsedSentences);
      setIsBulkMode(false); // Oddiy rejimga qaytish
      alert(`${parsedSentences.length} ta gap muvaffaqiyatli qo'shildi! ✅`);
    }
  };

  const saveLesson = async () => {
    if (!title) return alert("Mavzu yozilmadi!");
    if (sentences.length === 0 || !sentences[0].original) return alert("Gaplar yo'q!");
    
    setLoading(true);
    try {
      await addDoc(collection(db, "assignments"), { title, sentences, createdAt: serverTimestamp() });
      alert("Dars saqlandi! ✅");
      setTitle(''); 
      setSentences([{ original: '', translation: '' }]);
      setBulkText('');
    } catch (e) { alert("Xatolik: " + e.message); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("O'chirmoqchimisiz?")) {
      await deleteDoc(doc(db, "results", id));
      fetchResults();
    }
  };

  const exportToExcel = () => {
    const data = results.map(r => ({ Ism: r.studentName, Mavzu: r.lessonTitle, Ball: r.totalScore, Sana: r.date?.toDate().toLocaleDateString() }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Natijalar");
    XLSX.writeFile(wb, "Report.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans relative">
      
      {/* Statistika (Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-6xl mx-auto">
        <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg">
          <p className="opacity-80">Jami Testlar</p>
          <h2 className="text-3xl font-bold">{results.length}</h2>
        </div>
        <div className="bg-green-500 text-white p-5 rounded-2xl shadow-lg">
          <p className="opacity-80">O'rtacha Ball</p>
          <h2 className="text-3xl font-bold">
            {results.length > 0 ? (results.reduce((a, b) => a + (b.totalScore || 0), 0) / results.length).toFixed(1) : 0}
          </h2>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-lg flex items-center justify-center">
           <button onClick={exportToExcel} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-green-700">📊 Excel</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Dars Yaratish Formasi */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold mb-4">Yangi Dars 📝</h2>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu nomi..." className="w-full p-3 border rounded-xl mb-4 bg-gray-50 outline-none focus:ring-2 ring-blue-500"/>

          {/* 🔥 REJIMNI ALMASHTIRISH TUGMALARI */}
          <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setIsBulkMode(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              Birma-bir kiritish
            </button>
            <button 
              onClick={() => setIsBulkMode(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isBulkMode ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              Tezkor (Kopy-Past) ⚡
            </button>
          </div>

          {/* 1. BIRMA-BIR KIRITISH REJIMI */}
          {!isBulkMode && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 mb-4 custom-scrollbar">
              {sentences.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Inglizcha..." className="flex-1 p-2 border rounded-lg text-sm" value={s.original} 
                    onChange={e => {const n=[...sentences]; n[i].original=e.target.value; setSentences(n)}} />
                  <input placeholder="O'zbekcha..." className="flex-1 p-2 border rounded-lg text-sm" value={s.translation} 
                    onChange={e => {const n=[...sentences]; n[i].translation=e.target.value; setSentences(n)}} />
                </div>
              ))}
              <button onClick={() => setSentences([...sentences, {original:'', translation:''}])} className="text-blue-500 text-sm font-bold p-1">+ Yana qo'shish</button>
            </div>
          )}

          {/* 2. TEZKOR REJIM (TEXTAREA) */}
          {isBulkMode && (
            <div className="mb-4 animate-in fade-in">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg mb-2">
                <b>Qo'llanma:</b> Har bir qatorga bitta gap yozing. Inglizcha va O'zbekchani <b>|</b> belgisi bilan ajrating.<br/>
                <i>Misol: I go home | Men uyga ketyapman</i>
              </div>
              <textarea 
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"I go home | Men uyga ketyapman\nShe is happy | U xursand\nWe love IELTS | Biz IELTSni sevamiz"}
                className="w-full h-40 p-3 border rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 ring-blue-500 font-mono"
              />
              <button onClick={processBulkText} className="w-full bg-blue-100 text-blue-700 py-2 rounded-lg font-bold mt-2 hover:bg-blue-200">
                O'zgartirish va Qo'shish ⬇️
              </button>
            </div>
          )}

          <button onClick={saveLesson} disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition">
            {loading ? "Saqlanmoqda..." : "DARSNI SAQLASH ✅"}
          </button>
        </div>

        {/* Natijalar ro'yxati (O'ZGARMAGAN) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
          <h2 className="text-xl font-bold mb-4">Natijalar 📈</h2>
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-xs text-gray-400 uppercase">
                  <th className="p-2">O'quvchi</th>
                  <th className="p-2">Ball</th>
                  <th className="p-2 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-2">
                      <p className="font-bold text-sm">{r.studentName}</p>
                      <p className="text-[10px] text-gray-400">{r.lessonTitle}</p>
                    </td>
                    <td className="p-2 font-bold text-blue-600">{r.totalScore}</td>
                    <td className="p-2 text-right flex justify-end gap-2">
                      <button onClick={() => setSelectedResult(r)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200">👁️</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 p-2">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal oyna kodi (O'ZGARMAGAN) - joyni tejash uchun yozmadim, eski versiyada turibdi */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedResult.studentName}</h2>
                <p className="text-sm text-gray-500">{selectedResult.lessonTitle} • {selectedResult.totalScore} ball</p>
              </div>
              <button onClick={() => setSelectedResult(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
               {selectedResult.history?.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-gray-800 text-sm">#{idx + 1} {item.question}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.score === 5 ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{item.score}/5</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="bg-white p-2 rounded border border-gray-100">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">O'quvchi javobi:</span>
                        <span className={item.score < 5 ? "text-red-600 font-medium" : "text-gray-800 font-medium"}>{item.userAnswer}</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-gray-100">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Ustoz / To'g'ri:</span>
                        <span className="text-green-600 font-medium">{item.teacherTrans || "Kiritilmagan"}</span>
                      </div>
                    </div>
                    {item.feedback && <div className="mt-2 text-xs text-gray-500 italic border-t pt-2 border-gray-200">🤖 AI: {item.feedback}</div>}
                  </div>
                ))}
            </div>
            <div className="p-4 border-t bg-gray-50 text-right">
              <button onClick={() => setSelectedResult(null)} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-black transition">Yopish</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherAdmin;