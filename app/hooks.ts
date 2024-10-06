
import Replicate from "replicate";

const replicate = new Replicate({
    auth: process.env.NEXT_PUBLIC_REPLICATE_API_KEY,
});

export const generateImage = async (userPrompt: string) => {
    console.log("12312321")

    const input = {
        steps: 25,
        prompt: userPrompt,
        guidance: 3,
        interval: 2,
        aspect_ratio: "1:1",
        output_format: "webp",
        output_quality: 80,
        safety_tolerance: 2
    };
    const imageUrl = await replicate.run("black-forest-labs/flux-schnell", { input });
    console.log(imageUrl);
    console.log(imageUrl as string[]);
    return (imageUrl as string[])[0] as string;
};