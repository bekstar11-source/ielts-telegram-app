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

app.get('/', (req, res) => res.send('IELTS AI Examiner Server Active! ✅'));

// 🔥 ASOSIY TEKSHIRISH ROUTE-I
app.post('/check-quiz', async (req, res) => {
  const { quizData, direction, assignmentType } = req.body;

  if (!quizData || !Array.isArray(quizData)) {
    return res.status(400).json({ error: "Ma'lumot xato" });
  }

  let prompt = "";
  
  // --- 1. IELTS WRITING (TASK 1 & TASK 2) UCHUN PROMPT ---
  if (assignmentType === 'essay_task1' || assignmentType === 'essay_task2') {
    const essayData = quizData[0]; // Essayda odatda 1 ta katta javob bo'ladi
    const isTask1 = assignmentType === 'essay_task1';
    
    prompt = `
      Sen qattiqqo'l va professional IELTS Examiner'san. 
      O'quvchi yozgan ${isTask1 ? "IELTS Writing Task 1 (Report)" : "IELTS Writing Task 2 (Essay)"} ni tekshir.
      
      SAVOL/PROMPT: "${essayData.question}"
      O'QUVCHI JAVOBI: "${essayData.userAnswer}"

      VAZIFANG:
      Javobni quyidagi 4 ta rasmiy IELTS kriteriyasi bo'yicha tahlil qil.
      Javob O'ZBEK tilida bo'lsin.

      KRITERIYALAR:
      1. **Task Response / Achievement:** ${isTask1 ? "Ma'lumotlar to'g'ri umumlashtirilganmi? Asosiy trendlar yozilganmi?" : "Mavzu to'liq ochilganmi? Argumentlar kuchlimi?"}
      2. **Coherence & Cohesion:** Gaplar va paragraflar bog'liqligi. Linking words ishlatilishi.
      3. **Lexical Resource:** So'z boyligi, akademik so'zlar, sinonimlar.
      4. **Grammatical Range & Accuracy:** Grammatik xatolar va strukturalar xilma-xilligi.

      Boshqa talablar:
      - Har bir kriteriya uchun alohida qisqa izoh yoz.
      - Umumiy Band Score (0-9) qo'y (masalan: 6.5).
      - Eng jiddiy 3 ta xatoni va ularning to'g'ri variantini ko'rsat.

      JAVOB FORMATI (JSON SHART):
      {
        "results": [
          {
            "id": 0,
            "score": 6.5,
            "feedback": "🔹 **Task Response:** ...\\n🔹 **Coherence:** ...\\n🔹 **Vocabulary:** ...\\n🔹 **Grammar:** ...",
            "correction": "1. Xato -> To'g'ri\\n2. Xato -> To'g'ri..."
          }
        ]
      }
    `;
  } 
  
  // --- 2. BOSHQA MASHQLAR (Translation, Gap Fill, Matching) ---
  else {
    const isUzToEn = direction === 'uz-en';
    const targetLang = isUzToEn ? "INGLIZ TILI" : "O'ZBEK TILI";
    
    const quizText = JSON.stringify(quizData.map((item, index) => ({
      id: index,
      savol: item.question,
      ustoz_javobi: item.correctTranslation,
      oquvchi_javobi: item.userAnswer
    })));

    prompt = `
      Sen IELTS o'qituvchisisan. Quyidagi "${assignmentType}" turidagi mashqni tekshir.
      YO'NALISH: ${targetLang}ga.

      INPUT:
      ${quizText}

      BAHOLASH:
      - 5 ball: To'liq to'g'ri.
      - 4 ball: Kichik xato.
      - 3 ball: Grammatik xato.
      - 1-2 ball: Noto'g'ri.
      
      FEEDBACK:
      - Qisqa va lo'nda bo'lsin.
      - Agar xato bo'lsa, to'g'risini tushuntir.

      JAVOB FORMATI (JSON):
      {
        "results": [
          { "id": 0, "score": 0, "feedback": "...", "correction": "..." }
        ]
      }
    `;
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    let rawContent = completion.choices[0].message.content.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedData = JSON.parse(rawContent);

    res.json(parsedData.results);

  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 AI Server ${PORT} da ishlayapti`));