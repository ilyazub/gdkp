"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from 'next/headers'
import type { Product, OcrResult } from "@/lib/types"
import sharp from 'sharp'

// Define response types for consistent API responses
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

type OcrResponse = {
  message: string
  extractedData: OcrResult[]
}

type SaveResponse = {
  message: string
}

// Define error codes
const ErrorCodes = {
  INVALID_INPUT: 'INVALID_INPUT',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AI_ERROR: 'AI_ERROR'
} as const

async function compressImage(file: File): Promise<File> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    const processedBuffer = await sharp(buffer)
      .resize(1600, 1600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 75,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer()

    return new File([processedBuffer], file.name.replace(/\.[^/.]+$/, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now()
    })
  } catch (error) {
    console.error('Error compressing image:', error)
    throw new Error('Image compression failed')
  }
}

export async function searchProducts(query: string): Promise<ApiResponse<Product[]>> {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    if (!query?.trim()) {
      return {
        success: false,
        error: {
          code: ErrorCodes.INVALID_INPUT,
          message: 'Search query is required'
        }
      }
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("data->>'name'", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("Error searching products:", error)
      return {
        success: false,
        error: {
          code: ErrorCodes.DATABASE_ERROR,
          message: 'Failed to search products',
          details: error
        }
      }
    }

    return {
      success: true,
      data: (data || []).map(item => ({
        id: item.id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        ...item.data
      }))
    }
  } catch (error) {
    console.error('Unexpected error in searchProducts:', error)
    return {
      success: false,
      error: {
        code: ErrorCodes.PROCESSING_ERROR,
        message: 'An unexpected error occurred',
        details: error
      }
    }
  }
}

export async function getRecentProducts(): Promise<ApiResponse<Product[]>> {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("Error fetching recent products:", error)
      return {
        success: false,
        error: {
          code: ErrorCodes.DATABASE_ERROR,
          message: 'Failed to fetch recent products',
          details: error
        }
      }
    }

    return {
      success: true,
      data: (data || []).map(item => ({
        id: item.id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        ...item.data
      }))
    }
  } catch (error) {
    console.error('Unexpected error in getRecentProducts:', error)
    return {
      success: false,
      error: {
        code: ErrorCodes.PROCESSING_ERROR,
        message: 'An unexpected error occurred',
        details: error
      }
    }
  }
}

export async function processProductImage(formData: FormData): Promise<ApiResponse<OcrResponse | SaveResponse>> {
  try {
    const imageFile = formData.get("image") as File
    const action = formData.get("action") as string
    const locationJson = formData.get("location") as string
    const imageUrl = formData.get("imageUrl") as string

    if (!imageFile) {
      return {
        success: false,
        error: {
          code: ErrorCodes.INVALID_INPUT,
          message: "No image provided"
        }
      }
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    if (action === "ocr") {
      const aiFormData = new FormData()
      aiFormData.append("image", imageFile)
      
      // In server components/actions, we can use relative URLs
      const apiUrl = `/api/image-to-text`
      
      const response = await fetch(apiUrl, {
        method: "POST",
        body: aiFormData,
      })
      
      if (!response.ok) {
        console.error("Image-to-text API error:", await response.text())
        return {
          success: false,
          error: {
            code: ErrorCodes.AI_ERROR,
            message: "AI processing failed. Please try a clearer image."
          }
        }
      }
      
      const data = await response.json()
      
      if (data.error) {
        console.error("Image-to-text processing error:", data.error)
        return {
          success: false,
          error: {
            code: ErrorCodes.AI_ERROR,
            message: "AI processing failed. Please try a clearer image.",
            details: data.error
          }
        }
      }
      
      return {
        success: true,
        data: {
          message: "AI processing successful",
          extractedData: data
        }
      }
    }

    if (action === "save") {
      const productsJson = formData.get("products") as string

      try {
        const products = JSON.parse(productsJson) as OcrResult[]
        let location: { name: string; address: string } | null = null

        try {
          if (locationJson) {
            const parsedLocation = JSON.parse(locationJson)
            // Validate location object
            if (parsedLocation && (!parsedLocation.name && !parsedLocation.address)) {
              location = null
            } else {
              location = parsedLocation
            }
          }
        } catch (error) {
          console.error("Error parsing location:", error)
          location = null
        }

        // Validate products
        if (!Array.isArray(products) || products.length === 0) {
          return {
            success: false,
            error: {
              code: ErrorCodes.INVALID_INPUT,
              message: "No valid products to save"
            }
          }
        }

        // Validate each product
        for (const product of products) {
          if (!product.productName) {
            return {
              success: false,
              error: {
                code: ErrorCodes.INVALID_INPUT,
                message: "Product name is required"
              }
            }
          }
        }

        const { error: insertError } = await supabase.from("products").insert(
          products.map(product => ({
            data: {
              name: product.productName,
              price: product.price,
              currency: product.currency || "UAH",
              ocr_text: product.text,
              image_url: imageUrl,
              location: location
            }
          }))
        )

        if (insertError) {
          console.error("Error inserting products:", insertError)
          return {
            success: false,
            error: {
              code: ErrorCodes.DATABASE_ERROR,
              message: "Failed to save product information",
              details: insertError
            }
          }
        }

        return {
          success: true,
          data: {
            message: `Successfully saved ${products.length} products`
          }
        }
      } catch (error) {
        console.error("Error processing products:", error)
        return {
          success: false,
          error: {
            code: ErrorCodes.PROCESSING_ERROR,
            message: "Failed to process products data",
            details: error
          }
        }
      }
    }

    return {
      success: false,
      error: {
        code: ErrorCodes.INVALID_INPUT,
        message: "Invalid action"
      }
    }
  } catch (error) {
    console.error("Error processing image:", error)
    return {
      success: false,
      error: {
        code: ErrorCodes.PROCESSING_ERROR,
        message: "An error occurred while processing the image",
        details: error
      }
    }
  }
}

export async function uploadImage(file: File): Promise<ApiResponse<{ url: string }>> {
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // Compress image before upload
    const compressedImage = await compressImage(file)
    const timestamp = Date.now()
    const filePath = `product-images/${timestamp}.jpg`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, compressedImage, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      })

    if (uploadError) {
      console.error("Error uploading image:", uploadError)
      return {
        success: false,
        error: {
          code: ErrorCodes.STORAGE_ERROR,
          message: "Failed to upload product image",
          details: uploadError
        }
      }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath)

    return {
      success: true,
      data: {
        url: publicUrl
      }
    }
  } catch (error) {
    console.error("Error uploading image:", error)
    return {
      success: false,
      error: {
        code: ErrorCodes.STORAGE_ERROR,
        message: "Failed to upload product image",
        details: error
      }
    }
  }
}