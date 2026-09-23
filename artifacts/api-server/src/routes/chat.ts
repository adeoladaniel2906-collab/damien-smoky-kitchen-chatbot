import OpenAI from "openai";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const maxMessages = 50;
const maxMessageLength = 12_000;
const maxTotalLength = 60_000;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;

  const message = value as Record<string, unknown>;
  return (
    (message.role === "system" ||
      message.role === "user" ||
      message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= maxMessageLength
  );
}

function getOpenAIClient(): OpenAI {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiKey = process.env.CLOUDFLARE_API_KEY;

  if (!accountId || !apiKey) {
    throw new Error("Cloudflare AI server configuration is incomplete.");
  }

  return new OpenAI({
    apiKey,
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
  });
}

router.post("/chat", async (req, res) => {
  const body = req.body as { messages?: unknown };

  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: "Request body must include a messages array." });
    return;
  }

  if (body.messages.length === 0) {
    res.status(400).json({ error: "At least one message is required." });
    return;
  }

  if (body.messages.length > maxMessages || !body.messages.every(isChatMessage)) {
    res.status(400).json({
      error: "Messages must have a supported role and non-empty content.",
    });
    return;
  }

  const messages = body.messages as ChatMessage[];
  if (
    messages.reduce((total, message) => total + message.content.length, 0) >
    maxTotalLength
  ) {
    res.status(400).json({ error: "The conversation is too long." });
    return;
  }

  let completion: Awaited<
    ReturnType<OpenAI["chat"]["completions"]["create"]>
  >;
  try {
    completion = await getOpenAIClient().chat.completions.create({
      model,
      messages,
      stream: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI error";
    const status = message.includes("configuration is incomplete") ? 503 : 502;
    logger.error({ err: message, status }, "Cloudflare AI request failed");
    res.status(status).json({
      error:
        status === 503
          ? "The AI service is not configured."
          : "The AI service is temporarily unavailable.",
    });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) res.write(content);
    }
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown stream error";
    logger.error({ err: message }, "Cloudflare AI stream failed");
    if (!res.headersSent) {
      res.status(502).json({ error: "The AI response could not be completed." });
    } else {
      res.end();
    }
  }
});

export default router;
