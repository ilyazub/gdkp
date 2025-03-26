import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import type { OcrResult } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    "X-Title": "Gde Kupit",
    "X-Description": "Gde Kupit is a website that helps you find the best deals on products in your area."
  },
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

    const promptText = `You are a JSON-only response bot. Your task is to analyze the image and output ONLY a valid JSON string (RFC 8259) with no additional text, no markdown formatting, no backticks, no explanations.

Analyze this grocery receipt or product price tag image. Extract the product information following these rules:

1. For each distinct product, output a JSON string with:
   - title: string (full product name, preserve original language)
   - price: number (numeric value only, no currency symbols)
   - currency: string (3-letter currency code, e.g., "USD", "EUR")

2. Format requirements:
   - Output must be ONLY the raw JSON string (RFC 8259)
   - NO markdown formatting
   - NO backticks
   - NO additional text or explanations
   - Price should be a number (not a string)
   - Currency should be in ISO 4217 format
   - Title should be the complete product name

3. Special cases:
   - If multiple items are visible, output an array of objects
   - If price is missing, use null
   - If currency is not visible, guess it from the price and title
   - Remove any special characters from prices
   - Preserve original language for titles

4. Product title correction:
   - Check each word in the product title for logical correctness
   - Update any abbreviations, typos, or incorrect words to ensure the title makes complete sense
   - Keep the meaning unchanged
   - Examples of corrections:
     * "Твор. 5% 200г" → "Творог 5% 200г"
     * "Смет. 15% бан." → "Сметана 15% банка"
     * "Молоко ультр. паст. 1л" → "Молоко ультрапастеризоване 1л"
     * "Йогурт нат. з клуб." → "Йогурт натуральний з клубнікою"
     * "Хліб пшен. наріз." → "Хліб пшеничний нарізаний"
   - Apply similar corrections to any abbreviated or incomplete words
   - Preserve numbers, percentages, and units (г, л, кг, etc.)
   - Keep the original language of the product title

Remember: Output ONLY the raw JSON string, nothing else.`;

    const response = await openai.chat.completions.create({
      // model: 'openrouter/auto',
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'system',
          content: 'You are a JSON-only response bot. You must output ONLY valid JSON strings (RFC 8259) with no additional text, no markdown formatting, no backticks, and no explanations.'
        },
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
      response_format: {
        type: 'json_object'
      },
      max_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content || '';

    console.dir(content);

    try {
      const parsedData = JSON.parse(content);
      
      // Handle both single product and array of products
      const products = Array.isArray(parsedData) ? parsedData : [parsedData];
      
      // Validate and normalize each product using OcrResult interface
      const normalizedProducts: OcrResult[] = products.map(product => ({
        text: product.title || '',
        productName: product.title || '',
        price: typeof product.price === 'number' ? product.price : null,
        currency: product.currency || 'USD'
      }));

      return NextResponse.json(normalizedProducts);
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', content);
      return NextResponse.json({
        error: 'Failed to parse response',
        rawContent: content
      }, { status: 500 });
    }
  } catch (apiError) {
    console.error('Image-to-text API error:', apiError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 