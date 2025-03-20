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

    if (action === "ocr") {
      const aiFormData = new FormData()
      aiFormData.append("image", imageFile)
      
      const origin = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
      
      const response = await fetch(`${origin}/api/image-to-text`, {
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
      
      const ocrText = `Product: ${data.title || 'Unknown'}\nPrice: ${data.price || 0}`
      
      return {
        success: true,
        message: "AI processing successful",
        ocrText,
        extractedData: data,
      }
    }

    if (action === "save") {
      const ocrText = formData.get("ocrText") as string

      if (!ocrText) {
        return { success: false, message: "No OCR text provided" }
      }

      const { productName, price, currency } = extractProductInfo(ocrText)

      if (!productName || !price) {
        return {
          success: false,
          message: "Could not extract product name and price from the OCR text.",
        }
      }

      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const supabase = createClient()

      const { data: storageData, error: storageError } = await supabase.storage
        .from("product-images")
        .upload(`${Date.now()}-${imageFile.name}`, buffer, {
          contentType: imageFile.type,
        })

      if (storageError) {
        console.error("Error uploading image:", storageError)
        return { success: false, message: "Failed to upload image" }
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(storageData.path)

      const { error: insertError } = await supabase.from("products").insert({
        name: productName,
        price: price,
        currency: currency || "USD",
        image_url: publicUrl,
        ocr_text: ocrText,
      })

      if (insertError) {
        console.error("Error inserting product:", insertError)
        return { success: false, message: "Failed to save product information" }
      }

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