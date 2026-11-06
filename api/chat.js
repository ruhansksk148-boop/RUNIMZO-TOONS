
import fs from "node:fs";
import path from "node:path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed"
    });
  }

  try {
    const { question, course = "combo" } = req.body || {};

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        error: "Please enter a question."
      });
    }

    if (!["human", "animal", "combo"].includes(course)) {
      return res.status(400).json({
        error: "Invalid course."
      });
    }

    // Find the ZOGGGT AI database
    const root = process.cwd();
    const possibleFolders = [
      root,
      path.join(root, "api")
    ];

    let databasePath = null;

    for (const folder of possibleFolders) {
      if (!fs.existsSync(folder)) continue;

      const files = fs.readdirSync(folder);

      const match = files.find(name =>
        name.startsWith("ZOGGGT_AI_WEBSITE_DATA") &&
        name.endsWith(".json")
      );

      if (match) {
        databasePath = path.join(folder, match);
        break;
      }
    }

    if (!databasePath) {
      return res.status(500).json({
        error: "ZOGGGT AI lesson database not found."
      });
    }

    const data = JSON.parse(
      fs.readFileSync(databasePath, "utf8")
    );

    const lessons = data?.courses?.[course];

    if (!Array.isArray(lessons)) {
      return res.status(500).json({
        error: "Course database is missing or invalid."
      });
    }

    // Normalize Bengali and English questions
    function normalize(value) {
      return String(value)
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[?।,!.:;'"()[\]{}]/g, " ")
        .replace(/\b(ki|kee|what|is|the|kya|hai)\b/g, " ")
        .replace(/কী|কি|হলো|হয়|হয়|মানে/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const questionText = normalize(question);
    const questionWords = questionText
      .split(" ")
      .filter(word => word.length > 1);

    let bestLesson = null;
    let bestScore = 0;

    for (const lesson of lessons) {
      if (!lesson || typeof lesson.topic !== "string") {
        continue;
      }

      const topicText = normalize(lesson.topic);
      const topicWords = topicText
        .split(" ")
        .filter(word => word.length > 1);

      let score = 0;

      if (questionText === topicText) {
        score += 20;
      }

      if (
        topicText &&
        questionText.includes(topicText)
      ) {
        score += 10;
      }

      for (const word of questionWords) {
        if (topicWords.includes(word)) {
          score += 3;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestLesson = lesson;
      }
    }

    if (!bestLesson || bestScore < 3) {
      return res.status(200).json({
        ai: "ZOGGGT AI 2.0",
        course,
        answer:
          "দুঃখিত! এই প্রশ্নের উত্তর আমার সংরক্ষিত Course Database-এ পাওয়া যায়নি।",
        found: false
      });
    }

    const steps = Array.isArray(bestLesson.teaching_steps)
      ? bestLesson.teaching_steps
      : Array.isArray(bestLesson["Teaching Steps"])
        ? bestLesson["Teaching Steps"]
        : [];

    const practice =
      bestLesson.practice_task ||
      bestLesson["Practice Task"] ||
      "";

    let answer = bestLesson.answer || "এই বিষয়ে পাঠের তথ্য পাওয়া গেছে।";

    if (steps.length > 0) {
      answer += "\n\nশেখার ধাপ:\n";
      answer += steps
        .map((step, index) => `${index + 1}. ${step}`)
        .join("\n");
    }

    if (practice) {
      answer += "\n\nPractice Task:\n" + practice;
    }

    return res.status(200).json({
      ai: "ZOGGGT AI 2.0",
      course,
      topic: bestLesson.topic,
      answer,
      teaching_steps: steps,
      practice_task: practice,
      found: true
    });

  } catch (error) {
    console.error("ZOGGGT AI ERROR:", error);

    return res.status(500).json({
      error: "Backend error.",
      details: error.message
    });
  }
}
