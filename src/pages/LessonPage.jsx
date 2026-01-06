import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const LessonPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Holatlar (States)
  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  
  // AI javobi uchun holatlar
  const [aiFeedback, setAiFeedback] = useState(null); // AI bahosi
  const [isChecking, setIsChecking] = useState(false); // Tekshirish jarayoni
  const [loading, setLoading] = useState(true); // Dars yuklanishi

  // 1. Darsni bazadan yuklash
  useEffect(() => {
    const fetchLesson = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "assignments", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLesson(docSnap.data());
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error("Xato:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [id, navigate]);

  // 2. AI ga yuborish (Eng muhim qism)
  const checkAnswer = async () => {
    if (!userAnswer.trim()) return alert("Iltimos, tarjimani yozing!");
    
    setIsChecking(true);
    try {
      // Bizning serverga so'rov yuboramiz
      const response = await fetch('https://ielts-telegram-app.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: lesson.sentences[currentIndex].original,
          userAnswer: userAnswer,
        })
      });

      const data = await response.json();
      setAiFeedback(data); // AI javobini saqlab qo'yamiz

    } catch (error) {
      console.error("Server xatosi:", error);
      alert("AI ishlamay qoldi. Server yoqilganmi?");
    }
    setIsChecking(false);
  };

  // 3. Keyingi gapga o'tish
  const nextSentence = () => {
    setAiFeedback(null); // Eski bahoni tozalash
    setUserAnswer(''); // Inputni tozalash
    
    if (currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert("Tabriklaymiz! Dars tugadi 🎉");
      navigate('/');
    }
  };

  if (loading) return <div className="text-center p-10">Yuklanmoqda...</div>;
  if (!lesson) return null;

  const currentSentence = lesson.sentences[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-10">
      {/* Progress Bar */}
      <div className="bg-white p-4 shadow-sm flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-500 font-bold">←</button>
        <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${((currentIndex) / lesson.sentences.length) * 100}%` }}
          ></div>
        </div>
        <span className="text-sm font-bold text-gray-500">
          {currentIndex + 1}/{lesson.sentences.length}
        </span>
      </div>

      {/* Savol qismi */}
      <div className="flex-1 p-6 max-w-lg mx-auto w-full">
        <div className="text-center mb-8">
          <p className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-2">Ingliz tilidan tarjima qiling</p>
          <h2 className="text-2xl font-bold text-gray-800">"{currentSentence.original}"</h2>
        </div>

        {/* Javob yozish joyi */}
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Tarjimani yozing..."
          disabled={!!aiFeedback} // Agar tekshirib bo'lingan bo'lsa, yozib bo'lmaydi
          className="w-full p-4 mb-6 outline-none resize-none text-lg text-gray-800 h-32 rounded-xl border-2 border-blue-100 focus:border-blue-500"
        />

        {/* AI Natijasi (Bu faqat tekshirgandan keyin chiqadi) */}
        {aiFeedback && (
          <div className={`p-5 rounded-xl mb-6 ${aiFeedback.score >= 4 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-lg">
                Baho: {aiFeedback.score}/5 {aiFeedback.score >= 4 ? '🌟' : '🤔'}
              </span>
            </div>
            
            <p className="text-gray-700 mb-2">
              <strong>Izoh:</strong> {aiFeedback.feedback}
            </p>
            
            {aiFeedback.correction && (
              <div className="bg-white p-3 rounded-lg border border-gray-200 mt-2">
                <p className="text-xs text-gray-500 font-bold uppercase">To'g'ri javob:</p>
                <p className="text-gray-800 font-medium">{aiFeedback.correction}</p>
              </div>
            )}
          </div>
        )}

        {/* Tugmalar */}
        {!aiFeedback ? (
          <button 
            onClick={checkAnswer}
            disabled={isChecking}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition disabled:opacity-50"
          >
            {isChecking ? "AI Tekshirmoqda... 🤖" : "TEKSHIRISH"}
          </button>
        ) : (
          <button 
            onClick={nextSentence}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition"
          >
            KEYINGI GAP →
          </button>
        )}
      </div>
    </div>
  );
};

export default LessonPage;