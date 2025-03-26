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

## License

This project is licensed under the MIT License.