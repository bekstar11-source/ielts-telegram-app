import React, { useEffect, useState } from 'react';
import { db } from '../firebase'; // Bazani chaqiramiz
import { collection, getDocs, orderBy, query } from 'firebase/firestore'; // Bazadan o'qish buyruqlari
import { useNavigate } from 'react-router-dom'; // Sahifa almashish uchun

const StudentHome = () => {
  const [assignments, setAssignments] = useState([]); // Darslar ro'yxati
  const [loading, setLoading] = useState(true); // Yuklanish holati
  const navigate = useNavigate(); // Linkga o'tish "pulti"

  // 1. Sahifa ochilganda bazadan darslarni olib kelish
  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        // 'assignments' papkasidan darslarni sanasi bo'yicha (yangisi tepada) olib kelamiz
        const q = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        // Bazadan kelgan g'alati ma'lumotni chiroyli arrayga aylantiramiz
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setAssignments(data);
      } catch (error) {
        console.error("Xatolik:", error);
      } finally {
        setLoading(false); // Yuklash tugadi
      }
    };

    fetchAssignments();
  }, []);

  // 2. "Boshlash" bosilganda ishlaydigan funksiya
  const startLesson = (id) => {
    // Bu yerda biz darsning ID raqamini olib, LessonPage sahifasiga yuboramiz
    navigate('/lesson/' + id);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      {/* Tepa qism (Header) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm mb-6 flex justify-between items-center sticky top-2 z-10 border border-gray-100">
        <div>
          <h1 className="text-xl font-extrabold text-gray-800">Darslar 📚</h1>
          <p className="text-xs text-gray-500 font-medium">Bilimingizni oshiring</p>
        </div>
        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
          👤
        </div>
      </div>

      {/* Yuklanmoqda... */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-400 text-sm">Darslar yuklanmoqda...</p>
        </div>
      )}

      {/* Agar darslar bo'lmasa */}
      {!loading && assignments.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <p className="text-4xl mb-2">📭</p>
          <p className="text-gray-500 font-medium">Hozircha darslar yo'q</p>
          <p className="text-xs text-gray-400">Ustoz yangi dars qo'shishini kuting</p>
        </div>
      )}

      {/* Darslar ro'yxati */}
      <div className="space-y-4">
        {assignments.map((lesson) => (
          <div key={lesson.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition duration-200">
            
            {/* Dars Sarlavhasi */}
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-gray-800 leading-tight pr-2">
                {lesson.title}
              </h3>
              {/* Agar dars yangi bo'lsa (ixtiyoriy bezak) */}
              <span className="bg-blue-50 text-blue-600 text-[10px] uppercase px-2 py-1 rounded-lg font-extrabold tracking-wider">
                Yangi
              </span>
            </div>
            
            {/* Qo'shimcha ma'lumot */}
            <div className="flex items-center text-gray-500 text-sm mb-5 gap-4">
              <span className="flex items-center gap-1">
                📝 {lesson.sentences ? lesson.sentences.length : 0} ta gap
              </span>
              <span className="flex items-center gap-1">
                ⏱️ 5 daqiqa
              </span>
            </div>
            
            {/* Tugma */}
            <button 
              onClick={() => startLesson(lesson.id)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 active:shadow-none transition-all"
            >
              Boshlash
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StudentHome;