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
}

export interface OcrResult {
  text: string
  productName?: string
  price?: number
  currency?: string
}

