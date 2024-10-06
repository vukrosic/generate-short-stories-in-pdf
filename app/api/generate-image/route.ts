import { NextApiRequest, NextApiResponse } from 'next';
import Replicate from 'replicate';

const replicate = new Replicate({
    auth: process.env.NEXT_PUBLIC_REPLICATE_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { prompt } = req.body;

        try {
            const imageUrl = await replicate.run('black-forest-labs/flux-schnell', {
                input: { prompt, steps: 25, guidance: 3 }
            });

            return res.status(200).json({ imageUrl });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Image generation failed' });
        }
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}
