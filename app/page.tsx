"use client"

import { useState } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import Groq from 'groq-sdk';
import { jsPDF } from "jspdf";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Step 3: Update the generateImage function in page.tsx
const generateImage = async (userPrompt: string, style: string, apiKey: string) => {
  const fullPrompt = `${style}: ${userPrompt}`;
  const response = await fetch("/api/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      apiKey: apiKey
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate image');
  }

  let prediction = await response.json();

  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed"
  ) {
    await sleep(1000);
    const response = await fetch("/api/predictions/" + prediction.id, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check prediction status');
    }

    prediction = await response.json();
  }

  if (prediction.status === "failed") {
    throw new Error('Image generation failed');
  }

  return prediction;
};

const generateStory = async (userPrompt: string, apiKey: string) => {
  try {
    const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
    const chatCompletion = await groq.chat.completions.create({
      messages: [{
        role: "user", content: `Write a short story based on this prompt: "${userPrompt}". 
      The story should be in two distinct parts, each around 150 words long. 
      Clearly separate the two parts with [PART1] and [PART2] tags.` }],
      model: "llama-3.1-8b-instant",
      temperature: 1,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
      stop: null
    });
    const content = chatCompletion.choices[0]?.message?.content || '';
    console.log(content);
    const parts = content.split(/\[PART[12]\]/);
    console.log(parts);
    return {
      part1: parts[1]?.trim() || '',
      part2: parts[2]?.trim() || ''
    };
  } catch (error) {
    console.error('Error generating story:', error);
    throw new Error('Failed to generate story. Please try again.');
  }
};

const generateImagePrompt = (storyPart: string) => {
  const keywords = storyPart.split(' ').slice(0, 10).join(' ');
  return `Scene: ${keywords}`;
};

const generatePDF = (story: { part1: string; part2: string }, images: string[]) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;

  const addImageWithAspectRatio = (imageUrl: string, y: number) => {
    const imgProps = pdf.getImageProperties(imageUrl);
    const aspectRatio = imgProps.height / imgProps.width;
    const imgWidth = contentWidth;
    const imgHeight = imgWidth * aspectRatio;
    pdf.addImage(imageUrl, 'JPEG', margin, y, imgWidth, imgHeight);
    return imgHeight;
  };

  const addTextWithPagination = (text: string, y: number) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const splitText = pdf.splitTextToSize(text, contentWidth);
    let currentY = y;

    splitText.forEach((line: string) => {
      if (currentY > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }
      pdf.text(line, margin, currentY);
      currentY += 7;
    });

    return currentY;
  };

  // First page
  let yOffset = margin;
  const firstImageHeight = addImageWithAspectRatio(images[0], yOffset);
  yOffset += firstImageHeight + 10;
  yOffset = addTextWithPagination(story.part1, yOffset);

  // Second page
  pdf.addPage();
  yOffset = margin;
  const secondImageHeight = addImageWithAspectRatio(images[1], yOffset);
  yOffset += secondImageHeight + 10;
  addTextWithPagination(story.part2, yOffset);

  pdf.save('generated_story.pdf');
};

const Home: NextPage = () => {
  const [prompt, setPrompt] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [replicateApiKey, setReplicateApiKey] = useState('');
  const [story, setStory] = useState<{ part1: string; part2: string } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState('Photorealistic digital art');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groqApiKey || !replicateApiKey) {
      setError('Please enter both API keys');
      return;
    }
    setLoading(true);
    setError(null);
    setStory(null);
    setImages([]);

    try {
      const generatedStory = await generateStory(prompt, groqApiKey);
      setStory(generatedStory);

      const imagePrompt1 = generateImagePrompt(generatedStory.part1);
      const imagePrompt2 = generateImagePrompt(generatedStory.part2);

      const [imagePrediction1, imagePrediction2] = await Promise.all([
        generateImage(imagePrompt1, imageStyle, replicateApiKey),
        generateImage(imagePrompt2, imageStyle, replicateApiKey)
      ]);

      const imageUrls = [
        imagePrediction1.output[imagePrediction1.output.length - 1],
        imagePrediction2.output[imagePrediction2.output.length - 1]
      ];
      setImages(imageUrls);
    } catch (error) {
      console.error('Error generating content:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <Head>
        <title>Two-Page Story Generator</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-3xl font-extrabold text-gray-900">Two-Page Story Generator</h2>
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                  <div className="rounded-md shadow-sm -space-y-px space-y-4">
                    <div className="mb-4">
                      <label htmlFor="groqApiKey" className="block text-sm font-medium text-gray-700">Groq API Key</label>
                      <input
                        id="groqApiKey"
                        type="password"
                        required
                        className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                        placeholder="Enter Groq API Key"
                        value={groqApiKey}
                        onChange={(e) => setGroqApiKey(e.target.value)}
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="replicateApiKey" className="block text-sm font-medium text-gray-700">Replicate API Key</label>
                      <input
                        id="replicateApiKey"
                        type="password"
                        required
                        className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                        placeholder="Enter Replicate API Key"
                        value={replicateApiKey}
                        onChange={(e) => setReplicateApiKey(e.target.value)}
                      />
                    </div>
                    <div className="mb-4">
                      <label htmlFor="imageStyle" className="block text-sm font-medium text-gray-700">Image Style</label>
                      <input
                        id="imageStyle"
                        type="text"
                        className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                        placeholder="Enter image style"
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="prompt" className="block text-sm font-medium text-gray-700">Prompt</label>
                      <input
                        id="prompt"
                        type="text"
                        required
                        className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                        placeholder="Enter your story prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {loading ? 'Generating...' : 'Generate Two-Page Story'}
                    </button>
                  </div>
                </form>
              </div>
              {error && (
                <div className="py-4 text-red-600">{error}</div>
              )}
              {story && images.length === 2 && (
                <div className="py-8">
                  <h3 className="text-xl font-bold mb-4">Generated Content:</h3>
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold mb-2">Page 1</h4>
                    <Image
                      src={images[0]}
                      alt="Scene for page 1"
                      sizes="100vw"
                      height={768}
                      width={768}
                      className="w-full mb-4 rounded-lg shadow-lg"
                    />
                    <p className="text-gray-700 mt-4">{story.part1}</p>
                  </div>
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold mb-2">Page 2</h4>
                    <Image
                      src={images[1]}
                      alt="Scene for page 2"
                      sizes="100vw"
                      height={768}
                      width={768}
                      className="w-full mb-4 rounded-lg shadow-lg"
                    />
                    <p className="text-gray-700 mt-4">{story.part2}</p>
                  </div>
                  <button
                    onClick={() => generatePDF(story, images)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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