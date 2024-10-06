// Step 1: Update the POST function in api/predictions/route.ts
import { NextResponse } from "next/server";
import Replicate, { WebhookEventType } from "replicate";

const WEBHOOK_HOST = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NGROK_HOST;

export async function POST(request: Request) {
    try {
        const { prompt, apiKey } = await request.json();

        if (!prompt || !apiKey) {
            return NextResponse.json({ error: "Prompt & API KEY are required" }, { status: 400 });
        }

        const replicate = new Replicate({
            auth: apiKey,
        });

        const options = {
            model: "black-forest-labs/flux-schnell",
            input: { prompt },
            webhook: "",
            webhook_events_filter: ["" as WebhookEventType]
        };

        if (WEBHOOK_HOST) {
            options.webhook = `${WEBHOOK_HOST}/api/webhooks`;
            options.webhook_events_filter = ["start", "completed"];
        }

        const prediction = await replicate.predictions.create(options);

        if (prediction?.error) {
            console.error("Replicate API error:", prediction.error);
            return NextResponse.json({ error: prediction.error }, { status: 500 });
        }
        return NextResponse.json(prediction, { status: 201 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: (error as { message: string }).message || "An unexpected error occurred" }, { status: 500 });
    }
}