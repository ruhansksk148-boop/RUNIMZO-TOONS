
const fs = require("fs");
const path = require("path");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const correctPassword = process.env.QUESTION_CENTER_PASSWORD;

  if (!correctPassword) {
    return res.status(500).json({
      error: "Question Center password is not configured."
    });
  }

  const { password, action, course } = req.body || {};

  if (
    typeof password !== "string" ||
    password !== correctPassword
  ) {
    return res.status(401).json({
      error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করো।"
    });
  }

  if (action === "login") {
    return res.status(200).json({
      success: true,
      message: "Question Center unlocked."
    });
  }

  if (action === "questions") {
    const allowedCourses = ["human", "animal", "combo"];

    if (!allowedCourses.includes(course)) {
      return res.status(400).json({
        error: "Invalid course."
      });
    }

    try {
      const dataPath = path.join(
        process.cwd(),
        "private",
        "ZOGGGT_AI_WEBSITE_DATA.json"
      );

      const database = JSON.parse(
        fs.readFileSync(dataPath, "utf8")
      );

      const topics = database.courses?.[course];

      if (!topics || typeof topics !== "object") {
        return res.status(404).json({
          error: "Questions not found."
        });
      }

      const questions = Object.keys(topics);

      return res.status(200).json({
        success: true,
        course,
        total: questions.length,
        questions
      });
    } catch (error) {
      return res.status(500).json({
        error: "Question database could not be loaded."
      });
    }
  }

  return res.status(400).json({
    error: "Invalid action."
  });
};
