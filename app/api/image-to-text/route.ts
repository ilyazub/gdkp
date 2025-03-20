import { NextRequest, NextResponse } from 'next/server';
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

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

    const result = await generateText({
      model: groq("llama-3.1-8b-instant"),
      maxTokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: promptText,
            },
            {
              type: 'image',
              image: new URL(
                dataURI,
              ),
            },
          ],
        },
      ],
      experimental_telemetry: {
        isEnabled: true,
      },
    });

    const content = result.text || '';

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