import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const TeacherAdmin = () => {
  // Formalar uchun holatlar (State)
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  
  // Gaplar ro'yxati (boshlanishiga 1 ta bo'sh gap turadi)
  const [sentences, setSentences] = useState([
    { original: '', translation: '' }
  ]);

  // Yangi bo'sh qator qo'shish
  const addSentenceField = () => {
    setSentences([...sentences, { original: '', translation: '' }]);
  };

  // Yozilayotgan gaplarni o'zgartirish
  const handleSentenceChange = (index, field, value) => {
    const newSentences = [...sentences];
    newSentences[index][field] = value;
    setSentences(newSentences);
  };

  // Bazaga saqlash
  const saveLesson = async () => {
    if (!title.trim()) return alert("Mavzu nomini yozing!");
    
    setLoading(true);
    try {
      // 1. Bazaning 'assignments' kolleksiyasiga yozamiz
      await addDoc(collection(db, "assignments"), {
        title: title,
        sentences: sentences,
        createdAt: serverTimestamp(), // Qachon yaratilgani vaqti
        isActive: true
      });

      // 2. Muvaffaqiyatli bo'lsa tozalaymiz
      alert("✅ Dars muvaffaqiyatli saqlandi!");
      setTitle('');
      setSentences([{ original: '', translation: '' }]);
    } catch (error) {
      console.error("Xatolik:", error);
      alert("❌ Saqlashda xatolik: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Yangi Dars Yaratish 📝</h1>

        {/* Mavzu nomi */}
        <div className="mb-6">
          <label className="block text-gray-700 font-bold mb-2">Mavzu nomi</label>
          <input 
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Masalan: Present Simple - Kun tartibi"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Gaplar ro'yxati */}
        <div className="space-y-4 mb-6">
          <label className="block text-gray-700 font-bold">Gaplar va Tarjimalar</label>
          
          {sentences.map((item, index) => (
            <div key={index} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg">
              <span className="mt-3 font-bold text-gray-400">{index + 1}.</span>
              
              <div className="flex-1 space-y-2">
                <input 
                  type="text"
                  placeholder="Inglizcha (Original)"
                  value={item.original}
                  onChange={(e) => handleSentenceChange(index, 'original', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
                <input 
                  type="text"
                  placeholder="O'zbekcha (To'g'ri javob)"
                  value={item.translation}
                  onChange={(e) => handleSentenceChange(index, 'translation', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded focus:border-green-500 outline-none bg-green-50"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Tugmalar */}
        <div className="flex gap-4">
          <button 
            onClick={addSentenceField}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
          >
            + Yana gap qo'shish
          </button>

          <button 
            onClick={saveLesson}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-lg transition transform active:scale-95"
          >
            {loading ? "Saqlanmoqda..." : "💾 BAZAGA SAQLASH"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default TeacherAdmin;