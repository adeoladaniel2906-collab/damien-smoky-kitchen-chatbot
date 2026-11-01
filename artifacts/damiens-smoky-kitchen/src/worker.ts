import { officialMenuContext } from "./chatbot/knowledge.ts";
import { getChatbotReply, getManualReply } from "./chatbot/reply.ts";

interface Env {
  AI: Ai;
  ASSETS: Fetcher;
  CHAT_RATE_LIMIT: RateLimit;
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
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_TOTAL_LENGTH = 8_000;
const MAX_BODY_BYTES = 16_384;

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
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  const clientKey = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rate = await env.CHAT_RATE_LIMIT.limit({ key: clientKey });
  if (!rate.success) {
    return Response.json({ error: "Too many messages. Please try again shortly." }, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
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

  if (messages.some((message) => message.role === "system")) {
    return Response.json({ error: "System messages are not accepted." }, { status: 400 });
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

  if (messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "The latest message must be from the user." }, { status: 400 });
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
    const securityHeaders = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
    };
    const url = new URL(request.url);

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: securityHeaders });
      }
      if (request.method === "POST") {
        const response = await handleChat(request, env);
        const headers = new Headers(response.headers);
        for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
        return new Response(response.body, { status: response.status, headers });
      }
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
