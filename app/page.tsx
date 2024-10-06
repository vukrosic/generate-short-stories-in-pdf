"use client"

import { useState } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Groq from 'groq-sdk';
import Replicate from "replicate";
import { jsPDF } from "jspdf";

// Initialize Groq and Replicate
const groq = new Groq({ apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY, dangerouslyAllowBrowser: true });
const replicate = new Replicate({
  //auth: process.env.NEXT_PUBLIC_REPLICATE_API_KEY,
});

const Home: NextPage = () => {
  const [prompt, setPrompt] = useState('');
  const [story, setStory] = useState('');
  const [imageUrl, setImageUrl] = useState<"string" | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const generateStory = async (userPrompt: string) => {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: `Write a short story based on this prompt: ${userPrompt}` }],
      model: "llama-3.1-8b-instant",
      temperature: 1,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
      stop: null
    });

    return chatCompletion.choices[0]?.message?.content || '';
  };

  const generateImage = async (userPrompt: string) => {
    console.log("12312321")
    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: { prompt: `Story scene: ${userPrompt}` }
    });
    console.log(output)
    if (typeof output === 'string')
      return output;
    //return output as string;
  };

  const generatePDF = (storyText: string, imageUrl: string) => {
    const pdf = new jsPDF();

    // Add image
    pdf.addImage(imageUrl, 'JPEG', 10, 10, 190, 100);

    // Add text
    pdf.setFontSize(12);
    pdf.text(storyText, 10, 120, { maxWidth: 190 });

    // Save the PDF
    pdf.save('horror_story.pdf');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const generatedStory = await generateStory(prompt);
      setStory(generatedStory);
      console.log(generatedStory)
      const generatedImageUrl = await generateImage(prompt);
      setImageUrl(generatedImageUrl);

      // generatePDF(generatedStory, generatedImageUrl || "");
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <Head>
        <title>Horror Story Generator</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-3xl font-extrabold text-gray-900">Horror Story Generator</h2>
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                  <div className="rounded-md shadow-sm -space-y-px">
                    <div>
                      <input
                        type="text"
                        required
                        className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                        placeholder="Enter your horror story prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      {loading ? 'Generating...' : 'Generate Horror Story'}
                    </button>
                  </div>
                </form>
              </div>
              {story && imageUrl && (
                <div className="py-8">
                  <h3 className="text-xl font-bold mb-4">Generated Content:</h3>
                  <img src={imageUrl} alt="Generated horror scene" className="w-full mb-4 rounded-lg shadow-lg" />
                  <p className="text-gray-700">{story}</p>
                  <button
                    onClick={() => generatePDF(story, imageUrl)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Download PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;