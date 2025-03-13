"use server"

import { createClient } from "@/lib/supabase/server"
import { extractProductInfo } from "@/lib/utils"
import type { Product } from "@/lib/types"

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

    // If this is an OCR request, process the image with OCR.space API
    if (action === "ocr") {
      const ocrText = await performOcr(imageFile)

      if (!ocrText) {
        return {
          success: false,
          message: "OCR processing failed. Please try a clearer image.",
        }
      }

      // Extract product information to verify we can parse it
      const { productName, price } = extractProductInfo(ocrText)

      if (!productName || !price) {
        return {
          success: false,
          message: "Could not extract product name and price from the image. Please try a clearer image.",
          ocrText,
        }
      }

      return {
        success: true,
        message: "OCR processing successful",
        ocrText,
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

      // Convert file to buffer for storage
      const arrayBuffer = await imageFile.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Store in database
      const supabase = createClient()

      // Upload image to storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from("product-images")
        .upload(`${Date.now()}-${imageFile.name}`, buffer, {
          contentType: imageFile.type,
        })

      if (storageError) {
        console.error("Error uploading image:", storageError)
        return { success: false, message: "Failed to upload image" }
      }

      // Get public URL for the uploaded image
      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(storageData.path)

      // Insert product data into database
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

async function performOcr(imageFile: File): Promise<string | null> {
  try {
    // Instead of sending base64, let's use FormData to send the file directly
    const formData = new FormData()

    // Add the file with a specific name that OCR.space expects
    formData.append("file", imageFile)

    // Add other required parameters
    formData.append("language", "eng")
    formData.append("isOverlayRequired", "false")
    formData.append("scale", "true")
    formData.append("OCREngine", "2")
    formData.append("apikey", process.env.OCR_SPACE_API_KEY || "helloworld") // Free API key for testing

    // Call OCR.space API with FormData
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      console.error("OCR API error:", await response.text())
      return null
    }

    const data = await response.json()

    if (data.IsErroredOnProcessing) {
      console.error("OCR processing error:", data.ErrorMessage)
      return null
    }

    // Extract the parsed text from the response
    const parsedText = data.ParsedResults?.[0]?.ParsedText

    if (!parsedText) {
      console.error("No text found in the image")
      return null
    }

    return parsedText
  } catch (error) {
    console.error("OCR error:", error)
    return null
  }
}

