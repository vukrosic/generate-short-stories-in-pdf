import { NextResponse } from "next/server";
import Replicate, { WebhookEventType } from "replicate";

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

const WEBHOOK_HOST = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NGROK_HOST;

export async function POST(request) {
    try {
        if (!process.env.REPLICATE_API_TOKEN) {
            throw new Error(
                'The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it.'
            );
        }
        const { prompt } = await request.json();

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        const options = {
            model: "black-forest-labs/flux-schnell",
            input: { prompt },
            webhook: "",
            webhook_events_filter: ["" as WebhookEventType]
        }
        if (WEBHOOK_HOST) {
            options.webhook = `${WEBHOOK_HOST}/api/webhooks`
            options.webhook_events_filter = ["start", "completed"]
        }

        const prediction = await replicate.predictions.create(options);
        // const prediction1 = await replicate.run("black-forest-labs/flux-schnell", options);
        console.log(prediction)
        if (prediction?.error) {
            console.error("Replicate API error:", prediction.error);
            return NextResponse.json({ error: prediction.error }, { status: 500 });
        }
        return NextResponse.json(prediction, { status: 201 });
    } catch (error) {
        console.error("Unexpected error:", error);
        return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
    }
}