import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// 1. Xavfsizlik va Sozlamalar
app.use(cors({
  origin: '*', // Hamma joydan kirishga ruxsat (Telegram uchun)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Katta ma'lumotlar uchun limitni oshiramiz
app.use(express.json({ limit: '50mb' }));

// Har bir so'rovni log qilish (Debug uchun)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

app.get('/', (req, res) => res.send('IELTS Multi-Language Server Active! ✅'));

// 🔥 ASOSIY TEKSHIRISH ROUTE-I
app.post('/check-quiz', async (req, res) => {
  const { quizData, direction } = req.body; // direction: 'en-uz' yoki 'uz-en'

  if (!quizData || !Array.isArray(quizData)) {
    console.error("XATO: quizData noto'g'ri formatda");
    return res.status(400).json({ error: "Ma'lumotlar noto'g'ri formatda" });
  }

  console.log(`--> ${quizData.length} ta savol tekshirilyapti. Yo'nalish: ${direction}`);

  // MANTIQNI ANIQLASH
  const isUzToEn = direction === 'uz-en';
  
  // Promptni dinamik o'zgartiramiz
  const logicInstruction = isUzToEn
    ? `O'quvchi O'zbekchadan INGLIZ TILIga tarjima qilyapti.
       TEKSHIRISH: Ingliz tili Grammatikasini (Tenses, Articles, Prepositions, Word Order) juda qattiq tekshir.
       Agar grammatik xato bo'lsa (masalan: "I go home" o'rniga "I going home") ballni pasaytir.`
    : `O'quvchi Inglizchadan O'ZBEK TILIga tarjima qilyapti.
       TEKSHIRISH: Ma'no va uslubni tekshir. Grammatika ikkinchi darajali, asosiysi ma'no to'g'ri yetkazilganmi?`;

  try {
    const quizText = JSON.stringify(quizData.map((item, index) => ({
      id: index,
      savol: item.question,
      ustoz_javobi: item.correctTranslation,
      oquvchi_javobi: item.userAnswer
    })));

    const prompt = `
      Sen professional IELTS Examiner va Tilshunosan.
      
      Vazifa:
      ${logicInstruction}

      INPUT MA'LUMOTLAR:
      ${quizText}

      BAHOLASH MEZONI (RUBRIC):
      - 5 ball: Mukammal. Ma'no va Grammatika to'g'ri.
      - 4 ball: Yaxshi. Ma'no to'g'ri, kichik xato (spelling, artikl).
      - 3 ball: O'rtacha. Jiddiy grammatik xato yoki noto'g'ri so'z tanlash.
      - 1-2 ball: Yomon. Ma'no noto'g'ri.

      JAVOB FORMATI (Faqat JSON):
      {
        "results": [
          { "id": 0, "score": 0, "feedback": "Xatoni tushuntir...", "correction": "To'g'ri variant..." }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    // JSONni tozalash (AI ba'zan markdown qo'shib yuboradi)
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