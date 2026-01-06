import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx'; // Excel uchun

const TeacherAdmin = () => {
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Natijalarni yuklash
  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    const q = query(collection(db, "results"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  // Dars saqlash
  const saveLesson = async () => {
    if (!title) return alert("Mavzu yozilmadi!");
    setLoading(true);
    try {
      await addDoc(collection(db, "assignments"), { title, sentences, createdAt: serverTimestamp() });
      alert("Dars muvaffaqiyatli saqlandi! ✅");
      setTitle(''); 
      setSentences([{ original: '', translation: '' }]);
    } catch (e) {
      alert("Xatolik: " + e.message);
    }
    setLoading(false);
  };

  // Natijani o'chirish
  const handleDelete = async (id) => {
    if (window.confirm("Rostdan ham bu natijani o'chirmoqchimisiz?")) {
      await deleteDoc(doc(db, "results", id));
      fetchResults(); // Jadvalni yangilash
    }
  };

  // Excelga yuklash funksiyasi
  const exportToExcel = () => {
    const dataToExport = results.map(r => ({
      Ism: r.studentName,
      Mavzu: r.lessonTitle,
      Ball: r.totalScore,
      Maksimum: r.maxScore,
      Sana: r.date ? r.date.toDate().toLocaleDateString() : 'Noma\'lum',
      Vaqt: r.date ? r.date.toDate().toLocaleTimeString() : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Natijalar");
    XLSX.writeFile(workbook, "IELTS_Natijalar.xlsx");
  };

  // Kichik statistika hisoblash
  const totalExams = results.length;
  const averageScore = results.length > 0 
    ? (results.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) / results.length).toFixed(1) 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      
      {/* 1. Dashboard Statistikasi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 max-w-6xl mx-auto">
        <div className="bg-blue-600 text-white p-6 rounded-2xl shadow-lg">
          <p className="opacity-80">Jami Imtihonlar</p>
          <h2 className="text-4xl font-bold">{totalExams} ta</h2>
        </div>
        <div className="bg-green-500 text-white p-6 rounded-2xl shadow-lg">
          <p className="opacity-80">O'rtacha Ball</p>
          <h2 className="text-4xl font-bold">{averageScore} ball</h2>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center justify-center">
           <button 
             onClick={exportToExcel}
             className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
           >
             📊 Excelga Yuklash
           </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* 2. Yangi Dars Yaratish Formasi */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Yangi Dars Qo'shish 📝</h2>
          
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Dars mavzusi (masalan: Present Simple)" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-blue-500 transition-all"
            />
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {sentences.map((s, i) => (
                <div key={i} className="flex gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <span className="font-bold text-gray-400 text-sm w-6">{i+1}.</span>
                  <div className="flex-1 space-y-2">
                    <input 
                      placeholder="Inglizcha gap..." 
                      className="w-full p-2 bg-white border rounded-lg text-sm"
                      value={s.original} 
                      onChange={e => {
                        const newS = [...sentences]; newS[i].original = e.target.value; setSentences(newS);
                      }} 
                    />
                    <input 
                      placeholder="O'zbekcha tarjimasi (AI uchun)..." 
                      className="w-full p-2 bg-white border rounded-lg text-sm"
                      value={s.translation} 
                      onChange={e => {
                        const newS = [...sentences]; newS[i].translation = e.target.value; setSentences(newS);
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setSentences([...sentences, {original: '', translation: ''}])} 
                className="flex-1 py-3 rounded-xl font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                + Gap qo'shish
              </button>
              <button 
                onClick={saveLesson} 
                disabled={loading} 
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
              >
                {loading ? "Saqlanmoqda..." : "Saqlash ✅"}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Natijalar Jadvali */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col h-[600px]">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">So'nggi Natijalar 📈</h2>
          
          <div className="overflow-auto flex-1 pr-2 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b-2 border-gray-100 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-3">O'quvchi</th>
                  <th className="p-3">Mavzu</th>
                  <th className="p-3 text-center">Ball</th>
                  <th className="p-3 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="p-3">
                      <p className="font-bold text-gray-800">{r.studentName}</p>
                      <p className="text-xs text-gray-400">{r.date?.toDate().toLocaleDateString()}</p>
                    </td>
                    <td className="p-3 text-sm text-gray-600">{r.lessonTitle}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        (r.totalScore / r.maxScore) > 0.8 ? 'bg-green-100 text-green-700' : 
                        (r.totalScore / r.maxScore) > 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {r.totalScore}/{r.maxScore}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button 
                        onClick={() => handleDelete(r.id)}
                        className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all"
                        title="O'chirish"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center p-10 text-gray-400">Hali natijalar yo'q</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TeacherAdmin;