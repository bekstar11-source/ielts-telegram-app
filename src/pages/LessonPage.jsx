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

  useEffect(() => {
    const fetchLesson = async () => {
      const docSnap = await getDoc(doc(db, "assignments", id));
      if (docSnap.exists()) setLesson(docSnap.data());
    };
    fetchLesson();
  }, [id]);

  const checkAnswer = async () => {
    if (!userAnswer.trim()) return;
    setIsChecking(true);
    try {
      const response = await fetch('https://ielts-telegram-app.onrender.com/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ original: lesson.sentences[currentIndex].original, userAnswer })
      });
      const data = await response.json();
      setAiFeedback(data);
      setTotalScore(prev => prev + data.score);
    } catch (error) { alert("Xatolik bo'ldi"); }
    setIsChecking(false);
  };

  const nextSentence = async () => {
    if (currentIndex < lesson.sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAiFeedback(null);
      setUserAnswer('');
    } else {
      await addDoc(collection(db, "results"), {
        studentName: localStorage.getItem('studentName'),
        lessonTitle: lesson.title,
        totalScore: totalScore,
        maxScore: lesson.sentences.length * 5,
        date: serverTimestamp()
      });
      alert(`Dars tugadi! Umumiy ballingiz: ${totalScore}`);
      navigate('/');
    }
  };

  if (!lesson) return <div className="p-10 text-center">Yuklanmoqda...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white p-4 shadow-sm flex items-center gap-4">
        <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
          <div className="bg-blue-600 h-full" style={{ width: `${(currentIndex / lesson.sentences.length) * 100}%` }}></div>
        </div>
        <span className="font-bold">{currentIndex + 1}/{lesson.sentences.length}</span>
      </div>

      <div className="flex-1 p-6 max-w-lg mx-auto w-full">
        <h2 className="text-xl font-bold text-center mb-6">"{lesson.sentences[currentIndex].original}"</h2>
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={!!aiFeedback}
          className="w-full p-4 mb-4 h-32 rounded-xl border-2 border-blue-100 outline-none focus:border-blue-500"
          placeholder="Tarjimani yozing..."
        />

        {aiFeedback && (
          <div className="p-4 bg-white rounded-xl border border-blue-200 mb-4 animate-in fade-in">
            <p className="font-bold text-blue-600">Baho: {aiFeedback.score}/5</p>
            <p className="text-sm text-gray-600 mt-1"><b>AI:</b> {aiFeedback.feedback}</p>
            <p className="text-sm text-green-600 mt-2 font-medium">To'g'ri: {aiFeedback.correction}</p>
          </div>
        )}

        {!aiFeedback ? (
          <button onClick={checkAnswer} disabled={isChecking} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold">
            {isChecking ? "AI tekshirmoqda..." : "TEKSHIRISH"}
          </button>
        ) : (
          <button onClick={nextSentence} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold">
            KEYINGI GAP →
          </button>
        )}
      </div>
    </div>
  );
};

export default LessonPage;