import { GET as verifyWebhook, POST as receiveWebhook } from "@/services/whatsapp-webhook";

export const runtime = "nodejs";

export const GET = verifyWebhook;
export const POST = receiveWebhook;
