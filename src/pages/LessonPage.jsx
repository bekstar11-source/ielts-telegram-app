import React, { useEffect, useState, useRef } from 'react';
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

  // --- DICTATION STATES ---
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState(null); 
  const [attempts, setAttempts] = useState(0); 
  const [hints, setHints] = useState([]); 

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const docRef = doc(db, "assignments", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setLesson(data);
            // 🔥 HINTLARNI YUKLASH (Admin kiritgan)
            if (data.assignmentType === 'dictation' && data.customHints) {
                setHints(data.customHints);
            }
        } else navigate('/');
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

  const playSegment = () => {
    if (!lesson || !audioRef.current) return;
    const segment = lesson.segments[currentIndex];
    audioRef.current.currentTime = segment.start;
    audioRef.current.play();
    setIsPlaying(true);
    const checkTime = () => {
        if (audioRef.current.currentTime >= segment.end) {
            audioRef.current.pause();
            setIsPlaying(false);
            audioRef.current.removeEventListener('timeupdate', checkTime);
        }
    };
    audioRef.current.addEventListener('timeupdate', checkTime);
  };

  const changeSegment = (direction) => {
      const newIndex = currentIndex + direction;
      if (newIndex >= 0 && newIndex < lesson.segments.length) {
          setCurrentIndex(newIndex);
          setUserAnswer('');
          setFeedback(null);
          setAttempts(0);
      }
  };

  // 🔥 QATTIQQO'L TEKSHIRISH (Xato + To'g'ri variant)
  const checkStrictDictation = () => {
      const segment = lesson.segments[currentIndex];
      const cleanOriginal = segment.text.trim().split(/\s+/); 
      const cleanUser = userAnswer.trim().split(/\s+/); 

      let isPerfect = true;
      let correctWordsHtml = [];

      for (let i = 0; i < cleanOriginal.length; i++) {
          const originalWordClean = cleanOriginal[i].replace(/[.,!?;:]/g, '').toLowerCase(); 
          const userWordRaw = cleanUser[i] || ""; 
          const userWordClean = userWordRaw.replace(/[.,!?;:]/g, '').toLowerCase();

          if (userWordClean === originalWordClean) {
              // ✅ To'g'ri so'z (Yashil)
              correctWordsHtml.push(<span key={i} className="text-green-600 font-bold mx-1">{cleanOriginal[i]}</span>);
          } else {
              // ❌ Xato topildi!
              isPerfect = false;
              setAttempts(prev => prev + 1);
              
              // Xatoni ko'rsatish: Xato (Qizil) + [To'g'ri] (Yashil)
              const errorDisplay = (
                  <span key={i} className="mx-1 inline-block">
                      <span className="text-red-500 line-through decoration-2 mr-1">{userWordRaw || "..."}</span>
                      <span className="text-green-700 bg-green-100 px-1 rounded font-bold">[{cleanOriginal[i]}]</span>
                  </span>
              );
              correctWordsHtml.push(errorDisplay);
              
              break; // 🛑 Faqat birinchi xatoni ko'rsatamiz va to'xtaymiz
          }
      }

      if (isPerfect && cleanUser.length === cleanOriginal.length) {
          setFeedback({ html: <div className="text-green-600 font-bold">Mukammal! 🎉</div>, isCorrect: true });
      } else {
          setFeedback({
              html: (
                  <div>
                      {correctWordsHtml}
                      <p className="text-xs text-red-500 mt-2 font-bold">Xatoni ko'rib, qayta yozing!</p>
                  </div>
              ),
              isCorrect: false
          });
      }
  };

  const handleSaveAndNext = () => {
      const segment = lesson.segments[currentIndex];
      let score = 5 - attempts;
      if (score < 0) score = 0;

      const resultObj = {
          question: `Segment #${currentIndex + 1}`,
          correctTranslation: segment.text,
          userAnswer: userAnswer,
          score: score,
          feedback: `Urinishlar: ${attempts + 1}`
      };

      const newAnswers = [...quizAnswers, resultObj];
      setQuizAnswers(newAnswers);

      if (currentIndex < lesson.segments.length - 1) {
          changeSegment(1);
      } else {
          finishLesson(newAnswers);
      }
  };

  const finishLesson = async (finalAnswers) => {
      setIsChecking(true);
      try {
          const totalScore = finalAnswers.reduce((a, b) => a + b.score, 0);
          const maxScore = lesson.segments.length * 5;
          await addDoc(collection(db, "results"), {
            studentName: localStorage.getItem('studentName') || "Noma'lum",
            studentGroup: localStorage.getItem('groupName'),
            lessonTitle: lesson.title,
            assignmentType: 'dictation',
            totalScore: totalScore,
            maxScore: maxScore,
            history: finalAnswers,
            date: serverTimestamp()
          });
          setFinalResults(finalAnswers);
          setIsFinished(true);
      } catch (e) { alert("Xato"); }
      finally { setIsChecking(false); }
  };

  // --- ODDY TESTLARNI SERVERGA YUBORISH ---
  const handleNext = () => {
    // 1. Agar Dictation bo'lsa va hali tekshirilmagan bo'lsa
    // Bu qism yuqoridagi 'handleSaveAndNext' orqali boshqariladi
    
    // 2. Oddiy testlar uchun
    if (lesson.assignmentType !== 'dictation') {
        let currentQ = "";
        let correctA = "";
        if (lesson.assignmentType === 'translation' || lesson.assignmentType === 'matching') {
            currentQ = lesson.sentences[currentIndex].original;
            correctA = lesson.sentences[currentIndex].translation;
        } else if (lesson.assignmentType.includes('essay')) {
            currentQ = lesson.essayPrompt;
            correctA = "AI Evaluated";
        } else if (lesson.assignmentType === 'gap_fill') {
            currentQ = lesson.gapFillText;
            correctA = "Gap Fill";
        }

        const newAnswerObj = {
            question: currentQ,
            correctTranslation: correctA,
            userAnswer: userAnswer, 
        };
        const updatedAnswers = [...quizAnswers, newAnswerObj];
        setQuizAnswers(updatedAnswers);
        
        setUserAnswer('');
        setFeedback(null);

        const isSingleQ = lesson.assignmentType.includes('essay') || lesson.assignmentType === 'gap_fill';
        const maxIndex = lesson.sentences?.length - 1;

        if (!isSingleQ && currentIndex < maxIndex) {
            setCurrentIndex(currentIndex + 1);
        } else {
            submitQuiz(updatedAnswers); // Oxirgisini yuborish
        }
    }
  };

  const submitQuiz = async (allAnswers) => {
    setIsChecking(true);
    try {
      const response = await fetch('https://ielts-telegram-app.onrender.com/check-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            quizData: allAnswers,
            direction: lesson.direction || 'en-uz',
            assignmentType: lesson.assignmentType 
        })
      });

      if (!response.ok) throw new Error("Server xatosi");
      const aiResults = await response.json();
      
      const fullHistory = allAnswers.map((item, index) => {
        const result = aiResults.find(r => r.id === index) || { score: 0, feedback: "Tahlil qilinmadi" };
        return { ...item, score: result.score, feedback: result.feedback };
      });

      const totalScore = fullHistory.reduce((acc, curr) => acc + curr.score, 0);
      
      await addDoc(collection(db, "results"), {
        studentName: localStorage.getItem('studentName'),
        studentGroup: localStorage.getItem('groupName'),
        lessonTitle: lesson.title,
        assignmentType: lesson.assignmentType,
        totalScore: totalScore,
        maxScore: lesson.assignmentType.includes('essay') ? 9 : (fullHistory.length * 5),
        history: fullHistory,
        date: serverTimestamp()
      });

      setFinalResults(fullHistory);
      setIsFinished(true);
    } catch (error) { setIsFinished(true); } 
    finally { setIsChecking(false); }
  };

  const renderContent = () => {
    if (lesson.assignmentType === 'dictation') {
        return (
            <div className="space-y-4">
                <audio ref={audioRef} src={lesson.audioUrl} preload="auto" />
                
                {/* 🔥 HINTLARNI KO'RSATISH (Admin kiritgan) */}
                {hints.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                        {hints.map((h, i) => (
                            <span key={i} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold border border-yellow-200">
                                💡 {h}
                            </span>
                        ))}
                    </div>
                )}

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex items-center justify-between">
                    <button onClick={() => changeSegment(-1)} disabled={currentIndex === 0} className="p-3 text-gray-400 hover:text-blue-600 disabled:opacity-30">⏪</button>
                    <button onClick={playSegment} className={`flex-1 mx-4 py-3 rounded-xl font-bold text-white shadow-md transition-all ${isPlaying ? 'bg-yellow-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isPlaying ? "Eshitilmoqda..." : `🎧 Play #${currentIndex + 1}`}
                    </button>
                    <button onClick={() => changeSegment(1)} disabled={currentIndex === lesson.segments.length - 1} className="p-3 text-gray-400 hover:text-blue-600 disabled:opacity-30">⏩</button>
                </div>

                <textarea 
                    className={`w-full h-32 p-4 rounded-xl border-2 text-lg outline-none transition-colors ${feedback?.isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-200 focus:border-blue-500'}`}
                    placeholder="Eshitganingizni yozing..."
                    value={userAnswer}
                    onChange={(e) => { setUserAnswer(e.target.value); setFeedback(null); }} 
                    disabled={feedback?.isCorrect}
                    spellCheck={false}
                />

                {feedback && (<div className="bg-white p-4 rounded-xl border border-gray-200 text-lg leading-loose">{feedback.html}</div>)}
            </div>
        );
    }
    
    // ... Boshqa dars turlari ...
    if (lesson.assignmentType === 'essay_task1') {
        return <div className="space-y-4">{lesson.imageUrl && <img src={lesson.imageUrl} className="w-full rounded-xl"/>}<div className="bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500">{lesson.essayPrompt}</div><textarea className="w-full h-80 p-4 rounded-xl border" value={userAnswer} onChange={e=>setUserAnswer(e.target.value)} placeholder="Write here..."/></div>;
    }
    if (lesson.assignmentType === 'essay_task2') {
        return <div className="space-y-4"><div className="bg-purple-50 p-4 rounded-xl border-l-4 border-purple-500">{lesson.essayPrompt}</div><textarea className="w-full h-80 p-4 rounded-xl border" value={userAnswer} onChange={e=>setUserAnswer(e.target.value)} placeholder="Write here..."/></div>;
    }
    if (lesson.assignmentType === 'gap_fill') {
        return <div className="space-y-4"><div className="bg-white p-4 rounded-xl border leading-loose">{lesson.gapFillText}</div><textarea className="w-full h-40 p-4 rounded-xl border" value={userAnswer} onChange={e=>setUserAnswer(e.target.value)} placeholder="Full text..."/></div>;
    }

    // Translation / Matching
    const q = lesson.sentences ? lesson.sentences[currentIndex] : {original: ""};
    return (
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border flex justify-between items-center">
                <h2 className="text-xl font-bold">"{q.original}"</h2>
                <button onClick={() => handleSpeak(q.original)} className="text-2xl">🔊</button>
            </div>
            <textarea className="w-full h-40 p-4 rounded-xl border" value={userAnswer} onChange={e=>setUserAnswer(e.target.value)} placeholder="Javob..."/>
        </div>
    );
  };

  if (!lesson) return <div className="text-center p-10 font-bold text-gray-400">Yuklanmoqda...</div>;

  if (isFinished && finalResults) {
      const total = finalResults.reduce((a, b) => a + b.score, 0);
      return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md text-center">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Natija 🏆</h1>
                <div className={`text-6xl font-extrabold my-6 text-blue-500`}>
                    {total} <span className="text-lg text-gray-400">/ {lesson.assignmentType==='dictation' ? lesson.segments.length * 5 : finalResults.length * 5}</span>
                </div>
                <button onClick={() => navigate('/')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Bosh Sahifa</button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm flex justify-between items-center"><button onClick={()=>navigate('/')} className="text-blue-600 font-bold text-lg">←</button><span className="font-bold text-gray-500 uppercase text-xs tracking-widest">{lesson.assignmentType}</span><div className="w-6"></div></div>
      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        {renderContent()}
        
        {lesson.assignmentType === 'dictation' ? (
            <button onClick={feedback?.isCorrect ? handleSaveAndNext : checkStrictDictation} className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform ${feedback?.isCorrect ? 'bg-green-600 text-white animate-bounce' : 'bg-slate-900 text-white'}`}>
                {feedback?.isCorrect ? "KEYINGISI →" : "TEKSHIRISH ✅"}
            </button>
        ) : (
            <button onClick={handleNext} className="w-full bg-[#2481cc] text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
             {(currentIndex >= (lesson.sentences?.length || 0) - 1 && !lesson.assignmentType.includes('essay') && lesson.assignmentType !== 'gap_fill') ? "YAKUNLASH ✅" : "KEYINGI →"}
            </button>
        )}
      </div>
    </div>
  );
};

export default LessonPage;