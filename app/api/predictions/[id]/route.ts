// Step 2: Update the GET function in api/predictions/[id]/route.ts
import { NextResponse } from "next/server";
import Replicate from "replicate";

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const { id } = params;
    const apiKey = request.headers.get('Authorization')?.split(' ')[1];

    if (!apiKey) {
        return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const replicate = new Replicate({
        auth: apiKey,
    });

    try {
        const prediction = await replicate.predictions.get(id);

        if (prediction?.error) {
            return NextResponse.json({ error: prediction.error }, { status: 500 });
        }

        return NextResponse.json(prediction);
    } catch (error) {
        console.error("Error fetching prediction:", error);
        return NextResponse.json({ error: (error as { message: string }).message || "An error occurred while fetching the prediction" }, { status: 500 });
    }
}