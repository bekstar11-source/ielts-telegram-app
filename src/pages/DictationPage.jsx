import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as Diff from 'diff'; // 🔥 Professional solishtirish uchun

const DictationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(null);

  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0); // Qaysi jumlada ekanimiz
  const [userInput, setUserInput] = useState('');
  const [feedbackHtml, setFeedbackHtml] = useState(null); // Tekshirilgan matn (HTML)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // 1. Darsni yuklash
  useEffect(() => {
    const fetchLesson = async () => {
      const docRef = doc(db, "assignments", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setLesson(docSnap.data());
      } else {
        navigate('/');
      }
    };
    fetchLesson();
  }, [id, navigate]);

  // 2. Audio Player Mantiqi
  const playSegment = () => {
    if (!lesson || !audioRef.current) return;
    
    const segment = lesson.segments[currentIndex];
    audioRef.current.currentTime = segment.start;
    audioRef.current.play();
    setIsPlaying(true);

    // To'xtash vaqtini kuzatish
    const checkTime = () => {
      if (audioRef.current.currentTime >= segment.end) {
        audioRef.current.pause();
        setIsPlaying(false);
        audioRef.current.removeEventListener('timeupdate', checkTime);
      }
    };
    audioRef.current.addEventListener('timeupdate', checkTime);
  };

  // 3. Tekshirish (Smart Diff)
  const checkAnswer = () => {
    const currentSegment = lesson.segments[currentIndex];
    
    // Matnlarni tozalash (punktuatsiyani olib tashlash ixtiyoriy)
    const cleanOriginal = currentSegment.text.trim();
    const cleanUser = userInput.trim();

    // Diff algoritmi (Harflar emas, so'zlar bo'yicha)
    const diff = Diff.diffWords(cleanUser, cleanOriginal, { ignoreCase: true });

    const result = diff.map((part, index) => {
      // Yashil: To'g'ri
      if (!part.added && !part.removed) {
        return <span key={index} className="text-green-600 font-bold mx-1">{part.value}</span>;
      }
      // Qizil: O'quvchi xato yozgan (Removed from user input view)
      if (part.added) { 
         // Bu yerda 'added' - originalda bor, lekin userda yo'q degani emas, diff library teskari ishlashi mumkin.
         // diffWords da: 
         // added: true -> Originalda bor, Userda yo'q (Missed) YOKI User qo'shgan.
         // Keling, oddiyroq mantiq qilamiz:
         return <span key={index} className="text-green-600 font-bold border-b-2 border-green-500 mx-1">{part.value}</span>; 
      }
      // Qizil (Xato yozilgan)
      if (part.removed) {
        return <span key={index} className="text-red-500 line-through decoration-2 mx-1">{part.value}</span>;
      }
      return null;
    });

    setFeedbackHtml(result);
  };

  // Keyingi jumlaga o'tish
  const handleNext = () => {
    if (currentIndex < lesson.segments.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserInput('');
      setFeedbackHtml(null);
    } else {
      setIsFinished(true);
    }
  };

  if (!lesson) return <div className="text-center p-10">Yuklanmoqda...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans max-w-2xl mx-auto">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/')} className="text-blue-600 font-bold">← Chiqish</button>
        <span className="text-gray-500 font-bold">Jumla: {currentIndex + 1} / {lesson.segments.length}</span>
      </div>

      {/* AUDIO PLAYER (Yashirin) */}
      <audio ref={audioRef} src={lesson.audioUrl} preload="auto" />

      {/* ASOSIY OYNA */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        
        {/* Play Button */}
        <button 
          onClick={playSegment} 
          disabled={isPlaying}
          className={`w-full py-4 rounded-xl font-bold text-lg mb-4 flex items-center justify-center gap-2 transition-all
            ${isPlaying ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}
          `}
        >
          {isPlaying ? (
            <>🔊 Eshitilmoqda...</>
          ) : (
            <>🎧 Eshitish (Jumla #{currentIndex + 1})</>
          )}
        </button>

        {/* Input */}
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Eshitganingizni yozing..."
          className="w-full h-32 p-4 border rounded-xl text-lg outline-none focus:ring-2 ring-blue-500"
          spellCheck={false}
        />

        {/* Natija oynasi */}
        {feedbackHtml && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-lg leading-relaxed">
            <p className="text-xs text-gray-400 font-bold uppercase mb-2">Tekshiruv:</p>
            <div>{feedbackHtml}</div>
          </div>
        )}

        {/* Tugmalar */}
        <div className="mt-6 flex gap-3">
          {!feedbackHtml ? (
            <button 
                onClick={checkAnswer} 
                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold shadow-lg"
            >
                Tekshirish ✅
            </button>
          ) : (
            <button 
                onClick={handleNext} 
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg animate-pulse"
            >
                {currentIndex < lesson.segments.length - 1 ? "Keyingi Jumla →" : "Yakunlash 🎉"}
            </button>
          )}
        </div>

      </div>

      {isFinished && (
        <div className="mt-6 text-center bg-green-100 p-6 rounded-2xl text-green-800">
            <h2 className="text-2xl font-bold">Mashq Tugadi! 🥳</h2>
            <p>Siz barcha jumlalarni yozib tugatdingiz.</p>
            <button onClick={() => navigate('/')} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg font-bold">Bosh sahifa</button>
        </div>
      )}

    </div>
  );
};

export default DictationPage;