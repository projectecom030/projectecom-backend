const express = require("express")
const OpenAI = require("openai")

const router = express.Router()

const SYSTEM_PROMPT =
  "You are BudgetProperty's helpful assistant. Answer questions about property listings, posting properties, subscriptions, and general platform help. Be concise and friendly."

router.post("/chat", async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "OpenAI API key is not configured.",
      })
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const lastUser = messages[messages.length - 1]?.content?.trim()

    if (!lastUser) {
      return res.status(400).json({
        success: false,
        message: "Message is required.",
      })
    }

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role,
          content: String(m.content || "").slice(0, 2000),
        })),
      ],
      max_output_tokens: 300,
      temperature: 0.4,
    })

    const text = response.output_text || ""

    return res.json({
      success: true,
      message: text,
    })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
