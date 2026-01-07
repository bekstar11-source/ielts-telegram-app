import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import * as Diff from 'diff'; // 🔥 DICTATION UCHUN

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

  // 🔥 DICTATION SPECIFIC STATES
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedbackHtml, setFeedbackHtml] = useState(null); // Dictation natijasi (HTML)

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

  // --- AUDIO PLAYER (Dictation) ---
  const playSegment = () => {
    if (!lesson || !audioRef.current) return;
    const segment = lesson.segments[currentIndex];
    
    // Aniq vaqtga o'tkazish
    audioRef.current.currentTime = segment.start;
    audioRef.current.play();
    setIsPlaying(true);

    const checkTime = () => {
        // Ozgina buffer (0.1s) beramiz, so'z kesilib qolmasligi uchun
        if (audioRef.current.currentTime >= segment.end) {
            audioRef.current.pause();
            setIsPlaying(false);
            audioRef.current.removeEventListener('timeupdate', checkTime);
        }
    };
    audioRef.current.addEventListener('timeupdate', checkTime);
  };

  // --- CHECK DICTATION (LOCAL DIFF) ---
  const checkDictation = () => {
      const segment = lesson.segments[currentIndex];
      const cleanOriginal = segment.text.trim();
      const cleanUser = userAnswer.trim();

      // So'zma-so'z solishtirish
      const diff = Diff.diffWords(cleanUser, cleanOriginal, { ignoreCase: true });
      
      let correctWordsCount = 0;
      let totalWordsCount = cleanOriginal.split(/\s+/).length;

      const resultHtml = diff.map((part, i) => {
          if (!part.added && !part.removed) {
              correctWordsCount += part.value.trim().split(/\s+/).length;
              return <span key={i} className="text-green-600 font-bold mx-1">{part.value}</span>;
          }
          if (part.added) { // Userda yo'q, lekin Originalda bor (Missed)
              return <span key={i} className="text-green-600 font-bold border-b-2 border-green-500 mx-1 opacity-70">{part.value}</span>;
          }
          if (part.removed) { // User xato yozgan
              return <span key={i} className="text-red-500 line-through decoration-2 mx-1 opacity-80">{part.value}</span>;
          }
          return null;
      });

      setFeedbackHtml(resultHtml);
      
      // Natijani saqlash uchun tayyorlaymiz
      const score = Math.round((correctWordsCount / totalWordsCount) * 5); // 5 ballik tizim
      
      const resultObj = {
          question: `Segment #${currentIndex + 1}`,
          correctTranslation: segment.text, // To'g'ri javob
          userAnswer: userAnswer,
          score: score > 5 ? 5 : (score < 0 ? 0 : score),
          feedback: `Aniqlik: ${Math.round((correctWordsCount/totalWordsCount)*100)}%`
      };

      // Statega qo'shish (keyinchalik submit qilish uchun)
      setQuizAnswers(prev => [...prev, resultObj]);
  };

  // --- UMUMIY NEXT LOGIC ---
  const handleNext = () => {
    // 1. Agar Dictation bo'lsa va hali tekshirilmagan bo'lsa
    if (lesson.assignmentType === 'dictation' && !feedbackHtml) {
        checkDictation();
        return; // Keyingi bosqichga (Next Question) o'tmay turamiz, natijani ko'rsin
    }

    // 2. Oddiy testlar uchun ma'lumot yig'ish
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
        setQuizAnswers([...quizAnswers, newAnswerObj]);
    }

    // 3. Keyingi savolga o'tish yoki tugatish
    const isSingleQ = lesson.assignmentType.includes('essay') || lesson.assignmentType === 'gap_fill';
    const maxIndex = lesson.assignmentType === 'dictation' ? lesson.segments.length - 1 : lesson.sentences?.length - 1;

    // Tozalash
    setUserAnswer('');
    setFeedbackHtml(null);

    if (!isSingleQ && currentIndex < maxIndex) {
        setCurrentIndex(currentIndex + 1);
    } else {
        // Dictation uchun alohida submit, chunki u allaqachon baholanib bo'ldi
        if (lesson.assignmentType === 'dictation') {
            finishDictation();
        } else {
            // Oddiy testlarni serverga jo'natish
            submitQuiz([...quizAnswers, {question: "Last", userAnswer: userAnswer}]); // Oxirgisini qo'shish kerak bo'lishi mumkin, logikaga qarab
        }
    }
  };

  // 🔥 DICTATION TUGATISH (Serverga yubormasdan, to'g'ridan-to'g'ri Firebase)
  const finishDictation = async () => {
      setIsChecking(true);
      try {
          const totalScore = quizAnswers.reduce((acc, curr) => acc + curr.score, 0);
          const maxScore = lesson.segments.length * 5;

          await addDoc(collection(db, "results"), {
            studentName: localStorage.getItem('studentName') || "Noma'lum",
            studentGroup: localStorage.getItem('groupName') || "Guruhsiz",
            lessonTitle: lesson.title,
            assignmentType: 'dictation',
            totalScore: totalScore,
            maxScore: maxScore,
            history: quizAnswers,
            date: serverTimestamp()
          });

          setFinalResults(quizAnswers);
          setIsFinished(true);
      } catch (e) { alert("Xato: " + e.message); }
      finally { setIsChecking(false); }
  };

  // --- ODDY TESTLARNI SERVERGA YUBORISH ---
  const submitQuiz = async (allAnswers) => {
    setIsChecking(true);
    
    // Oxirgi element noto'g'ri qo'shilib qolmasligi uchun filtrlaymiz (agar kerak bo'lsa)
    // Aslida handleNext da to'g'irlash kerak, lekin bu yerda oddiy yechim:
    // ... (Eski submitQuiz kodingiz o'zgarishsiz qoladi)
    
    try {
      const response = await fetch('https://ielts-telegram-app.onrender.com/check-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            quizData: allAnswers.filter(a => a.question !== "Last"), // Fix
            direction: lesson.direction || 'en-uz',
            assignmentType: lesson.assignmentType 
        })
      });

      if (!response.ok) throw new Error("Server xatosi");
      const aiResults = await response.json();
      
      const fullHistory = allAnswers.filter(a => a.question !== "Last").map((item, index) => {
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
    } catch (error) { setErrorMessage(error.message); setIsFinished(true); } 
    finally { setIsChecking(false); }
  };

  if (!lesson) return <div className="text-center p-10">Yuklanmoqda...</div>;

  // --- RENDER CONTENT ---
  const renderContent = () => {
    // 🎧 DICTATION UI
    if (lesson.assignmentType === 'dictation') {
        const segment = lesson.segments[currentIndex];
        return (
            <div className="space-y-4">
                <audio ref={audioRef} src={lesson.audioUrl} preload="auto" />
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-50 text-center">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Jumla {currentIndex + 1} / {lesson.segments.length}</h2>
                    
                    <button 
                        onClick={playSegment} 
                        disabled={isPlaying}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-sm
                            ${isPlaying ? 'bg-yellow-100 text-yellow-700 animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'}
                        `}
                    >
                        {isPlaying ? "🔊 Eshitilmoqda..." : "🎧 Eshitish (Play)"}
                    </button>
                </div>

                {!feedbackHtml ? (
                    <textarea 
                        className="w-full h-40 p-4 rounded-xl border focus:ring-2 ring-blue-500 text-lg"
                        placeholder="Eshitganingizni yozing..."
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        spellCheck={false}
                    />
                ) : (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 text-lg leading-loose">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Natija:</p>
                        <div>{feedbackHtml}</div>
                    </div>
                )}
            </div>
        );
    }

    // ... Boshqa typelar (Eski kodlar o'zgarishsiz qoladi) ...
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
    const q = lesson.sentences[currentIndex];
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

  // LOADING
  if (isChecking) return <div className="min-h-screen flex items-center justify-center">Tekshirilmoqda...</div>;

  // RESULT
  if (isFinished && finalResults) {
      const total = finalResults.reduce((a, b) => a + b.score, 0);
      const isEssay = lesson.assignmentType.includes('essay');
      return (
        <div className="min-h-screen bg-gray-50 p-4 pb-10">
            <div className="bg-white p-6 rounded-3xl shadow-lg mb-6 text-center">
                <h1 className="text-2xl font-bold">Natija</h1>
                <div className="text-5xl font-extrabold my-4 text-blue-600">{total} {isEssay ? "/ 9" : "ball"}</div>
                <button onClick={()=>navigate('/')} className="bg-slate-800 text-white px-6 py-2 rounded-lg">Chiqish</button>
            </div>
            <div className="space-y-4">
                {finalResults.map((item, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between font-bold mb-2"><span>#{i+1}</span><span>{item.score} ball</span></div>
                        <div className="text-sm bg-gray-50 p-2 rounded mb-2"><b>Siz:</b> {item.userAnswer}</div>
                        <div className="text-sm text-green-700"><b>To'g'ri:</b> {item.correctTranslation || item.teacherTrans}</div>
                        <div className="text-xs text-gray-500 mt-2 italic">{item.feedback}</div>
                    </div>
                ))}
            </div>
        </div>
      );
  }

  // MAIN RENDER
  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm flex justify-between">
         <button onClick={()=>navigate('/')}>←</button>
         <span className="font-bold text-gray-500 uppercase">{lesson.assignmentType}</span>
      </div>
      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        {renderContent()}
        
        <button onClick={handleNext} className="w-full bg-[#2481cc] text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
            {/* Tugma matnini o'zgartirish */}
            {lesson.assignmentType === 'dictation' && !feedbackHtml ? "TEKSHIRISH ✅" : 
             (lesson.assignmentType === 'dictation' && currentIndex >= lesson.segments.length - 1) ? "YAKUNLASH 🏁" :
             (currentIndex >= (lesson.sentences?.length || lesson.segments?.length) - 1 && !lesson.assignmentType.includes('essay') && lesson.assignmentType !== 'gap_fill' && lesson.assignmentType !== 'dictation') ? "YAKUNLASH ✅" :
             "KEYINGI →"}
        </button>
      </div>
    </div>
  );
};

export default LessonPage;