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
  
  // 🔥 YANGI STATELAR
  const [quizAnswers, setQuizAnswers] = useState([]); // O'quvchining yig'ilgan javoblari
  const [isFinished, setIsFinished] = useState(false); // Test tugadimi?
  const [finalResults, setFinalResults] = useState(null); // Serverdan kelgan natijalar
  const [isChecking, setIsChecking] = useState(false); // Yuklanmoqda...

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

  // 1. KEYINGI GAPGA O'TISH (Javobni eslab qolish)
  const handleNext = () => {
    const currentQuestion = lesson.sentences[currentIndex];
    
    // Javobni saqlab qo'yamiz
    const newAnswerObj = {
      question: currentQuestion.original,
      correctTranslation: currentQuestion.translation || "",
      userAnswer: userAnswer, // Bo'sh bo'lsa ham saqlaymiz
    };

    const updatedAnswers = [...quizAnswers, newAnswerObj];
    setQuizAnswers(updatedAnswers);
    setUserAnswer(''); // Inputni tozalash

    // Agar savollar tugamagan bo'lsa, keyingisiga o'tamiz
    if (currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Agar tugagan bo'lsa, serverga yuborish bosqichiga o'tamiz
      submitQuiz(updatedAnswers);
    }
  };

  // 2. SERVERGA YUBORISH VA TEKSHIRISH
  const submitQuiz = async (allAnswers) => {
    setIsChecking(true);
    
    try {
      // Serverga barcha javoblarni yuboramiz
      const response = await fetch('https://ielts-telegram-app.onrender.com/check-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizData: allAnswers })
      });

      const aiResults = await response.json();
      
      // AI natijalarini bizdagi ma'lumotlar bilan birlashtiramiz
      const fullHistory = allAnswers.map((item, index) => ({
        ...item,
        score: aiResults[index]?.score || 0,
        feedback: aiResults[index]?.feedback || "Izoh yo'q",
        teacherTrans: item.correctTranslation // Admin panel uchun
      }));

      // Umumiy ballni hisoblash
      const totalScore = fullHistory.reduce((acc, curr) => acc + curr.score, 0);

      // Firebasega saqlash
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
      console.error(error);
      alert("Natijalarni olishda xatolik bo'ldi.");
      navigate('/');
    } finally {
      setIsChecking(false);
    }
  };

  if (!lesson) return <div className="text-center p-10">Yuklanmoqda...</div>;

  // 3. YUKLANISH EKRANI
  if (isChecking) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-6"></div>
      <h2 className="text-xl font-bold text-gray-800">Natijalar tahlil qilinmoqda...</h2>
      <p className="text-gray-500">AI barcha javoblaringizni tekshiryapti 🧠</p>
    </div>
  );

  // 4. NATIJALAR EKRANI (REPORT CARD)
  if (isFinished && finalResults) {
    const totalScore = finalResults.reduce((acc, curr) => acc + curr.score, 0);
    const maxScore = lesson.sentences.length * 5;

    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-10">
        <div className="bg-white p-6 rounded-3xl shadow-lg mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Imtihon Tugadi! 🎉</h1>
          <div className="text-5xl font-extrabold text-[#2481cc] my-4">{totalScore} / {maxScore}</div>
          <p className="text-gray-500">Sizning umumiy natijangiz</p>
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
                  <span className="text-[10px] uppercase font-bold opacity-60 block">Sizning javobingiz:</span>
                  <span className="font-medium text-gray-900">{item.userAnswer || "(Javob yo'q)"}</span>
                </div>
                {item.score < 5 && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="text-[10px] uppercase font-bold opacity-60 block">To'g'ri javob:</span>
                    <span className="font-medium text-blue-900">{item.teacherTrans}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-500 italic border-t pt-2">
                💡 AI: {item.feedback}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 5. SAVOL BERISH EKRANI (IMTIHON JARAYONI)
  const progress = ((currentIndex + 1) / lesson.sentences.length) * 100;

  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      {/* Header */}
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <button onClick={() => navigate('/')} className="text-[#2481cc] font-semibold text-sm">← Bekor qilish</button>
          <span className="text-xs font-bold text-gray-400 uppercase">Savol {currentIndex + 1} / {lesson.sentences.length}</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#2481cc] h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        {/* Savol Kartochkasi */}
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

        {/* Javob yozish */}
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