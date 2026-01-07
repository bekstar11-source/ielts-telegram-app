import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const LessonPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // --- STATES ---
  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0); // Hozirgi segment
  const [userAnswer, setUserAnswer] = useState('');
  
  // Natijalar
  const [quizAnswers, setQuizAnswers] = useState([]); 
  const [isFinished, setIsFinished] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false); // Serverga yuborishda loading

  // --- DICTATION STATES ---
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState(null); // { html: ..., isCorrect: bool }
  const [attempts, setAttempts] = useState(0); // Necha marta xato qildi?
  const [hints, setHints] = useState([]); // Ismlar ro'yxati

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const docRef = doc(db, "assignments", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setLesson(data);
            // Diktant bo'lsa birinchi hintni yuklaymiz
            if (data.assignmentType === 'dictation' && data.segments.length > 0) {
                extractHints(data.segments[0].text);
            }
        } else navigate('/');
      } catch (error) { console.error(error); }
    };
    fetchLesson();
  }, [id, navigate]);

  // 🔥 HINT LOGIKASI (Ismlar va Joy nomlarini topish)
  const extractHints = (text) => {
      // Regex: Katta harf bilan boshlangan so'zlarni topadi (Gap boshidagi so'zdan tashqari)
      // Oddiyroq variant: Barcha katta harfli so'zlarni olamiz, lekin tinish belgilarini tozalaymiz.
      const words = text.split(/\s+/);
      const properNouns = words
        .filter(w => /^[A-Z]/.test(w)) // Katta harf bilan boshlansa
        .map(w => w.replace(/[.,!?;:]/g, '')); // Tinish belgilarini olib tashlash
      
      // Unikal nomlarni saqlaymiz
      setHints([...new Set(properNouns)]); 
  };

  // --- AUDIO PLAYER ---
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

  // ⏩ NAVIGATSIYA (Oldinga / Ortga)
  const changeSegment = (direction) => {
      const newIndex = currentIndex + direction;
      if (newIndex >= 0 && newIndex < lesson.segments.length) {
          // Hozirgi javobni saqlab qo'yamiz (agar hali saqlanmagan bo'lsa)
          // Bu yerda oddiy o'tish qilamiz, baholash keyin bo'ladi.
          setCurrentIndex(newIndex);
          setUserAnswer('');
          setFeedback(null);
          setAttempts(0);
          extractHints(lesson.segments[newIndex].text); // Yangi hintlar
      }
  };

  // 🔥 QATTIQQO'L TEKSHIRISH (FIRST ERROR ONLY)
  const checkStrictDictation = () => {
      const segment = lesson.segments[currentIndex];
      const cleanOriginal = segment.text.trim().split(/\s+/); // Array of words
      const cleanUser = userAnswer.trim().split(/\s+/); // Array of words

      let isPerfect = true;
      let errorIndex = -1; // Xato topilgan joy
      let correctWordsHtml = [];

      // Solishtirish
      for (let i = 0; i < cleanOriginal.length; i++) {
          const originalWord = cleanOriginal[i].replace(/[.,!?;:]/g, '').toLowerCase(); // Tinish belgisiz solishtiramiz
          const userWordRaw = cleanUser[i] || ""; 
          const userWord = userWordRaw.replace(/[.,!?;:]/g, '').toLowerCase();

          if (userWord === originalWord) {
              // To'g'ri so'z -> Yashil
              correctWordsHtml.push(<span key={i} className="text-green-600 font-bold mx-1">{cleanOriginal[i]}</span>);
          } else {
              // Xato topildi!
              isPerfect = false;
              errorIndex = i;
              break; // 🛑 TO'XTATAMIZ! Keyingisini ko'rsatmaymiz
          }
      }

      // Natijani ko'rsatish
      if (isPerfect && cleanUser.length === cleanOriginal.length) {
          setFeedback({ 
              html: <div className="text-green-600 font-bold">Mukammal! 🎉 Hammasi to'g'ri.</div>, 
              isCorrect: true 
          });
      } else {
          // Xato bo'lsa
          setAttempts(prev => prev + 1); // Urinishni oshiramiz
          setFeedback({
              html: (
                  <div>
                      {correctWordsHtml}
                      <span className="text-red-600 font-bold border-b-2 border-red-500 mx-1">
                          {cleanUser[errorIndex] || "..."} ❌
                      </span>
                      <p className="text-xs text-red-500 mt-2 font-bold">
                          Xatolik bor! Qayta eshitib, tuzating.
                      </p>
                  </div>
              ),
              isCorrect: false
          });
      }
  };

  // --- NEXT STEP (Saqlash va Keyingisi) ---
  const handleSaveAndNext = () => {
      const segment = lesson.segments[currentIndex];
      
      // Ballni hisoblash (Strict Mode)
      // 0 xato = 5 ball
      // 1 xato = 4 ball
      // 2 xato = 3 ball ...
      // 5+ xato = 0 ball
      let score = 5 - attempts;
      if (score < 0) score = 0;

      const resultObj = {
          question: `Segment #${currentIndex + 1}`,
          correctTranslation: segment.text,
          userAnswer: userAnswer,
          score: score,
          feedback: `Urinishlar: ${attempts + 1} ta. Ball: ${score}/5`
      };

      // Javobni saqlaymiz
      const newAnswers = [...quizAnswers, resultObj];
      setQuizAnswers(newAnswers);

      // Keyingisiga o'tish
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

  // ... (Boshqa dars turlari uchun eski renderContent logikasi saqlanib qoladi) ...
  // ... (Faqat Dictation qismini o'zgartiramiz) ...

  const renderContent = () => {
    // 🎧 DICTATION UI (YANGILANGAN)
    if (lesson.assignmentType === 'dictation') {
        return (
            <div className="space-y-4">
                <audio ref={audioRef} src={lesson.audioUrl} preload="auto" />
                
                {/* Hints (Ismlar) */}
                {hints.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                        {hints.map((h, i) => (
                            <span key={i} className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold border border-yellow-200">
                                💡 {h}
                            </span>
                        ))}
                    </div>
                )}

                {/* Player Controls */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex items-center justify-between">
                    <button onClick={() => changeSegment(-1)} disabled={currentIndex === 0} className="p-3 text-gray-400 hover:text-blue-600 disabled:opacity-30">⏪</button>
                    
                    <button 
                        onClick={playSegment} 
                        className={`flex-1 mx-4 py-3 rounded-xl font-bold text-white shadow-md transition-all
                            ${isPlaying ? 'bg-yellow-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}
                        `}
                    >
                        {isPlaying ? "Eshitilmoqda..." : `🎧 Play #${currentIndex + 1}`}
                    </button>

                    <button onClick={() => changeSegment(1)} disabled={currentIndex === lesson.segments.length - 1} className="p-3 text-gray-400 hover:text-blue-600 disabled:opacity-30">⏩</button>
                </div>

                {/* Input Area */}
                <textarea 
                    className={`w-full h-32 p-4 rounded-xl border-2 text-lg outline-none transition-colors
                        ${feedback?.isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-200 focus:border-blue-500'}
                    `}
                    placeholder="Eshitganingizni yozing..."
                    value={userAnswer}
                    onChange={(e) => { setUserAnswer(e.target.value); setFeedback(null); }} // Yozganda xatoni o'chirish
                    disabled={feedback?.isCorrect} // To'g'ri bo'lsa yozib bo'lmaydi
                    spellCheck={false}
                />

                {/* Feedback Display */}
                {feedback && (
                    <div className="bg-white p-4 rounded-xl border border-gray-200 text-lg leading-loose">
                        {feedback.html}
                    </div>
                )}
            </div>
        );
    }
    
    // ... Eski kodlar (Essay, Test va h.k.) o'zgarishsiz ...
    const q = lesson.sentences ? lesson.sentences[currentIndex] : {}; 
    // (Boshqa turlar uchun soddalashtirilgan kod, oldingi versiyadagidek qoladi)
    return <div className="text-center text-gray-500">Bu dars turi hali yuklanmadi.</div>;
  };

  if (!lesson) return <div className="text-center p-10 font-bold text-gray-400">Yuklanmoqda...</div>;

  // --- RESULT SCREEN ---
  if (isFinished && finalResults) {
      const total = finalResults.reduce((a, b) => a + b.score, 0);
      return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md text-center">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Natija 🏆</h1>
                <div className={`text-6xl font-extrabold my-6 ${total/lesson.segments.length/5 > 0.8 ? 'text-green-500' : 'text-blue-500'}`}>
                    {total} <span className="text-lg text-gray-400">/ {lesson.segments.length * 5}</span>
                </div>
                <button onClick={() => navigate('/')} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Bosh Sahifa</button>
            </div>
        </div>
      );
  }

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-[#f4f4f5] flex flex-col pb-10">
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm flex justify-between items-center">
         <button onClick={()=>navigate('/')} className="text-blue-600 font-bold text-lg">←</button>
         <span className="font-bold text-gray-500 uppercase text-xs tracking-widest">{lesson.assignmentType}</span>
         <div className="w-6"></div>
      </div>

      <div className="flex-1 p-5 max-w-lg mx-auto w-full flex flex-col gap-6">
        
        {/* Kontent (Dictation yoki boshqa) */}
        {lesson.assignmentType === 'dictation' ? renderContent() : (
            // Oddiy testlar uchun eski kodni shu yerga joylashingiz mumkin
            <div className="text-center">Boshqa dars turlari</div>
        )}
        
        {/* ACTION BUTTON */}
        {lesson.assignmentType === 'dictation' && (
            <button 
                onClick={feedback?.isCorrect ? handleSaveAndNext : checkStrictDictation} 
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform
                    ${feedback?.isCorrect ? 'bg-green-600 text-white animate-bounce' : 'bg-slate-900 text-white'}
                `}
            >
                {feedback?.isCorrect ? "KEYINGISI →" : "TEKSHIRISH ✅"}
            </button>
        )}

      </div>
    </div>
  );
};

export default LessonPage;