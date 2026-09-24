interface Env {
  AI: Ai;
  ASSETS: Fetcher;
}

interface ChatRequest {
  message?: string;
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);

    // Keep the existing frontend/API contract.
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = (await request.json()) as ChatRequest;
        const message = body.message?.trim();

        if (!message) {
          return Response.json(
            { error: "Message is required." },
            { status: 400 }
          );
        }

        const aiResponse = await env.AI.run(
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          {
            messages: [
              {
                role: "system",
                content: `
You are Kitchen Assistant for Damien's Smoky Kitchen.

Your response style:
- Natural
- Polite
- Brief

IMPORTANT RULES:
- Only provide information supported by the official restaurant knowledge supplied to you.
- Never invent menu items.
- Never invent prices.
- Never invent delivery fees.
- Never invent delivery times.
- Never invent nutritional information.
- Never invent allergy information.
- Never invent halal certification.
- Never invent promotions.
- Never invent restaurant policies.
- If the official information does not answer the customer's question, say that the information is not currently available rather than guessing.
- Do not claim an order or reservation has been completed unless the system actually completed it.

Restaurant:
Damien's Smoky Kitchen

Location:
The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State.

Hours:
9:00 AM - 9:00 PM.

Orders:
Customers can order through the website or WhatsApp.

Delivery:
Delivery is within Lagos State only.
Typical delivery time is approximately 30 minutes and may take up to 1 hour.

Reservations:
Reservations require 2 weeks' advance notice.

Drive-through:
There is no drive-through.

Use the official menu and restaurant information already present in the application as the source of truth.
                `.trim()
              },
              {
                role: "user",
                content: message
              }
            ]
          }
        );

        return Response.json({
          reply:
            typeof aiResponse === "object" &&
            aiResponse !== null &&
            "response" in aiResponse
              ? aiResponse.response
              : String(aiResponse)
        });
      } catch (error) {
        console.error("Cloudflare AI error:", error);

        return Response.json(
          {
            reply:
              "I'm unable to answer that right now. Please try again or contact Damien's Smoky Kitchen directly."
          },
          { status: 200 }
        );
      }
    }

    // Everything else goes to the React SPA assets.
    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
