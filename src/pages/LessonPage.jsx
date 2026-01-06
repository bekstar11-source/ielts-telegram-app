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
  const [errorMessage, setErrorMessage] = useState('');

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
    utterance.lang = /[a-zA-Z]/.test(text) ? 'en-GB' : 'uz-UZ'; 
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };

  const handleNext = () => {
    // 🔥 Ma'lumotni tayyorlash (Dars turiga qarab)
    let currentQ = "";
    let correctA = "";

    if (lesson.assignmentType === 'translation' || lesson.assignmentType === 'matching') {
        currentQ = lesson.sentences[currentIndex].original;
        correctA = lesson.sentences[currentIndex].translation;
    } else if (lesson.assignmentType === 'essay_task1' || lesson.assignmentType === 'essay_task2') {
        currentQ = lesson.essayPrompt;
        correctA = "AI Evaluated";
    } else if (lesson.assignmentType === 'gap_fill') {
        currentQ = lesson.gapFillText;
        correctA = "Gap Fill Answer";
    }

    const newAnswerObj = {
      question: currentQ,
      correctTranslation: correctA,
      userAnswer: userAnswer, 
    };

    const updatedAnswers = [...quizAnswers, newAnswerObj];
    setQuizAnswers(updatedAnswers);
    setUserAnswer(''); 

    // Essay va Gap Fill faqat 1 ta savoldan iborat bo'ladi
    const isSingleQuestion = lesson.assignmentType.includes('essay') || lesson.assignmentType === 'gap_fill';

    if (!isSingleQuestion && currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitQuiz(updatedAnswers);
    }
  };

  const submitQuiz = async (allAnswers) => {
    setIsChecking(true);
    setErrorMessage('');
    
    try {
      const response = await fetch('https://ielts-telegram-app.onrender.com/check-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            quizData: allAnswers,
            direction: lesson.direction || 'en-uz',
            assignmentType: lesson.assignmentType // 🔥 Turi yuborilmoqda
        })
      });

      if (!response.ok) throw new Error(`Server xatosi: ${response.status}`);
      const aiResults = await response.json();
      if (!Array.isArray(aiResults)) throw new Error("AI formati noto'g'ri.");
      
      const fullHistory = allAnswers.map((item, index) => {
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
        studentGroup: localStorage.getItem('groupName') || "Guruhsiz",
        lessonTitle: lesson.title,
        assignmentType: lesson.assignmentType,
        totalScore: totalScore,
        maxScore: lesson.assignmentType.includes('essay') ? 9 : (allAnswers.length * 5),
        history: fullHistory,
        date: serverTimestamp()
      });

      setFinalResults(fullHistory);
      setIsFinished(true);

    } catch (error) {
      console.error(error);
      setErrorMessage(`Xatolik: ${error.message}`);
      setIsFinished(true); // Xato bo'lsa ham ko'rsatish
    } finally {
      setIsChecking(false);
    }
  };

  if (!lesson) return <div className="text-center p-10">Yuklanmoqda...</div>;

  // --- RENDER CURRENT QUESTION ---
  const renderContent = () => {
    // 1. WRITING TASK 1
    if (lesson.assignmentType === 'essay_task1') {
        return (
            <div className="space-y-4">
                {lesson.imageUrl && (
                    <img src={lesson.imageUrl} alt="Task 1" className="w-full rounded-xl shadow-md border"/>
                )}
                <div className="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500">
                    <h3 className="font-bold text-blue-800">Task 1 Prompt:</h3>
                    <p className="text-sm">{lesson.essayPrompt}</p>
                </div>
                <textarea 
                    className="w-full h-80 p-4 rounded-xl border focus:ring-2 ring-blue-500" 
                    placeholder="Write your report (min 150 words)..."
                    value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
                />
            </div>
        )
    }
    // 2. WRITING TASK 2
    if (lesson.assignmentType === 'essay_task2') {
        return (
            <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-xl border-l-4 border-purple-500">
                    <h3 className="font-bold text-purple-800">Task 2 Essay Question:</h3>
                    <p className="text-sm">{lesson.essayPrompt}</p>
                </div>
                <textarea 
                    className="w-full h-96 p-4 rounded-xl border focus:ring-2 ring-purple-500" 
                    placeholder="Write your essay (min 250 words)..."
                    value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
                />
            </div>
        )
    }
    // 3. GAP FILL
    if (lesson.assignmentType === 'gap_fill') {
        return (
            <div className="space-y-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border text-lg leading-loose">
                    {/* Oddiy ko'rinishda matnni chiqaramiz, o'quvchi to'liq javob yozadi */}
                    {lesson.gapFillText}
                </div>
                <p className="text-xs text-gray-500">Matnni to'liq ko'chirib, [gap] o'rniga to'g'ri so'zni qo'yib yozing:</p>
                <textarea 
                    className="w-full h-40 p-4 rounded-xl border focus:ring-2 ring-blue-500" 
                    placeholder="To'liq javob..."
                    value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
                />
            </div>
        )
    }

    // 4. TRANSLATION / MATCHING
    const q = lesson.sentences[currentIndex];
    return (
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">"{q.original}"</h2>
                <button onClick={() => handleSpeak(q.original)} className="text-2xl">🔊</button>
            </div>
            <textarea 
                className="w-full h-40 p-4 rounded-xl border focus:ring-2 ring-blue-500"
                placeholder={lesson.assignmentType === 'matching' ? "Mosini yozing..." : "Tarjima qiling..."}
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
            />
        </div>
    );
  };

  // LOADING SCREEN
  if (isChecking) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-5 text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-6"></div>
      <h2 className="text-xl font-bold text-gray-800">IELTS Examiner Tekshiryapti...</h2>
      <p className="text-gray-500 mt-2">Bu 10-20 soniya vaqt olishi mumkin ⏳</p>
    </div>
  );

  // RESULT SCREEN
  if (isFinished && finalResults) {
    const totalScore = finalResults.reduce((acc, curr) => acc + curr.score, 0);
    const isEssay = lesson.assignmentType.includes('essay');

    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-10">
        <div className="bg-white p-6 rounded-3xl shadow-lg mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Natija</h1>
          <div className="text-5xl font-extrabold my-4 text-blue-600">
            {isEssay ? totalScore : totalScore} {isEssay ? "/ 9.0" : "ball"}
          </div>
          <button onClick={() => navigate('/')} className="mt-4 bg-gray-800 text-white px-6 py-3 rounded-xl font-bold">Bosh sahifa</button>
        </div>

        <div className="space-y-4">
          {finalResults.map((item, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-2">Tahlil:</h3>
              
              <div className="bg-blue-50 p-3 rounded-xl text-sm mb-3 whitespace-pre-wrap">
                  <span className="font-bold text-blue-800 block mb-1">Sizning Javobingiz:</span>
                  {item.userAnswer}
              </div>

              <div className="text-sm bg-yellow-50 p-4 rounded-xl border-l-4 border-yellow-400 whitespace-pre-wrap">
                <span className="font-bold text-yellow-800 block mb-2">🤖 AI Examiner Feedback:</span>
                {item.feedback}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // QUESTION SCREEN
  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b border-gray-200 flex justify-between items-center">
         <button onClick={() => navigate('/')} className="text-blue-600 font-bold">← Chiqish</button>
         <span className="font-bold text-gray-500 text-xs uppercase">{lesson.assignmentType.replace('_', ' ')}</span>
      </div>

      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        {renderContent()}
        
        <button 
            onClick={handleNext} 
            className="w-full bg-[#2481cc] text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
        >
            {lesson.assignmentType.includes('essay') || lesson.assignmentType === 'gap_fill' || currentIndex >= lesson.sentences?.length - 1 
                ? "YAKUNLASH VA TEKSHIRISH ✅" 
                : "KEYINGI SAVOL →"}
        </button>
      </div>
    </div>
  );
};

export default LessonPage;