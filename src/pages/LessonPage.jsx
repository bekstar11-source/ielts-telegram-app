import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const LessonPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  // 🔥 YANGI: Tarixni saqlash uchun
  const [history, setHistory] = useState([]);
  const [isSaving, setIsSaving] = useState(false); // Yakuniy yuklash holati

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const docRef = doc(db, "assignments", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setLesson(docSnap.data());
        else navigate('/');
      } catch (error) { console.error(error); }
    };
    fetchLesson();
  }, [id, navigate]);

  const handleSpeak = () => {
    if (!lesson) return;
    const utterance = new SpeechSynthesisUtterance(lesson.sentences[currentIndex].original);
    utterance.lang = 'en-GB';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const checkAnswer = async () => {
    const text = userAnswer.trim();
    if (!text || text.split(/\s+/).length < 3) {
      alert("⚠️ Javob juda qisqa (kamida 3 ta so'z yozing)!");
      return;
    }
    
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

      const data = await response.json();
      setAiFeedback(data);
      setTotalScore(prev => prev + (data.score || 0));

      // 🔥 TARIXGA YOZISH (Faqat muhim joylarini)
      setHistory(prev => [...prev, {
        question: lesson.sentences[currentIndex].original,
        userAnswer: userAnswer,
        score: data.score,
        mistake: data.score < 5 ? data.feedback : "To'g'ri" // Agar 5 bo'lsa xato yo'q
      }]);

    } catch (error) {
      alert("AI ishlamadi. Internetni tekshiring.");
    } finally {
      setIsChecking(false);
    }
  };

  // 🔥 Darsni tugatish va Xulosa yasash
  const finishLesson = async () => {
    setIsSaving(true);
    let summaryText = "Xulosa mavjud emas";

    try {
      // 1. Serverdan xulosa so'rash
      const summaryRes = await fetch('https://ielts-telegram-app.onrender.com/create-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history })
      });
      const summaryData = await summaryRes.json();
      summaryText = summaryData.summary;

      // 2. Hammasini Firebasega saqlash
      await addDoc(collection(db, "results"), {
        studentName: localStorage.getItem('studentName') || "Noma'lum",
        lessonTitle: lesson.title,
        totalScore: totalScore,
        maxScore: lesson.sentences.length * 5,
        history: history,    // Hamma javoblar
        aiSummary: summaryText, // AI xulosasi
        date: serverTimestamp()
      });

      alert(`Dars tugadi! 🎉\nO'qituvchi uchun xulosa yuborildi.`);
      navigate('/');

    } catch (e) {
      console.error(e);
      alert("Saqlashda xato bo'ldi, lekin davom etavering.");
      navigate('/');
    }
  };

  const nextSentence = () => {
    window.speechSynthesis.cancel();
    setShowExplanation(false);

    if (currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAiFeedback(null);
      setUserAnswer('');
    } else {
      finishLesson(); // Dars tugash funksiyasini chaqirish
    }
  };

  if (!lesson) return <div className="text-center p-10">Yuklanmoqda...</div>;
  if (isSaving) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-5 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <h2 className="text-xl font-bold text-gray-800">Natijalar tahlil qilinmoqda...</h2>
      <p className="text-gray-500 text-sm mt-2">AI o'qituvchiga hisobot tayyorlayapti 📝</p>
    </div>
  );

  const progress = ((currentIndex + 1) / lesson.sentences.length) * 100;

  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      {/* Header */}
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => navigate('/')} className="text-[#2481cc] font-semibold text-sm">← Chiqish</button>
          <span className="text-xs font-bold text-gray-400 uppercase">Mashq {currentIndex + 1} / {lesson.sentences.length}</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#2481cc] h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        {/* Savol */}
        <div className="bg-white p-5 rounded-2xl rounded-tl-none shadow-sm border border-blue-50 relative mt-2">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-[#2481cc] uppercase mb-2 tracking-wider">Tarjima qiling</p>
              <h2 className="text-xl font-semibold text-gray-800 leading-snug">"{lesson.sentences[currentIndex].original}"</h2>
            </div>
            <button onClick={handleSpeak} className="bg-blue-50 text-blue-600 p-3 rounded-full hover:bg-blue-100 active:scale-90 transition-transform shadow-sm">🔊</button>
          </div>
          <div className="absolute -left-2 top-0 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent"></div>
        </div>

        {/* Input */}
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
              className="w-full bg-[#2481cc] text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
            >
              {isChecking ? "Tekshirilmoqda... ⏳" : "TEKSHIRISH"}
            </button>
          )}
        </div>

        {/* Feedback */}
        {aiFeedback && (
          <div className="space-y-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
            <div className={`p-5 rounded-2xl rounded-tr-none shadow-md relative ml-4 ${aiFeedback.score >= 4 ? 'bg-green-500' : 'bg-[#2481cc]'} text-white`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-3xl bg-white/20 w-10 h-10 flex items-center justify-center rounded-full">
                  {aiFeedback.score >= 4 ? '🌟' : aiFeedback.score >= 3 ? '👍' : '🧐'}
                </span>
                <span className="font-bold text-xl">Baho: {aiFeedback.score}/5</span>
              </div>
              
              <div className="bg-black/10 p-3 rounded-xl border border-white/10 mb-3">
                <p className="text-[10px] uppercase font-bold opacity-60 mb-1">To'g'ri javob:</p>
                <p className="font-medium text-white">{aiFeedback.correction}</p>
              </div>

              {!showExplanation ? (
                <button 
                  onClick={() => setShowExplanation(true)}
                  className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  ❓ Nega xato qildim?
                </button>
              ) : (
                <div className="bg-white/10 p-3 rounded-xl mt-3 animate-in fade-in">
                  <p className="text-[10px] uppercase font-bold opacity-60 mb-1">AI Izohi:</p>
                  <p className="text-sm font-medium leading-relaxed">{aiFeedback.feedback}</p>
                </div>
              )}
               <div className={`absolute -right-2 top-0 w-0 h-0 border-t-[10px] border-t-${aiFeedback.score >= 4 ? 'green-500' : '[#2481cc]'} border-r-[10px] border-r-transparent`}></div>
            </div>

            <button 
              onClick={nextSentence} 
              className="w-full bg-white text-gray-800 border-2 border-gray-100 py-4 rounded-xl font-bold text-lg shadow-sm active:scale-95 transition-transform hover:bg-gray-50"
            >
              {currentIndex < lesson.sentences.length - 1 ? "KEYINGI GAP →" : "NATIJANI YUKLASH 🏁"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonPage;