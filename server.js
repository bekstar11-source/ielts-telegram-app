import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Debug uchun log
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

app.get('/', (req, res) => res.send('AI Server (Bulk Quiz Mode) ishlayapti! ✅'));

// 🔥 YANGI: BARCHA JAVOBLARNI BIRATOLASIGA TEKSHIRISH
app.post('/check-quiz', async (req, res) => {
  const { quizData } = req.body; // Bu yerda savollar va javoblar ro'yxati keladi

  if (!quizData || !Array.isArray(quizData)) {
    return res.status(400).json({ error: "Ma'lumotlar noto'g'ri formatda" });
  }

  console.log(`Checking ${quizData.length} items...`);

  try {
    // AI uchun ma'lumotni tayyorlaymiz
    const quizText = JSON.stringify(quizData.map((item, index) => ({
      id: index,
      savol: item.question,
      ustoz_javobi: item.correctTranslation,
      oquvchi_javobi: item.userAnswer
    })));

    const prompt = `
      Sen IELTS o'qituvchisisan. Quyida o'quvchining test javoblari ro'yxati keltirilgan.
      Har birini alohida tekshirib, baholab ber.

      MA'LUMOTLAR:
      ${quizText}

      BAHOLASH QOIDASI:
      1. Agar o'quvchi javobi ustozniki bilan ma'nodosh bo'lsa -> 5 ball.
      2. Grammatik xato bo'lsa -> 4 yoki 3 ball.
      3. Ma'no noto'g'ri bo'lsa -> 1-2 ball.

      JAVOB FORMATI (JSON):
      {
        "results": [
          {
            "id": 0,
            "score": 5,
            "feedback": "Izoh...",
            "correction": "To'g'ri javob..."
          },
          ...
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);
    res.json(aiResponse.results);

  } catch (error) {
    console.error("AI Xatoligi:", error);
    res.status(500).json({ error: "Serverda xatolik" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishlayapti`));