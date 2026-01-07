import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// CORS va Sozlamalar
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '50mb' }));

// Loglar
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/', (req, res) => res.send('IELTS AI Examiner Server Active (STRICT MODE)! 👮‍♂️✅'));

// 🔥 ASOSIY TEKSHIRISH ROUTE-I
app.post('/check-quiz', async (req, res) => {
  const { quizData, direction, assignmentType } = req.body;

  if (!quizData || !Array.isArray(quizData)) {
    return res.status(400).json({ error: "Ma'lumot xato" });
  }

  let prompt = "";
  
  // --- 1. IELTS WRITING (TASK 1 & TASK 2) ---
  if (assignmentType === 'essay_task1' || assignmentType === 'essay_task2') {
    const essayData = quizData[0];
    const isTask1 = assignmentType === 'essay_task1';
    
    prompt = `
      You are a STRICT IELTS EXAMINER. Grade this ${isTask1 ? "Task 1 Report" : "Task 2 Essay"}.
      
      QUESTION: "${essayData.question}"
      STUDENT ANSWER: "${essayData.userAnswer}"

      TASK:
      Analyze based on 4 criteria: Task Response, Coherence, Lexical Resource, Grammatical Range.
      Output language: UZBEK.

      GRADING RULES:
      - Be strict. Do not give high scores easily.
      - 7.0+ requires complex sentences and rare vocabulary used correctly.
      - If grammar has frequent errors, score must be below 6.0.

      OUTPUT JSON:
      {
        "results": [
          {
            "id": 0,
            "score": 6.0,
            "feedback": "...", 
            "correction": "..."
          }
        ]
      }
    `;
  } 
  
  // --- 2. BOSHQA MASHQLAR (TRANSLATION, GAP FILL) - QATTIQQO'L REJIM 🔥 ---
  else {
    const isUzToEn = direction === 'uz-en';
    const targetLang = isUzToEn ? "INGLIZ TILI" : "O'ZBEK TILI";
    const sourceLang = isUzToEn ? "O'ZBEK TILI" : "INGLIZ TILI";
    
    // Ma'lumotlarni tayyorlash
    const quizText = JSON.stringify(quizData.map((item) => ({
      id: item.id || 0, // ID ni saqlab qolamiz
      savol: item.question,
      togri_javob: item.correctTranslation,
      oquvchi_javobi: item.userAnswer
    })));

    prompt = `
      Sen juda QATTIQQO'L (STRICT) til imtihonchisisan.
      Vazifa: ${assignmentType} mashqini tekshirish.
      Yo'nalish: ${sourceLang}dan ${targetLang}ga.

      INPUT MA'LUMOTLARI:
      ${quizText}

      BAHOLASH MEZONI (0 dan 5 gacha):
      
      🟢 5 Ball (Mukammal):
      - Hech qanday xato yo'q (spelling, grammar, punctuation to'g'ri).
      - Ma'no to'liq va tabiiy chiqqan.

      🟡 4 Ball (Yaxshi):
      - Ma'no to'g'ri.
      - 1 ta kichik xato bor (masalan: artikl tushib qolgan yoki bitta harf xato).
      - "I like apple" (apples bo'lishi kerak) -> 4 ball.

      🟠 3 Ball (Qoniqarli - Grammatik xato):
      - Ma'no tushunarli, lekin GRAMMATIK xato bor.
      - Masalan: "He go to school" (goes bo'lishi kerak).
      - Masalan: "I have seen him yesterday" (saw bo'lishi kerak).
      - DIQQAT: Grammatik xato bo'lsa, maksimal 3 ball qo'yilsin!

      🔴 2 Ball (Yomon):
      - Ma'no buzilgan yoki gap qurilishi butunlay xato.
      - Zamon (Tense) noto'g'ri ishlatilgan.

      ⚫ 1 Ball (Juda yomon):
      - So'zma-so'z tarjima qilingan, ma'no chiqmaydi.

      ⚪ 0 Ball (Yo'q):
      - Javob bo'sh yoki umuman aloqasiz.

      QAT'IY QOIDALAR:
      1. Agar o'quvchi javobi bo'sh bo'lsa: Score = 0, Feedback = "Javob yo'q", Correction = "".
      2. Rag'batlantiruvchi so'zlar ("Yaxshi harakat", "Ofarin") KERAK EMAS.
      3. Feedback qisqa va aniq bo'lsin: Faqat xatoni ko'rsat.
      4. Javobni O'ZBEK tilida qaytar.

      JAVOB FORMATI (JSON):
      {
        "results": [
          { 
            "id": (inputdagi id), 
            "score": (0-5), 
            "feedback": "Xato: 'He go'. To'g'ri: 'He goes'.", 
            "correction": "To'liq to'g'ri versiya" 
          }
        ]
      }
    `;
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini", // Yoki gpt-3.5-turbo
      response_format: { type: "json_object" },
      temperature: 0.1, // 0.1 - AI juda aniq va qat'iy bo'ladi (ijodkorlik o'chiriladi)
    });

    let rawContent = completion.choices[0].message.content;
    
    // Ba'zan AI markdown qaytaradi, uni tozalaymiz
    if (rawContent.startsWith('```json')) {
        rawContent = rawContent.replace(/^```json/, '').replace(/```$/, '');
    }
    
    const parsedData = JSON.parse(rawContent.trim());

    res.json(parsedData.results);

  } catch (error) {
    console.error("AI Server Error:", error);
    res.status(500).json({ error: "Serverda xatolik yuz berdi." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 STRICT AI Server running on port ${PORT}`));