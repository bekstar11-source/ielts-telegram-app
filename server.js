import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// 🔥 1. CORS MUAMMOSINI HAL QILISH (Hamma joyga ruxsat)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Payload hajmini oshirish (Katta testlar uchun)
app.use(express.json({ limit: '50mb' }));

// Loglarni ko'rish (Render Logs da chiqadi)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

// Server tirikligini tekshirish
app.get('/', (req, res) => res.send('IELTS AI Server (Quiz Mode) Active! ✅'));

// 🔥 2. ASOSIY TEKSHIRISH ROUTE-I
app.post('/check-quiz', async (req, res) => {
  const { quizData } = req.body;

  // Ma'lumot kelganini tekshirish
  if (!quizData || !Array.isArray(quizData)) {
    console.error("XATO: quizData noto'g'ri formatda");
    return res.status(400).json({ error: "Ma'lumotlar noto'g'ri formatda" });
  }

  console.log(`--> ${quizData.length} ta savol tekshirishga keldi.`);

  try {
    // AI uchun ma'lumotni tayyorlash
    const quizText = JSON.stringify(quizData.map((item, index) => ({
      id: index,
      savol: item.question,
      ustoz_javobi: item.correctTranslation,
      oquvchi_javobi: item.userAnswer
    })));

    const prompt = `
      Sen qattiqqo'l IELTS Examiner'san. Quyidagi o'quvchi javoblarini tekshir.
      
      INPUT:
      ${quizText}

      BAHOLASH MEZONI (RUBRIC):
      - 5 ball: Ma'no to'g'ri VA Grammatika/Vocabulary xatosiz.
      - 4 ball: Ma'no to'g'ri, lekin kichik grammatik xato (artikl, spelling).
      - 3 ball: Jiddiy grammatik xato (zamonlar, noto'g'ri fe'l) yoki so'z noto'g'ri tanlangan.
      - 1-2 ball: Ma'no noto'g'ri yoki tarjima yo'q.

      MUHIM: 
      - Grammatikaga qattiq qara. "I go now" o'rniga "I going now" desa jazolab past ball qo'y.
      - Izohda xatoni aniq ko'rsat.

      JAVOB FORMATI (JSON bo'lishi SHART):
      {
        "results": [
          { "id": 0, "score": 0, "feedback": "...", "correction": "..." }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    // JSONni tozalash va Parse qilish
    let rawContent = completion.choices[0].message.content;
    rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsedData = JSON.parse(rawContent);

    if (!parsedData.results) {
      throw new Error("AI noto'g'ri format qaytardi");
    }

    console.log("--> Muvaffaqiyatli tekshirildi ✅");
    res.json(parsedData.results);

  } catch (error) {
    console.error("SERVER XATOSI:", error);
    res.status(500).json({ error: "Serverda ichki xatolik: " + error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishlayapti`));