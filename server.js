import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors()); // Reactdan kelgan so'rovni qabul qilish uchun
app.use(express.json());

// OpenAI ni sozlash
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Kalitni maxfiy joydan oladi
});

// Reactdan so'rov qabul qiladigan manzil
app.post('/check-answer', async (req, res) => {
  const { original, userAnswer, correctContext } = req.body;

  try {
    // AI ga buyruq berish (Prompt)
    const prompt = `
      Sen IELTS instruktorisan. O'quvchi gapni tarjima qildi.
      Original gap (Inglizcha): "${original}"
      O'quvchi tarjimasi: "${userAnswer}"
      
      Vazifang:
      1. Tarjimani 1 dan 5 gacha bahola.
      2. Agar xato bo'lsa, to'g'ri variantni ko'rsat.
      3. Qisqa izoh ber (o'zbek tilida).
      
      Javobni faqat mana shu JSON formatda qaytar:
      {
        "score": 5,
        "feedback": "Izohingiz...",
        "correction": "To'g'ri javob..."
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-3.5-turbo", // Yoki "gpt-4o" (qimmatroq)
      response_format: { type: "json_object" }, // Aniq JSON qaytarishi uchun
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);
    res.json(aiResponse);

  } catch (error) {
    console.error("AI Xatosi:", error);
    res.status(500).json({ error: "AI ishlamadi" });
  }
});

// Serverni 5000-portda ishga tushirish
app.listen(5000, () => {
  console.log('✅ Server http://localhost:5000 da ishlayapti');
});