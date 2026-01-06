import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// .env faylidagi parollarni yuklash
dotenv.config();

const app = express();

// Middleware (Frontend bilan bog'lanish va JSON o'qish uchun)
app.use(cors());
app.use(express.json());

// OpenAI ni sozlash
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

// 1. Server ishlayotganini tekshirish uchun (Health Check)
app.get('/', (req, res) => {
  res.send('IELTS AI Teacher Serveri muvaffaqiyatli ishlayapti! ✅');
});

// 2. Bitta gapni tekshirish (Check Single Answer)
app.post('/check-answer', async (req, res) => {
  const { original, userAnswer } = req.body;

  // Ma'lumotlar kelmasa xato qaytarish
  if (!original || !userAnswer) {
    return res.status(400).json({ error: "Ma'lumotlar to'liq emas" });
  }

  try {
    const prompt = `
      Sen professional IELTS instruktorisan. O'quvchi inglizcha gapni o'zbekchaga tarjima qildi.
      
      Inglizcha gap: "${original}"
      O'quvchining tarjimasi: "${userAnswer}"
      
      Vazifang:
      1. Tarjimani 1 dan 5 gacha bahola (score). 
      2. Agar tarjima ma'nosiz bo'lsa yoki so'zma-so'z xato bo'lsa past ball qo'y.
      3. "feedback" qismida qisqa va tushunarli grammatik izoh ber (O'zbek tilida).
      4. "correction" qismida eng to'g'ri va adabiy o'zbekcha tarjimani yoz.
      
      Javobni FAQAT mana shu JSON formatida qaytar:
      {
        "score": 4,
        "feedback": "...",
        "correction": "..."
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-3.5-turbo", // Arzonroq va tez. Sifatliroq kerak bo'lsa "gpt-4o"
      response_format: { type: "json_object" },
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);
    res.json(aiResult);

  } catch (error) {
    console.error("OpenAI Xatoligi (/check-answer):", error);
    res.status(500).json({ 
      error: "AI bilan bog'lanishda xatolik",
      details: error.message 
    });
  }
});

// 3. Yakuniy Xulosa Yasash (Create Summary for Teacher)
app.post('/create-summary', async (req, res) => {
  const { history } = req.body;

  if (!history || history.length === 0) {
    return res.json({ summary: "Tahlil qilish uchun yetarli ma'lumot yo'q." });
  }

  try {
    // Tarixni qisqartirib string holiga keltiramiz (token tejash uchun)
    const historyText = JSON.stringify(history.map(item => ({
      savol: item.question,
      javob: item.userAnswer,
      baho: item.score
    })));

    const prompt = `
      Sen IELTS o'qituvchisiga yordamchisining. O'quvchi testni tugatdi.
      Quyida uning javoblari tarixi keltirilgan:
      ${historyText}

      Vazifang:
      Ustoz uchun o'quvchining darajasi haqida QISQA hisobot (Report) yoz.
      
      Talablar:
      1. O'quvchining kuchli va kuchsiz tomonlarini aniqla (grammatika, so'z boyligi).
      2. Qaysi mavzuda (zamonlar, predloglar, so'z tartibi) ko'p xato qilganini ayt.
      3. Faqat O'zbek tilida yoz.
      4. Ortiqcha "Salom", "Rahmat" so'zlarisiz, faqat faktlarni yoz.
      
      Namuna: "O'quvchining so'z boyligi yaxshi, lekin Present Perfect zamonini ishlatishda qiynalmoqda. Gap tuzilishi ba'zan buzilgan."
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-3.5-turbo",
    });

    const summaryText = completion.choices[0].message.content;
    
    // Natijani frontendga qaytaramiz
    res.json({ summary: summaryText });

  } catch (error) {
    console.error("OpenAI Xatoligi (/create-summary):", error);
    res.json({ summary: "Xulosa yaratishda texnik xatolik bo'ldi, lekin ballar saqlandi." });
  }
});

// Serverni ishga tushirish
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server ${PORT}-portda ishlayapti.`);
});