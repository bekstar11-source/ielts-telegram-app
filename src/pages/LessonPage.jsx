import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const LessonPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Holatlar (States)
  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  
  // AI va Natija holatlari
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [totalScore, setTotalScore] = useState(0);

  // 1. Darsni bazadan yuklash
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const docRef = doc(db, "assignments", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLesson(docSnap.data());
        } else {
          alert("Dars topilmadi!");
          navigate('/');
        }
      } catch (error) {
        console.error("Xato:", error);
      }
    };
    fetchLesson();
  }, [id, navigate]);

  // 2. Ovozli o'qish funksiyasi (British Accent) 🇬🇧 🔊
  const handleSpeak = () => {
    if (!lesson) return;
    const text = lesson.sentences[currentIndex].original;
    
    // Brauzerning o'zidagi nutq tizimini chaqiramiz
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Sozlamalar
    utterance.lang = 'en-GB'; // Britaniya inglizchasi
    utterance.rate = 0.85;    // O'qish tezligi (biroz sekinroq va tushunarli)
    utterance.pitch = 1;      // Ovoz toni

    window.speechSynthesis.speak(utterance);
  };

  // 3. AI ga yuborish
  const checkAnswer = async () => {
    if (!userAnswer.trim()) return;
    
    setIsChecking(true);
    try {
      const response = await fetch('https://ielts-telegram-app.onrender.com/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: lesson.sentences[currentIndex].original,
          userAnswer: userAnswer,
        })
      });

      if (!response.ok) {
        throw new Error("Serverdan xato javob keldi");
      }

      const data = await response.json();
      setAiFeedback(data);
      setTotalScore(prev => prev + (data.score || 0));

    } catch (error) {
      console.error("Server xatosi:", error);
      alert("AI serveri bilan bog'lanib bo'lmadi. Internetni tekshiring.");
    } finally {
      setIsChecking(false);
    }
  };

  // 4. Keyingi gapga o'tish yoki Darsni tugatish
  const nextSentence = async () => {
    // Ovoz o'qiyotgan bo'lsa to'xtatish
    window.speechSynthesis.cancel();

    if (currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAiFeedback(null);
      setUserAnswer('');
    } else {
      try {
        await addDoc(collection(db, "results"), {
          studentName: localStorage.getItem('studentName') || "Noma'lum O'quvchi",
          lessonTitle: lesson.title,
          totalScore: totalScore,
          maxScore: lesson.sentences.length * 5,
          date: serverTimestamp()
        });
        
        alert(`Tabriklaymiz! Dars tugadi 🎉\nSizning natijangiz: ${totalScore} ball`);
        navigate('/');
        
      } catch (e) {
        console.error("Saqlashda xato:", e);
        alert("Natijani saqlashda xatolik bo'ldi, lekin dars tugadi.");
        navigate('/');
      }
    }
  };

  if (!lesson) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5]">
      <div className="animate-pulse text-[#2481cc] font-bold text-lg">Dars yuklanmoqda...</div>
    </div>
  );

  const progress = ((currentIndex + 1) / lesson.sentences.length) * 100;

  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      
      {/* Header & Progress Bar */}
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => navigate('/')} className="text-[#2481cc] font-semibold text-sm flex items-center gap-1">
            ← Chiqish
          </button>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
            Mashq {currentIndex + 1} / {lesson.sentences.length}
          </span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-[#2481cc] h-full transition-all duration-500 ease-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        
        {/* Savol va Audio (Chat Bubble Style) */}
        <div className="bg-white p-5 rounded-2xl rounded-tl-none shadow-sm border border-blue-50 relative mt-2">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-[#2481cc] uppercase mb-2 tracking-wider">Tarjima qiling</p>
              <h2 className="text-xl font-semibold text-gray-800 leading-snug">
                "{lesson.sentences[currentIndex].original}"
              </h2>
            </div>
            
            {/* 🔊 OVOZ TUGMASI */}
            <button 
              onClick={handleSpeak}
              className="bg-blue-50 text-blue-600 p-3 rounded-full hover:bg-blue-100 active:scale-90 transition-transform shadow-sm flex-shrink-0"
              title="Eshitish (British Accent)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            </button>
          </div>

          <div className="absolute -left-2 top-0 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent"></div>
        </div>

        {/* Javob yozish maydoni */}
        <div className="flex-1 flex flex-col gap-4">
           <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={!!aiFeedback}
            className="w-full p-4 h-36 rounded-2xl border-none shadow-sm outline-none focus:ring-2 ring-[#2481cc]/50 transition-all bg-white text-lg resize-none placeholder-gray-300"
            placeholder="O'zbekcha tarjimasini kiriting..."
          />
          
          {!aiFeedback && (
            <button 
              onClick={checkAnswer} 
              disabled={isChecking || !userAnswer.trim()} 
              className="w-full bg-[#2481cc] text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-200 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
            >
              {isChecking ? "AI Tekshirmoqda... 🤖" : "TEKSHIRISH"}
            </button>
          )}
        </div>

        {/* AI Natijasi (Feedback) */}
        {aiFeedback && (
          <div className="space-y-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className={`p-5 rounded-2xl rounded-tr-none shadow-md relative ml-4 ${aiFeedback.score >= 4 ? 'bg-green-500' : 'bg-[#2481cc]'} text-white`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-3xl bg-white/20 w-10 h-10 flex items-center justify-center rounded-full">
                  {aiFeedback.score >= 4 ? '🌟' : aiFeedback.score >= 3 ? '👍' : '🧐'}
                </span>
                <span className="font-bold text-xl">Baho: {aiFeedback.score}/5</span>
              </div>
              
              <p className="text-white/90 leading-relaxed mb-4 text-sm font-medium">
                {aiFeedback.feedback}
              </p>
              
              <div className="bg-black/10 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] uppercase font-bold opacity-60 mb-1">To'g'ri javob:</p>
                <p className="font-medium text-white">{aiFeedback.correction}</p>
              </div>

               <div className={`absolute -right-2 top-0 w-0 h-0 border-t-[10px] border-t-${aiFeedback.score >= 4 ? 'green-500' : '[#2481cc]'} border-r-[10px] border-r-transparent`}></div>
            </div>

            <button 
              onClick={nextSentence} 
              className="w-full bg-white text-gray-800 border-2 border-gray-100 py-4 rounded-xl font-bold text-lg shadow-sm active:scale-95 transition-transform hover:bg-gray-50"
            >
              {currentIndex < lesson.sentences.length - 1 ? "KEYINGI GAP →" : "NATIJANI SAQLASH 🏁"}
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-gray-300 text-[10px] mt-auto">
        AI IELTS Teacher • Telegram App
      </div>
    </div>
  );
};

export default LessonPage;