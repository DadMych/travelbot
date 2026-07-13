import { getWebhookHandler } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("Bot not configured", { status: 503 });
  }

  try {
    const handler = getWebhookHandler();
    return handler(request);
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("Webhook error", { status: 500 });
  }
}

export async function GET() {
  return new Response("Telegram webhook endpoint", { status: 200 });
}
