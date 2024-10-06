"use client"

import { useState } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import Groq from 'groq-sdk';
import { jsPDF } from "jspdf";

const groq = new Groq({ apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY, dangerouslyAllowBrowser: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const generateImage = async (userPrompt: string) => {
  const response = await fetch("/api/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: userPrompt,
    }),
  });
  let prediction = await response.json();
  if (response.status !== 201) {
    throw new Error(prediction.detail);
  }

  while (
    prediction.status !== "succeeded" &&
    prediction.status !== "failed"
  ) {
    await sleep(1000);
    const response = await fetch("/api/predictions/" + prediction.id);
    prediction = await response.json();
    if (response.status !== 200) {
      throw new Error(prediction.detail);
    }
  }

  return prediction;
};

const generateStory = async (userPrompt: string) => {
  const chatCompletion = await groq.chat.completions.create({
    messages: [{
      role: "user", content: `Write a short horror story based on this prompt: "${userPrompt}". 
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
  const parts = content.split(/\[PART[12]\]/);
  return {
    part1: parts[1]?.trim() || '',
    part2: parts[2]?.trim() || ''
  };
};

const generateImagePrompt = (storyPart: string) => {
  // Extract key elements from the story part to create an image prompt
  const keywords = storyPart.split(' ').slice(0, 10).join(' '); // Use first 10 words as keywords
  return `Horror scene: ${keywords}`;
};

const generatePDF = (story: { part1: string; part2: string }, images: string[]) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;

  // Function to add image while maintaining aspect ratio
  const addImageWithAspectRatio = (imageUrl: string, y: number) => {
    const imgProps = pdf.getImageProperties(imageUrl);
    const aspectRatio = imgProps.height / imgProps.width;
    const imgWidth = contentWidth;
    const imgHeight = imgWidth * aspectRatio;
    pdf.addImage(imageUrl, 'JPEG', margin, y, imgWidth, imgHeight);
    return imgHeight;
  };

  // Function to add text with pagination
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
      currentY += 7; // Approximate height of a line
    });

    return currentY;
  };

  // Add first page content
  let yOffset = margin;
  const firstImageHeight = addImageWithAspectRatio(images[0], yOffset);
  yOffset += firstImageHeight + 10;
  yOffset = addTextWithPagination(story.part1, yOffset);

  // Start second page
  pdf.addPage();

  // Add second page content
  yOffset = margin;
  const secondImageHeight = addImageWithAspectRatio(images[1], yOffset);
  yOffset += secondImageHeight + 10;
  addTextWithPagination(story.part2, yOffset);

  pdf.save('horror_story.pdf');
};

const Home: NextPage = () => {
  const [prompt, setPrompt] = useState('');
  const [story, setStory] = useState<{ part1: string; part2: string } | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const generatedStory = await generateStory(prompt);
      setStory(generatedStory);

      const imagePrompt1 = generateImagePrompt(generatedStory.part1);
      const imagePrompt2 = generateImagePrompt(generatedStory.part2);

      const [imagePrediction1, imagePrediction2] = await Promise.all([
        generateImage(imagePrompt1),
        generateImage(imagePrompt2)
      ]);

      const imageUrls = [
        imagePrediction1.output[imagePrediction1.output.length - 1],
        imagePrediction2.output[imagePrediction2.output.length - 1]
      ];
      setImages(imageUrls);

      generatePDF(generatedStory, imageUrls);
    } catch (error) {
      console.error('Error generating content:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-6 flex flex-col justify-center sm:py-12">
      <Head>
        <title>Two-Page Horror Story Generator</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div className="max-w-md mx-auto">
            <div className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <h2 className="text-3xl font-extrabold text-gray-900">Two-Page Horror Story Generator</h2>
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
                      {loading ? 'Generating...' : 'Generate Two-Page Horror Story'}
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
                      alt="Horror scene for page 1"
                      sizes="100vw"
                      height={768}
                      width={768}
                      className="w-full mb-4 rounded-lg shadow-lg"
                    />
                    <p className="text-gray-700">{story.part1}</p>
                  </div>
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold mb-2">Page 2</h4>
                    <Image
                      src={images[1]}
                      alt="Horror scene for page 2"
                      sizes="100vw"
                      height={768}
                      width={768}
                      className="w-full mb-4 rounded-lg shadow-lg"
                    />
                    <p className="text-gray-700">{story.part2}</p>
                  </div>
                  <button
                    onClick={() => generatePDF(story, images)}
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