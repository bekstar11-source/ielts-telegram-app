import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// 1. Timeoutni oshiramiz va Payload hajmini kattalashtiramiz
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Katta ma'lumotlar uchun

// Log: Har bir so'rovni ko'rish
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

app.get('/', (req, res) => res.send('AI Server (Debug Mode) ishlayapti! ✅'));

// 🔥 JAVOBLARNI TEKSHIRISH (DEBUG VERSIYASI)
app.post('/check-quiz', async (req, res) => {
  const { quizData } = req.body;

  // 1. Ma'lumot borligini tekshirish
  if (!quizData || !Array.isArray(quizData)) {
    console.error("XATO: quizData noto'g'ri formatda keldi");
    return res.status(400).json({ error: "Ma'lumotlar noto'g'ri formatda" });
  }

  console.log(`--> ${quizData.length} ta savol tekshirishga keldi...`);

  try {
    // 2. Promptni tayyorlash
    const quizText = JSON.stringify(quizData.map((item, index) => ({
      id: index,
      savol: item.question,
      ustoz: item.correctTranslation,
      oquvchi: item.userAnswer
    })));

    const prompt = `
      Sen IELTS Examiner'san. Quyidagi testni tekshir.
      
      INPUT:
      ${quizText}

      QOIDALAR:
      - 5 ball: Ma'no va Grammatika to'g'ri.
      - 4 ball: Kichik xato.
      - 3 ball: Grammatik xato (zamon, fe'l).
      - 1-2 ball: Noto'g'ri.

      MUHIM: Javobing FAQAT va FAQAT toza JSON bo'lsin. Hech qanday so'z qo'shma. Markdown (\\\`\\\`\\\`) ishlatma.
      
      FORMAT:
      {
        "results": [
          { "id": 0, "score": 0, "feedback": "...", "correction": "..." }
        ]
      }
    `;

    // 3. AI ga so'rov yuborish
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" }, // Majburiy JSON
      temperature: 0.2,
    });

    let rawContent = completion.choices[0].message.content;
    console.log("--> AI Javob qaytardi (Raw):", rawContent.substring(0, 100) + "..."); // Logga yozamiz

    // 4. JSONni tozalash (Eng muhim qism)
    // Ba'zan AI baribir ```json deb yozadi, shuni tozalaymiz
    if (rawContent.includes("```")) {
      rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "");
    }
    
    // JSON qayerdan boshlanib qayerda tugashini topamiz
    const jsonStart = rawContent.indexOf('{');
    const jsonEnd = rawContent.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      rawContent = rawContent.substring(jsonStart, jsonEnd + 1);
    }

    // 5. Parse qilish
    let parsedData;
    try {
      parsedData = JSON.parse(rawContent);
    } catch (parseError) {
      console.error("JSON PARSE ERROR:", parseError);
      console.error("BUZILGAN CONTENT:", rawContent);
      return res.status(500).json({ error: "AI javobini o'qib bo'lmadi. Qayta urining." });
    }

    // 6. Natijani tekshirish
    if (!parsedData.results || !Array.isArray(parsedData.results)) {
      console.error("FORMAT XATOSI: 'results' array yo'q");
      return res.status(500).json({ error: "AI formati noto'g'ri." });
    }

    console.log("--> Muvaffaqiyatli yuborildi ✅");
    res.json(parsedData.results);

  } catch (error) {
    console.error("SERVER XATOSI:", error);
    res.status(500).json({ error: "Serverda ichki xatolik: " + error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishlayapti`));