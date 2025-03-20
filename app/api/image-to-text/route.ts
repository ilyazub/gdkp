import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || '',
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type;
    const dataURI = `data:${mimeType};base64,${base64Image}`;

    const promptText = 'This is a grocery receipt or product price tag. Extract the product title and price in JSON format. The response should ONLY include a JSON object with format { price: number, title: string }. Do not include any explanations or other text.';

    const response = await openai.chat.completions.create({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            {
              type: 'image_url',
              image_url: { url: dataURI }
            }
          ]
        }
      ],
      max_tokens: 512,
    });

    const content = response.choices[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      const parsedData = JSON.parse(jsonString);

      return NextResponse.json(parsedData);
    } catch (error) {
      console.error('Failed to parse JSON response:', content);
      return NextResponse.json({
        error: 'Failed to parse response',
        rawContent: content
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Image-to-text API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 