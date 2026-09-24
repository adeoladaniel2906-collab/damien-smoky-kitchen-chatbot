import { officialMenuContext } from "./chatbot/knowledge.ts";
import { getChatbotReply, getManualReply } from "./chatbot/reply.ts";

interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages?: unknown;
  message?: unknown;
};

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 12_000;
const MAX_TOTAL_LENGTH = 60_000;

const unavailableReply =
  "That information isn't currently available. Please contact Damien's Smoky Kitchen on WhatsApp for assistance.";

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "system" ||
      message.role === "user" ||
      message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= MAX_MESSAGE_LENGTH
  );
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function fallbackReply(question: string): string {
  return getChatbotReply(question) || unavailableReply;
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  let messages: ChatMessage[];
  if (Array.isArray(body.messages)) {
    if (
      body.messages.length === 0 ||
      body.messages.length > MAX_MESSAGES ||
      !body.messages.every(isChatMessage)
    ) {
      return Response.json(
        { error: "Messages must have a supported role and non-empty content." },
        { status: 400 },
      );
    }
    messages = body.messages;
  } else if (typeof body.message === "string" && body.message.trim()) {
    messages = [{ role: "user", content: body.message.trim() }];
  } else {
    return Response.json(
      { error: "Request body must include a messages array." },
      { status: 400 },
    );
  }

  if (
    messages.reduce((total, message) => total + message.content.length, 0) >
    MAX_TOTAL_LENGTH
  ) {
    return Response.json(
      { error: "The conversation is too long." },
      { status: 400 },
    );
  }

  const question = [...messages]
    .reverse()
    .find((message) => message.role === "user")?.content.trim();
  if (!question) return textResponse(unavailableReply);

  // Deterministic answers remain the default path and do not consume AI requests.
  const manualReply = getManualReply(question);
  if (manualReply !== null) return textResponse(manualReply);

  const systemMessage: ChatMessage = {
    role: "system",
    content: `You are Damien's Smoky Kitchen assistant. Answer naturally, politely, and briefly. Use ONLY the official restaurant knowledge below. Never invent menu items, prices, delivery fees or times, nutritional or allergy information, halal certification, promotions, policies, orders, or reservations. If the answer is not in the knowledge, say it is not currently available and direct the customer to WhatsApp. Do not claim an order or reservation was completed.\n\nOFFICIAL RESTAURANT KNOWLEDGE:\n${officialMenuContext}`,
  };

  try {
    const aiResponse = await env.AI.run(MODEL, {
      messages: [
        systemMessage,
        ...messages.filter((message) => message.role !== "system"),
      ],
    });
    const reply =
      typeof aiResponse === "object" &&
      aiResponse !== null &&
      "response" in aiResponse
        ? String(aiResponse.response)
        : String(aiResponse);

    return reply.trim()
      ? textResponse(reply.trim())
      : textResponse(fallbackReply(question));
  } catch (error) {
    console.error("Workers AI request failed:", error);
    return textResponse(fallbackReply(question));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
      }
      if (request.method === "POST") return handleChat(request, env);
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
