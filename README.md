# GDKP - Grocery Price Tracker

A grocery price tracker application that uses AI to extract product information from images.

## Features

- Upload product images via file upload, camera, or clipboard paste
- AI-powered image-to-text extraction using various vision models (OpenAI, Groq, or OpenRouter)
- Automatic extraction of product name and price
- Search functionality for saved products
- Simple and intuitive UI

## Getting Started

### Prerequisites

- Node.js 18.x or later
- API key from one of the following services:
  - OpenAI
  - Groq
  - OpenRouter

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.local` to your project root
   - Add your API key(s) to the appropriate variable:

   ```
   # Choose one of these services to use
   OPENAI_API_KEY=your_openai_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   
   # Required for OpenRouter API
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## AI Image Processing Options

This project supports multiple AI services for image-to-text processing:

### 1. Groq

- Fast and efficient Vision API
- Supports Claude-quality results with better performance
- Uses LLaVa-1.6-34b model for vision tasks
- Requires a Groq API key (get one at https://console.groq.com/)
- Integrated using the `@ai-sdk/groq` package

### 2. OpenRouter

- API gateway to multiple AI models
- Allows access to Anthropic's Claude and other vision models
- Get one API key, access multiple models
- Requires an OpenRouter API key (get one at https://openrouter.ai/)

### 3. OpenAI (original)

- Uses GPT-4 Vision for image processing
- High accuracy but may have higher latency
- Requires an OpenAI API key (get one at https://platform.openai.com/api-keys)

The system automatically selects the AI service to use based on which API key is provided, with the following priority: Groq > OpenRouter > OpenAI.

## Implementation Details

### Vercel AI SDK Integration

This project uses Vercel's AI SDK to provide a consistent interface to different AI providers:

```typescript
// We use the @ai-sdk/groq package to integrate with Groq's API
import { groq } from '@ai-sdk/groq';

// This creates reusable functions for making text and vision requests
export async function callGroqVision(textPrompt, imageUrl, apiKey) {
  // Implementation of the vision API call
}
```

The integration allows for:
- Proper error handling
- Consistent API across different providers
- Type safety with TypeScript

## Technology Stack

- Next.js 15.x
- React 19
- Tailwind CSS
- Multiple AI Vision APIs (Groq/OpenRouter/OpenAI)
- Vercel AI SDK
- Supabase for database and storage

## License

This project is licensed under the MIT License.

## Step-by-Step Implementation

### 1. Setting Up the Environment

1. Create a Next.js application:
   ```bash
   npx create-next-app@latest gdkp
   ```

2. Install necessary dependencies:
   ```bash
   npm install @ai-sdk/groq groq date-fns
   ```

3. Set up environment variables in `.env.local`:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```

### 2. Creating the Groq Client

Create a file at `lib/groq-client.ts` with the following code:

```typescript
import { groq } from '@ai-sdk/groq';

/**
 * Make a vision request to Groq API
 * @param textPrompt The text prompt to send
 * @param imageUrl The image URL or data URI
 * @param apiKey The Groq API key
 * @returns The API response
 */
export async function callGroqVision(
  textPrompt: string,
  imageUrl: string,
  apiKey: string
) {
  try {
    // Create a fetch request to Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llava-1.6-34b', // Use LLaVa model for vision
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: textPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling Groq Vision API:', error);
    throw error;
  }
}

// Export the Groq provider from ai-sdk for potential future use
export const groqProvider = groq;
```

### 3. Creating the Image-to-Text API Endpoint

Create a file at `app/api/image-to-text/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { callGroqVision } from '@/lib/groq-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Convert the file to a base64 string
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type;
    const dataURI = `data:${mimeType};base64,${base64Image}`;

    // Prompt for product information extraction
    const promptText = 'This is a grocery receipt or product price tag. Extract the product title and price in JSON format. The response should ONLY include a JSON object with format { price: number, title: string }. Do not include any explanations or other text.';

    // Call our Groq Vision client
    const result = await callGroqVision(
      promptText,
      dataURI,
      process.env.GROQ_API_KEY || ''
    );
    
    // Parse the response to extract the JSON
    const content = result.choices[0].message.content || '';
    
    try {
      // Try to parse the JSON directly
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
```

### 4. Setting Up Server Actions

Create a file at `lib/actions.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { extractProductInfo } from "@/lib/utils"
import type { Product } from "@/lib/types"

// Only check for Groq API key
const hasGroqAPI = !!process.env.GROQ_API_KEY
console.log(`Using Groq API: ${hasGroqAPI ? 'Yes' : 'No - check API key'}`);

export async function searchProducts(query: string): Promise<Product[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .ilike("name", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("Error searching products:", error)
    return []
  }

  return data || []
}

export async function processProductImage(formData: FormData) {
  try {
    const imageFile = formData.get("image") as File
    const action = formData.get("action") as string

    if (!imageFile) {
      return { success: false, message: "No image provided" }
    }

    // If this is an OCR request, process the image with Groq
    if (action === "ocr") {
      // Create a new FormData object to send to our image-to-text API
      const aiFormData = new FormData()
      aiFormData.append("image", imageFile)
      
      // Call our Groq-powered image-to-text API
      const response = await fetch("/api/image-to-text", {
        method: "POST",
        body: aiFormData,
      })
      
      if (!response.ok) {
        console.error("Image-to-text API error:", await response.text())
        return {
          success: false,
          message: "AI processing failed. Please try a clearer image.",
        }
      }
      
      const data = await response.json()
      
      if (data.error) {
        console.error("Image-to-text processing error:", data.error)
        return {
          success: false,
          message: "AI processing failed. Please try a clearer image.",
        }
      }
      
      // Format the extracted data into OCR-like text for compatibility with existing code
      const ocrText = `Product: ${data.title || 'Unknown'}\nPrice: ${data.price || 0}`
      
      return {
        success: true,
        message: "AI processing successful",
        ocrText,
        extractedData: data,
      }
    }

    // If this is a save request, save the product to the database
    if (action === "save") {
      const ocrText = formData.get("ocrText") as string

      if (!ocrText) {
        return { success: false, message: "No OCR text provided" }
      }

      // Extract product information
      const { productName, price, currency } = extractProductInfo(ocrText)

      if (!productName || !price) {
        return {
          success: false,
          message: "Could not extract product name and price from the OCR text.",
        }
      }

      // Save to database logic...
      // (Implementation details depend on your database setup)

      return {
        success: true,
        message: `Successfully extracted and saved "${productName}" with price ${price} ${currency || "USD"}`,
      }
    }

    return { success: false, message: "Invalid action" }
  } catch (error) {
    console.error("Error processing image:", error)
    return { success: false, message: "An error occurred while processing the image" }
  }
}
```

### 5. Creating the UI Components

Create a simple upload form component and product list component:

1. Upload Form:
```typescript
// components/upload-form.tsx
"use client"

import type React from "react"
import { useState, useRef } from "react"
import { processProductImage } from "@/lib/actions"

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  // ... form state and handlers

  const processImageWithAI = async (imageFile: File) => {
    // Call the server action to process the image with Groq
    const formData = new FormData()
    formData.append("image", imageFile)
    formData.append("action", "ocr")
    
    const response = await processProductImage(formData)
    // ... handle response
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* File input and preview */}
      {/* Submit button */}
    </form>
  )
}
```

2. Main Page:
```typescript
import { UploadForm } from "@/components/upload-form"
import { ProductList } from "@/components/product-list"
import { searchProducts } from "@/lib/actions"

export default async function Home({
  searchParams,
}: {
  searchParams: { query?: string }
}) {
  const query = searchParams.query || ""
  const products = query ? await searchProducts(query) : []

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">GDKP - Grocery Price Tracker</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-4">Search Products</h2>
          {/* Search form and results */}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Product Photo</h2>
          <UploadForm />
        </div>
      </div>
    </main>
  )
}
```

## Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and go to http://localhost:3000

## How It Works

1. User uploads a receipt or price tag image
2. The image is sent to the server via a form submission
3. The server processes the image using Groq's AI vision capabilities
4. Groq extracts product information (name and price) from the image
5. The extracted information is returned to the client
6. The user can save the product information to the database

## Features

- Simple, clean UI
- AI-powered receipt and price tag scanning
- Product information extraction
- Database storage for scanned products
- Search capability for saved products 