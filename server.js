import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '50mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/', (req, res) => res.send('AI Server (Smart Feedback & Groups) Active! ✅'));

app.post('/check-quiz', async (req, res) => {
  const { quizData, direction } = req.body;

  if (!quizData || !Array.isArray(quizData)) {
    return res.status(400).json({ error: "Ma'lumot xato" });
  }

  // Mantiq: Qaysi til grammatikasini tekshirish kerak?
  const isUzToEn = direction === 'uz-en';
  const targetLang = isUzToEn ? "INGLIZ TILI" : "O'ZBEK TILI";

  try {
    const quizText = JSON.stringify(quizData.map((item, index) => ({
      id: index,
      savol: item.question,
      ustoz: item.correctTranslation,
      oquvchi: item.userAnswer
    })));

    // 🔥 YANGILANGAN "AQLLI VA QISQA" PROMPT
    const prompt = `
      Sen tajribali IELTS instruktorisan. Vazifang: O'quvchi tarjimasini tekshirish.
      
      YO'NALISH: ${targetLang}ga tarjima.
      
      INPUT:
      ${quizText}

      BAHOLASH QOIDASI (RUBRIC):
      - 5 ball: Ma'no to'liq to'g'ri va grammatik xatosiz.
      - 4 ball: Ma'no to'g'ri, kichik "spelling" yoki artikl xatosi.
      - 3 ball: Grammatik xato (zamon, predlog, so'z tartibi).
      - 1-2 ball: Ma'no noto'g'ri.

      FEEDBACK (IZOH) QOIDALARI:
      1. **Juda qisqa bo'lsin** (maksimum 15-20 so'z).
      2. Agar xato bo'lsa: "Xato: [nima xato]. To'g'ri qoida: [qisqa tushuntir]".
      3. Agar to'g'ri bo'lsa: "Barakalla!" yoki "Mukammal".
      4. O'zbek tilida yoz.
      5. Misol: "Xato: 'I going' bo'lmaydi. To be fe'li tushib qoldi: 'I am going'."

      JAVOB FORMATI (JSON):
      {
        "results": [
          { "id": 0, "score": 0, "feedback": "Qisqa va foydali izoh...", "correction": "To'g'ri variant..." }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2, // Aniq javob uchun
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
app.listen(PORT, () => console.log(`🚀 Server ${PORT} da ishlayapti`));