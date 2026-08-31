import { Router, type IRouter } from "express";
import OpenAI from "openai";
import {
  ChatWithDamienBody,
  ChatWithDamienResponse,
} from "@workspace/api-zod";
import { DAMIENS_SMOKY_KITCHEN_SYSTEM_PROMPT } from "../lib/chatbot-knowledge";

const router: IRouter = Router();

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function getOpenAIErrorDetails(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    type?: unknown;
  };

  return {
    ...(typeof candidate.status === "number" ? { status: candidate.status } : {}),
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
    ...(typeof candidate.type === "string" ? { type: candidate.type } : {}),
  };
}

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = ChatWithDamienBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid chatbot message");
    res.status(400).json({ error: "Please provide a chat message." });
    return;
  }

  const openai = getOpenAIClient();
  if (!openai) {
    req.log.error("OPENAI_API_KEY is not configured");
    res.status(503).json({
      error: "The kitchen assistant is temporarily unavailable. Please try again later.",
    });
    return;
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions: DAMIENS_SMOKY_KITCHEN_SYSTEM_PROMPT,
      input: parsed.data.message,
      max_output_tokens: 300,
      store: false,
    });
    const reply = response.output_text.trim();

    if (!reply) {
      req.log.error("OpenAI returned an empty chatbot response");
      res.status(502).json({
        error: "The kitchen assistant returned an empty response. Please try again.",
      });
      return;
    }

    res.json(ChatWithDamienResponse.parse({ reply }));
  } catch (error) {
    req.log.error(
      getOpenAIErrorDetails(error),
      "OpenAI chatbot request failed",
    );
    res.status(502).json({
      error: "The kitchen assistant is temporarily unavailable. Please try again.",
    });
  }
});

export default router;