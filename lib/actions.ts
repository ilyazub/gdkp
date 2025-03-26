"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from 'next/headers'
import type { Product } from "@/lib/types"

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
      const productName = formData.get("productName") as string
      const productPrice = formData.get("productPrice") as string
      const productCurrency = formData.get("productCurrency") as string

      // Validate required fields
      if (!productName || !productPrice) {
        return { 
          success: false, 
          message: "Product name and price are required" 
        }
      }

      // Validate price is a valid number
      const price = parseFloat(productPrice)
      if (isNaN(price)) {
        return { 
          success: false, 
          message: "Invalid price format" 
        }
      }

      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const cookieStore = cookies()
      const supabase = createClient(cookieStore)

      // const { data: storageData, error: storageError } = await supabase.storage
      //   .from("product-images")
      //   .upload(`${Date.now()}-${imageFile.name}`, buffer, {
      //     contentType: imageFile.type,
      //   })

      // if (storageError) {
      //   console.error("Error uploading image:", storageError)
      //   console.error("StorageData:", storageData)
      //   return { success: false, message: "Failed to upload image" }
      // }

      // const {
      //   data: { publicUrl },
      // } = supabase.storage.from("product-images").getPublicUrl(storageData.path)

      const { error: insertError } = await supabase.from("products").insert({
        data: {
          name: productName,
          price: productPrice,
          currency: productCurrency || "USD",
          // image_url: publicUrl,
          ocr_text: ocrText,
        }
      })

      if (insertError) {
        console.error("Error inserting product:", insertError)
        return { success: false, message: "Failed to save product information" }
      }

      return {
        success: true,
        message: `Successfully extracted and saved "${productName}" with price ${productPrice} ${productCurrency || "USD"}`,
      }
    }

    return { success: false, message: "Invalid action" }
  } catch (error) {
    console.error("Error processing image:", error)
    return { success: false, message: "An error occurred while processing the image" }
  }
}