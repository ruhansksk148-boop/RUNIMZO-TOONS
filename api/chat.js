
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed"
    });
  }

  try {
    const { question, course = "combo" } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(400).json({
        error: "Please enter a question."
      });
    }

    if (!["human", "animal", "combo"].includes(course)) {
      return res.status(400).json({
        error: "Invalid course."
      });
    }

    const fs = await import("fs");
    const path = await import("path");

    const files = fs.readdirSync(process.cwd());

    const dataFile = files.find(
      name =>
        name.startsWith("ZOGGGT_AI_WEBSITE_DATA") &&
        name.endsWith(".json")
    );

    if (!dataFile) {
      return res.status(500).json({
        error: "ZOGGGT AI lesson database not found."
      });
    }

    const data = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), dataFile),
        "utf8"
      )
    );

    const lessons = data.courses[course] || [];

    const words = question
      .toLowerCase()
      .replace(/[?।,!.]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 1);

    let bestLesson = null;
    let bestScore = 0;

    for (const lesson of lessons) {
      const topic = lesson.topic.toLowerCase();
      let score = 0;

      if (question.toLowerCase().includes(topic)) {
        score += 10;
      }

      for (const word of words) {
        if (topic.includes(word)) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestLesson = lesson;
      }
    }

    if (!bestLesson || bestScore < 4) {
      return res.status(200).json({
        ai: "ZOGGGT AI 2.0",
        answer: "দুঃখিত! এই প্রশ্নের উত্তর আমার সংরক্ষিত Course Database-এ পাওয়া যায়নি।",
        found: false
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured."
      });
    }

    const model =
      process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const prompt = `
You are ZOGGGT AI 2.0, a cartoon drawing teacher.

Answer the student's question using ONLY the lesson information below.
Do not invent facts or unrelated lessons.
Explain simply and clearly.
Use the student's question language when possible.

LESSON:
${JSON.stringify(bestLesson)}

STUDENT QUESTION:
${question}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: "Gemini service error.",
        details: result.error?.message || "Request failed"
      });
    }

    const answer =
      result.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("\n");

    if (!answer) {
      return res.status(502).json({
        error: "AI did not return an answer."
      });
    }

    return res.status(200).json({
      ai: "ZOGGGT AI 2.0",
      course,
      topic: bestLesson.topic,
      answer,
      found: true
    });

  } catch (error) {
    return res.status(500).json({
      error: "Backend error.",
      details: error.message
    });
  }
        }
                                
