import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// .env faylidagi o'zgaruvchilarni yuklash
dotenv.config();

const app = express();

// React (Frontend) dan keladigan so'rovlarga ruxsat berish
app.use(cors());
app.use(express.json());

// OpenAI ni sozlash
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

// 1. Asosiy sahifa (Render linkini ochganda xato chiqmasligi uchun)
app.get('/', (req, res) => {
  res.send('IELTS AI Teacher Serveri muvaffaqiyatli ishlayapti! ✅');
});

// 2. AI orqali javobni tekshirish manzili
app.post('/check-answer', async (req, res) => {
  const { original, userAnswer } = req.body;

  // Agar ma'lumotlar kelmasa xato qaytarish
  if (!original || !userAnswer) {
    return res.status(400).json({ error: "Ma'lumotlar to'liq emas" });
  }

  try {
    // OpenAI ga yuboriladigan buyruq (Prompt)
    const prompt = `
      Sen professional IELTS instruktorisan. O'quvchi inglizcha gapni o'zbekchaga tarjima qildi.
      Inglizcha gap: "${original}"
      O'quvchining o'zbekcha tarjimasi: "${userAnswer}"
      
      Vazifang:
      1. O'quvchining tarjimasini 1 dan 5 gacha bahola (score).
      2. O'zbek tilida qisqa va foydali feedback ber. Xatolarini tushuntir.
      3. Eng to'g'ri bo'lgan o'zbekcha tarjimani (correction) ko'rsat.
      
      Javobni FAQAT mana shu JSON formatida qaytar:
      {
        "score": 5,
        "feedback": "...",
        "correction": "..."
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-3.5-turbo", // Agar hisobingizda pul ko'p bo'lsa "gpt-4o" ishlating
      response_format: { type: "json_object" },
    });

    // AI dan kelgan javobni Reactga yuborish
    const aiResult = JSON.parse(completion.choices[0].message.content);
    res.json(aiResult);

  } catch (error) {
    console.error("OpenAI Xatoligi:", error);
    res.status(500).json({ 
      error: "AI bilan bog'lanishda xatolik yuz berdi",
      details: error.message 
    });
  }
});

// Server portini sozlash (Render avtomatik ravishda PORT beradi)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server ${PORT}-portda ishga tushdi.`);
});