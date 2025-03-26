"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from 'next/headers'
import type { Product, OcrResult } from "@/lib/types"

async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8,
  }

  try {
    // Create an image element
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await new Promise((resolve) => (img.onload = resolve))

    // Create a canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')

    // Calculate new dimensions
    let { width, height } = img
    const maxSize = options.maxWidthOrHeight
    if (width > height && width > maxSize) {
      height = Math.round((height * maxSize) / width)
      width = maxSize
    } else if (height > maxSize) {
      width = Math.round((width * maxSize) / height)
      height = maxSize
    }

    // Set canvas dimensions
    canvas.width = width
    canvas.height = height

    // Draw and compress
    ctx.drawImage(img, 0, 0, width, height)
    const compressedBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob || new Blob()), 
        'image/jpeg',
        options.initialQuality
      )
    })

    // Clean up
    URL.revokeObjectURL(img.src)

    // Convert to File
    return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch (error) {
    console.error('Error compressing image:', error)
    return file
  }
}

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

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

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
          if (product.price === null || product.price === undefined || isNaN(Number(product.price))) {
            return { 
              success: false, 
              message: "Invalid price format" 
            }
          }
        }

        // Compress and upload image to Supabase Storage
        const compressedImage = await compressImage(imageFile)
        const timestamp = Date.now()
        const filePath = `product-images/${timestamp}.jpg` // Always save as JPG after compression

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, compressedImage, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg'
          })

        if (uploadError) {
          console.error("Error uploading image:", uploadError)
          return { success: false, message: "Failed to upload product image" }
        }

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath)

        const { error: insertError } = await supabase.from("products").insert(
          products.map(product => ({
            data: {
              name: product.productName,
              price: product.price,
              currency: product.currency || "UAH",
              ocr_text: product.text,
              image_url: publicUrl
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