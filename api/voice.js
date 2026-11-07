
export default async function handler(req, res) {
  const allowedOrigins = [
    "https://ruhansksk148-boop.github.io",
    "https://runimzo-toons.vercel.app"
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Google TTS API Key is not configured."
    });
  }

  try {
    // বাংলা ভয়েসের তালিকা
    if (req.method === "GET") {
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?languageCode=bn-IN&key=${apiKey}`
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(502).json({
          error: "Voice list service error",
          details: data.error?.message
        });
      }

      const voices = (data.voices || [])
        .filter(v => v.languageCodes?.includes("bn-IN"))
        .map(v => ({
          name: v.name,
          gender: v.ssmlGender,
          language: "bn-IN"
        }));

      return res.status(200).json({
        total: voices.length,
        voices
      });
    }

    // গল্প থেকে MP3 তৈরি
    if (req.method === "POST") {
      const { text, voiceName } = req.body || {};

      if (!text || typeof text !== "string") {
        return res.status(400).json({
          error: "Please enter your story."
        });
      }

      if (text.length > 3000) {
        return res.status(400).json({
          error: "Maximum 3000 characters allowed."
        });
      }

      if (!voiceName || typeof voiceName !== "string") {
        return res.status(400).json({
          error: "Please select a voice."
        });
      }

      // Google-এর তালিকায় ভয়েসটি আছে কি না যাচাই
      const listResponse = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?languageCode=bn-IN&key=${apiKey}`
      );

      const listData = await listResponse.json();

      if (!listResponse.ok) {
        return res.status(502).json({
          error: "Could not verify Bengali voices."
        });
      }

      const validVoice = (listData.voices || []).find(
        v => v.name === voiceName &&
             v.languageCodes?.includes("bn-IN")
      );

      if (!validVoice) {
        return res.status(400).json({
          error: "Invalid Bengali voice."
        });
      }

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: "bn-IN",
              name: voiceName
            },
            audioConfig: {
              audioEncoding: "MP3"
            }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(502).json({
          error: "Speech generation failed.",
          details: data.error?.message
        });
      }

      return res.status(200).json({
        success: true,
        audioContent: data.audioContent,
        format: "mp3",
        fileName: "zogg_gt_story.mp3"
      });
    }

    return res.status(405).json({
      error: "Only GET and POST are allowed."
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error.",
      details: error.message
    });
  }
}
