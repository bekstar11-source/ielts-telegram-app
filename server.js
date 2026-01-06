import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Loglarni ko'rish uchun (Debug)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

app.get('/', (req, res) => res.send('AI Server (GPT-4o-mini) ishlayapti! ✅'));

// 1. JAVOBNI TEKSHIRISH
app.post('/check-answer', async (req, res) => {
  const { original, userAnswer } = req.body;

  // Logga chiqarib ko'ramiz nima kelayotganini
  console.log("Savol:", original);
  console.log("Javob:", userAnswer);

  if (!original || !userAnswer) {
    return res.status(400).json({ error: "Ma'lumot yo'q" });
  }

  try {
    // Promptni Soddalashtiramiz va Aniq qilamiz
    const prompt = `
      Sen professional tarjimon va o'qituvchisan.
      Vazifa: Ingliz tilidagi gapning o'zbekcha tarjimasini tekshirish.

      Original (EN): "${original}"
      O'quvchi tarjimasi (UZ): "${userAnswer}"

      Talablar:
      1. Baho (1-5): Ma'no to'g'ri bo'lsa 5 yoki 4 qo'y. Grammatik xato bo'lsa ham ma'no to'g'ri bo'lsa past baho qo'yma.
      2. Feedback: Agar xato bo'lsa, o'zbek tilida qisqa tushuntir. Agar to'g'ri bo'lsa "Barakalla!" de.
      3. Correction: Eng tabiiy va to'g'ri o'zbekcha variantni yoz.

      Javob JSON formatida bo'lsin:
      {
        "score": 5,
        "feedback": "...",
        "correction": "..."
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini", // 🔥 ENG MUHIM O'ZGARISH (Arzon va Aqlli)
      response_format: { type: "json_object" },
      temperature: 0.2, // Pastroq qildik, shunda u aniq javob beradi, "ijod" qilmaydi
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);
    
    console.log("AI Javobi:", aiResult); // Serverda javobni ko'rish uchun
    res.json(aiResult);

  } catch (error) {
    console.error("AI Xatoligi:", error);
    res.status(500).json({ error: "AI serverda xatolik" });
  }
});

// 2. XULOSA YASASH (SUMMARY)
app.post('/create-summary', async (req, res) => {
  const { history } = req.body;

  if (!history || history.length === 0) return res.json({ summary: "Ma'lumot yetarli emas." });

  try {
    const historyText = history.map(h => `Savol: "${h.question}" | Javob: "${h.userAnswer}" | Ball: ${h.score}`).join("\n");

    const prompt = `
      Quyidagi test natijalariga qarab, o'qituvchi uchun o'zbek tilida qisqa hisobot yoz.
      Faqat o'quvchining xatolariga urg'u ber.
      
      Natijalar:
      ${historyText}
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini", // Bu ham yangilandi
    });

    res.json({ summary: completion.choices[0].message.content });

  } catch (error) {
    console.error("Summary Error:", error);
    res.json({ summary: "Hisobot yaratishda xatolik." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishlayapti`));