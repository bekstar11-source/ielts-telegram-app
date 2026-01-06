import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StudentHome from './pages/StudentHome';
import LessonPage from './pages/LessonPage';
import TeacherAdmin from './pages/TeacherAdmin';

function App() {
  useEffect(() => {
    // Telegram Web App-ni sozlash
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand(); // Ilovani to'liq ekranga yoyish
      
      // Telegram mavzusiga qarab fon rangini belgilash
      document.body.style.backgroundColor = tg.backgroundColor || '#f4f4f5';
    }
  }, []);

  return (
    <Router>
      <div className="max-w-md mx-auto min-h-screen font-sans selection:bg-blue-100">
        <Routes>
          <Route path="/" element={<StudentHome />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="/admin" element={<TeacherAdmin />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;