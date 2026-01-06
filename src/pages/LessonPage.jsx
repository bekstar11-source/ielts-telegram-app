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
  
  const [quizAnswers, setQuizAnswers] = useState([]); 
  const [isFinished, setIsFinished] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

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

  const handleSpeak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const handleNext = () => {
    const currentQuestion = lesson.sentences[currentIndex];
    
    const newAnswerObj = {
      question: currentQuestion.original,
      correctTranslation: currentQuestion.translation || "",
      userAnswer: userAnswer, 
    };

    const updatedAnswers = [...quizAnswers, newAnswerObj];
    setQuizAnswers(updatedAnswers);
    setUserAnswer(''); 

    if (currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitQuiz(updatedAnswers);
    }
  };

  // 🔥 YANGILANGAN SERVERGA YUBORISH FUNKSIYASI
  const submitQuiz = async (allAnswers) => {
    setIsChecking(true);
    
    try {
      console.log("Serverga yuborilmoqda...", allAnswers);

      const response = await fetch('[https://ielts-telegram-app.onrender.com/check-quiz](https://ielts-telegram-app.onrender.com/check-quiz)', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizData: allAnswers })
      });

      if (!response.ok) {
        throw new Error(`Server xatosi: ${response.status}`);
      }

      const aiResults = await response.json();
      console.log("Server javobi:", aiResults);

      // Agar server array qaytarmasa, xato beramiz
      if (!Array.isArray(aiResults)) {
        throw new Error("AI noto'g'ri formatda javob qaytardi.");
      }
      
      const fullHistory = allAnswers.map((item, index) => {
        // Agar AI bu savolga javob bermagan bo'lsa (xatolik bo'lsa)
        const result = aiResults.find(r => r.id === index) || { score: 0, feedback: "Tahlil qilinmadi" };
        return {
          ...item,
          score: result.score,
          feedback: result.feedback,
          teacherTrans: item.correctTranslation
        };
      });

      const totalScore = fullHistory.reduce((acc, curr) => acc + curr.score, 0);

      await addDoc(collection(db, "results"), {
        studentName: localStorage.getItem('studentName') || "Noma'lum",
        lessonTitle: lesson.title,
        totalScore: totalScore,
        maxScore: lesson.sentences.length * 5,
        history: fullHistory,
        date: serverTimestamp()
      });

      setFinalResults(fullHistory);
      setIsFinished(true);

    } catch (error) {
      console.error("Xatolik:", error);
      alert(`Xatolik yuz berdi: ${error.message}. Iltimos, qaytadan urinib ko'ring.`);
      // Xato bo'lsa bosh sahifaga otmaymiz, o'quvchi qayta "Yuborish" ni bosishi mumkin
      setIsChecking(false);
    }
  };

  if (!lesson) return <div className="text-center p-10">Yuklanmoqda...</div>;

  if (isChecking) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-5 text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-6"></div>
      <h2 className="text-xl font-bold text-gray-800">Natijalar tahlil qilinmoqda...</h2>
      <p className="text-gray-500 mt-2">Grammatika va so'z boyligi tekshirilyapti 📚</p>
      <p className="text-xs text-red-400 mt-4">(Bu 10-15 soniya vaqt olishi mumkin)</p>
    </div>
  );

  if (isFinished && finalResults) {
    const totalScore = finalResults.reduce((acc, curr) => acc + curr.score, 0);
    const maxScore = lesson.sentences.length * 5;

    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-10">
        <div className="bg-white p-6 rounded-3xl shadow-lg mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Imtihon Tugadi! 🎉</h1>
          <div className={`text-5xl font-extrabold my-4 ${totalScore/maxScore > 0.8 ? 'text-green-600' : 'text-blue-600'}`}>
            {totalScore} / {maxScore}
          </div>
          <button onClick={() => navigate('/')} className="mt-4 bg-gray-800 text-white px-6 py-3 rounded-xl font-bold">Bosh sahifa</button>
        </div>

        <div className="space-y-4">
          {finalResults.map((item, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800 text-sm">#{idx + 1} {item.question}</h3>
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${item.score === 5 ? 'bg-green-100 text-green-700' : item.score >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                  {item.score}/5
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className={`p-3 rounded-xl border ${item.score === 5 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Javobingiz:</span>
                  <span className="font-medium text-gray-900">{item.userAnswer || "(Javob yo'q)"}</span>
                </div>
                {item.score < 5 && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-[10px] uppercase font-bold opacity-60 block">To'g'ri javob (Namuna):</span>
                    <span className="font-medium text-blue-900">{item.teacherTrans}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-500 italic border-t pt-2">
                🤖 <b>AI Izohi:</b> {item.feedback}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / lesson.sentences.length) * 100;

  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => navigate('/')} className="text-[#2481cc] font-semibold text-sm">← Chiqish</button>
          <span className="text-xs font-bold text-gray-400 uppercase">Savol {currentIndex + 1} / {lesson.sentences.length}</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#2481cc] h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        <div className="bg-white p-5 rounded-2xl rounded-tl-none shadow-sm border border-blue-50 relative mt-2">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-[#2481cc] uppercase mb-2 tracking-wider">Tarjima qiling</p>
              <h2 className="text-xl font-semibold text-gray-800 leading-snug">"{lesson.sentences[currentIndex].original}"</h2>
            </div>
            <button 
              onClick={() => handleSpeak(lesson.sentences[currentIndex].original)} 
              className="bg-blue-50 text-blue-600 p-3 rounded-full hover:bg-blue-100 active:scale-90 transition-transform shadow-sm"
            >
              🔊
            </button>
          </div>
          <div className="absolute -left-2 top-0 w-0 h-0 border-t-[10px] border-t-white border-l-[10px] border-l-transparent"></div>
        </div>

        <div className="flex-1 flex flex-col gap-4">
           <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="w-full p-4 h-36 rounded-2xl border-none shadow-sm outline-none focus:ring-2 ring-[#2481cc]/50 transition-all bg-white text-lg resize-none placeholder-gray-300"
            placeholder="Javobingizni shu yerga yozing..."
            autoFocus
          />
          
          <button 
            onClick={handleNext} 
            className="w-full bg-[#2481cc] text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
          >
            {currentIndex < lesson.sentences.length - 1 ? "KEYINGI SAVOL →" : "YAKUNLASH VA TEKSHIRISH ✅"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonPage;