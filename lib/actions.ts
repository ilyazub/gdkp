"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from 'next/headers'
import type { Product, OcrResult } from "@/lib/types"

export async function searchProducts(query: string): Promise<Product[]> {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .ilike("data->>'name'", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("Error searching products:", error)
    return []
  }

  return (data || []).map(item => ({
    id: item.id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...item.data
  }));
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
      
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
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
      
      return {
        success: true,
        message: "AI processing successful",
        extractedData: data,
      }
    }

    if (action === "save") {
      const productsJson = formData.get("products") as string

      try {
        const products = JSON.parse(productsJson) as OcrResult[]

        // Validate products
        if (!Array.isArray(products) || products.length === 0) {
          return { 
            success: false, 
            message: "No valid products to save" 
          }
        }

        // Validate each product
        for (const product of products) {
          if (!product.productName) {
            return { 
              success: false, 
              message: "Product name is required" 
            }
          }
          if (product.price === undefined || isNaN(product.price)) {
            return { 
              success: false, 
              message: "Invalid price format" 
            }
          }
        }

        const cookieStore = cookies()
        const supabase = createClient(cookieStore)

        // Insert all products in a batch
        const { error: insertError } = await supabase.from("products").insert(
          products.map(product => ({
            data: {
              name: product.productName,
              price: product.price,
              currency: product.currency || "USD",
              ocr_text: product.text,
            }
          }))
        )

        if (insertError) {
          console.error("Error inserting products:", insertError)
          return { success: false, message: "Failed to save product information" }
        }

        return {
          success: true,
          message: `Successfully saved ${products.length} products`,
        }
      } catch (error) {
        console.error("Error processing products:", error)
        return { 
          success: false, 
          message: "Failed to process products data" 
        }
      }
    }

    return { success: false, message: "Invalid action" }
  } catch (error) {
    console.error("Error processing image:", error)
    return { success: false, message: "An error occurred while processing the image" }
  }
}