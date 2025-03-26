export type Location = {
  name: string;
  address: string;
}

export type Product = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  price: number | null;
  currency: string;
  ocr_text?: string;
  image_url?: string;
  location?: Location;
}

export type OcrResult = {
  productName: string;
  price: number | null;
  currency: string;
  text: string;
}

