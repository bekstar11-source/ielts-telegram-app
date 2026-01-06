import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
// Timeoutni oshiramiz (katta testlar uchun)
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

app.get('/', (req, res) => res.send('AI Server (Grammar Strict) ishlayapti! ✅'));

app.post('/check-quiz', async (req, res) => {
  const { quizData } = req.body;

  if (!quizData || !Array.isArray(quizData)) {
    return res.status(400).json({ error: "Ma'lumotlar noto'g'ri formatda" });
  }

  console.log(`Checking ${quizData.length} items...`);

  try {
    // AI ga yuboriladigan ma'lumot
    const quizText = JSON.stringify(quizData.map((item, index) => ({
      id: index,
      savol: item.question,
      ustoz_javobi: item.correctTranslation,
      oquvchi_javobi: item.userAnswer
    })));

    const prompt = `
      Sen qattiqqo'l IELTS Examiner'san. Quyida o'quvchi javoblari keltirilgan.
      Har bir javobni alohida tahlil qil.

      MA'LUMOTLAR:
      ${quizText}

      BAHOLASH MEZONI (RUBRIC):
      1. **5 ball (Perfect):** Ma'no to'liq to'g'ri VA Grammatika/So'z boyligi xatosiz.
      2. **4 ball (Good):** Ma'no to'g'ri, lekin kichik grammatik xato (artikl, spelling) yoki so'z tanlashda noaniqlik bor.
      3. **3 ball (Average):** Ma'no tushunarli, lekin jiddiy grammatik xatolar (zamonlar noto'g'ri, so'z tartibi buzilgan).
      4. **1-2 ball (Poor):** Ma'no noto'g'ri yoki tarjima qilinmagan.

      MUHIM:
      - Agar o'quvchi "I go" o'rniga "I going" desa, bu jiddiy grammatik xato -> 3 ball qo'y.
      - Izohda aynan qaysi grammatik qoida buzilganini ayt (Masalan: "To be fe'li tushib qolgan").

      JAVOB FORMATI (JSON bo'lishi SHART):
      {
        "results": [
          {
            "id": 0,
            "score": 0,
            "feedback": "Grammatik va leksik izoh...",
            "correction": "To'g'ri javob..."
          }
        ]
      }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" }, // JSON majburiy
      temperature: 0.2,
    });

    // 🔥 XATOLIKNI TUZATISH: AI javobini tozalash
    let rawContent = completion.choices[0].message.content;
    // Ba'zan AI markdown qo'shadi, ularni olib tashlaymiz
    rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

    const aiResponse = JSON.parse(rawContent);
    
    console.log("AI muvaffaqiyatli tekshirdi.");
    res.json(aiResponse.results);

  } catch (error) {
    console.error("AI Server Xatosi:", error);
    // Frontendga aniq xato qaytarish
    res.status(500).json({ error: "Serverda tahlil qilishda xatolik bo'ldi. Qaytadan urining." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishlayapti`));