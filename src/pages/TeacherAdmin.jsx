import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const TeacherAdmin = () => {
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => { fetchResults(); }, []);

  const fetchResults = async () => {
    const q = query(collection(db, "results"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const saveLesson = async () => {
    if (!title) return alert("Mavzu yozilmadi!");
    setLoading(true);
    try {
      await addDoc(collection(db, "assignments"), { title, sentences, createdAt: serverTimestamp() });
      alert("Dars saqlandi! ✅");
      setTitle(''); setSentences([{ original: '', translation: '' }]);
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

  const totalExams = results.length;
  const avgScore = results.length > 0 ? (results.reduce((a, b) => a + (b.totalScore || 0), 0) / results.length).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans relative">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-6xl mx-auto">
        <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg">
          <p className="opacity-80">Jami Testlar</p>
          <h2 className="text-3xl font-bold">{totalExams}</h2>
        </div>
        <div className="bg-green-500 text-white p-5 rounded-2xl shadow-lg">
          <p className="opacity-80">O'rtacha Ball</p>
          <h2 className="text-3xl font-bold">{avgScore}</h2>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-lg flex items-center justify-center">
           <button onClick={exportToExcel} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-green-700">📊 Excel</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Dars Yaratish */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-bold mb-4">Yangi Dars 📝</h2>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Mavzu..." className="w-full p-3 border rounded-xl mb-4 bg-gray-50 outline-none focus:ring-2 ring-blue-500"/>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 mb-4 custom-scrollbar">
            {sentences.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input placeholder="Inglizcha..." className="flex-1 p-2 border rounded-lg text-sm" value={s.original} 
                  onChange={e => {const n=[...sentences]; n[i].original=e.target.value; setSentences(n)}} />
                <input placeholder="O'zbekcha (To'g'ri javob)..." className="flex-1 p-2 border rounded-lg text-sm" value={s.translation} 
                  onChange={e => {const n=[...sentences]; n[i].translation=e.target.value; setSentences(n)}} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSentences([...sentences, {original:'', translation:''}])} className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg font-bold">+ Gap</button>
            <button onClick={saveLesson} disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">Saqlash</button>
          </div>
        </div>

        {/* Natijalar Jadvali */}
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
                      <button onClick={() => setSelectedResult(r)} className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200" title="Ko'rish">👁️</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600 p-2">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL - JAVOBLARNI KO'RISH */}
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
                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.score === 5 ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                        {item.score}/5
                      </span>
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
                    {item.feedback && (
                      <div className="mt-2 text-xs text-gray-500 italic border-t pt-2 border-gray-200">
                        🤖 AI: {item.feedback}
                      </div>
                    )}
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