import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(price)
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

export function extractProductInfo(text: string): { productName?: string; price?: number; currency?: string } {
  if (!text) return {}

  // Improved regex to find price patterns
  // Looks for currency symbols ($, €, £) followed by numbers, or just numbers followed by currency codes
  const priceRegex = /(?:[$€£]\s*(\d+(?:[.,]\d{1,2})?))|(?:(\d+(?:[.,]\d{1,2})?)\s*(?:USD|EUR|GBP)?)/gi
  const priceMatches = [...text.matchAll(priceRegex)]

  // Get the first price found
  let price: number | undefined = undefined
  if (priceMatches.length > 0) {
    // Use the first captured group that has a value
    const priceStr = priceMatches[0][1] || priceMatches[0][2]
    if (priceStr) {
      // Replace comma with dot for proper parsing
      price = Number.parseFloat(priceStr.replace(",", "."))
    }
  }

  // Determine currency (improved implementation)
  let currency = "USD"
  if (text.includes("€") || text.toLowerCase().includes("eur")) currency = "EUR"
  else if (text.includes("£") || text.toLowerCase().includes("gbp")) currency = "GBP"
  else if (text.includes("$") || text.toLowerCase().includes("usd")) currency = "USD"

  // Extract product name (improved implementation)
  // Look for product name patterns or use the first non-price line
  const lines = text.split("\n").filter((line) => line.trim())

  let productName: string | undefined = undefined

  // Try to find a line that looks like a product name (not just numbers or prices)
  for (const line of lines) {
    const trimmedLine = line.trim()
    // Skip lines that are just prices or very short
    if (trimmedLine.length > 3 && !priceRegex.test(trimmedLine) && !/^\d+$/.test(trimmedLine)) {
      productName = trimmedLine
      break
    }
  }

  // If no product name found, use the first line as fallback
  if (!productName && lines.length > 0) {
    productName = lines[0].trim()
  }

  return { productName, price, currency }
}

