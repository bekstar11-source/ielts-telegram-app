import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Loglarni ko'rish (Debug uchun)
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

app.get('/', (req, res) => res.send('AI Server (Teacher-Match Logic) ishlayapti! ✅'));

// JAVOBNI TEKSHIRISH VA USTOZ BILAN SOLISHTIRISH
app.post('/check-answer', async (req, res) => {
  const { original, userAnswer, correctTranslation } = req.body;

  // Konsolda tekshirish
  console.log("------------------------------------------------");
  console.log("Savol:", original);
  console.log("Ustoz:", correctTranslation);
  console.log("O'quvchi:", userAnswer);

  if (!original || !userAnswer) {
    return res.status(400).json({ error: "Ma'lumotlar yetarli emas" });
  }

  try {
    const prompt = `
      Sen adolatli til o'qituvchisisan. 
      Vazifa: O'quvchining tarjimasini tekshirish.

      1. Original gap (EN): "${original}"
      2. Ustozning tarjimasi (UZ): "${correctTranslation}"
      3. O'quvchining javobi (UZ): "${userAnswer}"

      BAHOLASH QOIDASI (JUDAM MUHIM):
      - Agar o'quvchining javobi ustozniki bilan deyarli BIR XIL bo'lsa -> 5 ball.
      - Agar o'quvchi SINONIMLAR ishlatsa (masalan: "avtomobil" o'rniga "mashina", "yaxshi ko'raman" o'rniga "sevaman") va MA'NO SAQLANSA -> 5 ball.
      - Agar ma'no to'g'ri, lekin kichik grammatik xato bo'lsa -> 4 ball.
      - Agar ma'no o'zgargan yoki tarjima noto'g'ri bo'lsa -> 3 yoki undan past.

      Javobni JSON formatida qaytar:
      {
        "score": 5,
        "feedback": "Qisqa izoh: Nega bu bahoni qo'yding? (O'zbek tilida)",
        "correction": "To'g'ri javobni ko'rsat (Ustoznikini yoki undan ham yaxshisini)"
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini", 
      response_format: { type: "json_object" },
      temperature: 0.2, // Aniq javob uchun past harorat
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);
    console.log("AI Xulosasi:", aiResult); // Log
    res.json(aiResult);

  } catch (error) {
    console.error("AI Xatoligi:", error);
    res.status(500).json({ error: "Serverda xatolik yuz berdi" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishlayapti`));