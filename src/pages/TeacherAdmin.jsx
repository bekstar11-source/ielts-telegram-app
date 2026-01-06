import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';

const TeacherAdmin = () => {
  const [title, setTitle] = useState('');
  const [sentences, setSentences] = useState([{ original: '', translation: '' }]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      const q = query(collection(db, "results"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchResults();
  }, []);

  const saveLesson = async () => {
    if (!title) return alert("Nom yozing");
    setLoading(true);
    await addDoc(collection(db, "assignments"), { title, sentences, createdAt: serverTimestamp() });
    alert("Saqlandi!");
    setTitle(''); setSentences([{ original: '', translation: '' }]);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10 space-y-10">
      {/* 1. Dars Yaratish */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="text-2xl font-bold mb-6">Yangi Dars Qo'shish 📝</h2>
        <input 
          type="text" placeholder="Dars mavzusi" value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full p-3 border rounded-xl mb-4 outline-none focus:ring-2 ring-blue-500"
        />
        {sentences.map((s, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input placeholder="English" className="flex-1 p-2 border rounded-lg" value={s.original} onChange={e => {
              const newS = [...sentences]; newS[i].original = e.target.value; setSentences(newS);
            }} />
            <input placeholder="Uzbek" className="flex-1 p-2 border rounded-lg" value={s.translation} onChange={e => {
              const newS = [...sentences]; newS[i].translation = e.target.value; setSentences(newS);
            }} />
          </div>
        ))}
        <button onClick={() => setSentences([...sentences, {original: '', translation: ''}])} className="text-blue-500 font-bold mr-4">+ Gap qo'shish</button>
        <button onClick={saveLesson} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold">Saqlash</button>
      </div>

      {/* 2. Natijalar Jadvali */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="text-2xl font-bold mb-6">O'quvchilar Natijalari 📈</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="p-3">O'quvchi</th>
                <th className="p-3">Dars</th>
                <th className="p-3">Ball</th>
                <th className="p-3">Sana</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} className="border-b text-sm">
                  <td className="p-3 font-medium">{r.studentName}</td>
                  <td className="p-3 text-gray-500">{r.lessonTitle}</td>
                  <td className="p-3 font-bold text-blue-600">{r.totalScore}/{r.maxScore}</td>
                  <td className="p-3 text-gray-400">{r.date?.toDate().toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherAdmin;