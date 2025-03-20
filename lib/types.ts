export interface Product {
  id: string
  name: string
  price: number
  currency?: string
  location?: string
  image_url?: string
  ocr_text?: string
  created_at: string
  updated_at: string
  // Add additional fields for future extensibility
  [key: string]: any
}

export interface OcrResult {
  text: string
  productName?: string
  price?: number
  currency?: string
}

