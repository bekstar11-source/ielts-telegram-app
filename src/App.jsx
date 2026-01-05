import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Sahifalar
import StudentHome from './pages/StudentHome';
import TeacherAdmin from './pages/TeacherAdmin';
import LessonPage from './pages/LessonPage'; // <--- YANGI QO'SHILDI

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudentHome />} />
        <Route path="/admin" element={<TeacherAdmin />} />
        
        {/* YANGI ROUTE: :id bu o'zgaruvchi degani */}
        <Route path="/lesson/:id" element={<LessonPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;