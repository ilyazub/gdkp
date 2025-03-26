import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import imageCompression from 'browser-image-compression'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number, currency = "USD"): string {
  // Use a simpler approach that doesn't depend on locale
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  
  // Cache the format parts to avoid hydration issues
  const parts = formatter.formatToParts(price)
  const value = parts.map(p => p.value).join('')
  return value
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  
  // Use a simple, consistent date format that doesn't depend on locale
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  
  const month = months[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  
  return `${month} ${day}, ${year}`
}

export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8,
  }

  try {
    const compressedFile = await imageCompression(file, options)
    return compressedFile
  } catch (error) {
    console.error('Error compressing image:', error)
    return file
  }
}

export async function extractExifData(file: File): Promise<{ location?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      const view = new DataView(buffer)
      
      // Basic EXIF parsing - looking for GPS data
      let location: string | undefined
      
      // Check for GPS data markers
      for (let i = 0; i < view.byteLength - 2; i++) {
        if (view.getUint16(i) === 0xE1) { // APP1 marker
          const exifHeader = String.fromCharCode(
            view.getUint8(i + 4),
            view.getUint8(i + 5),
            view.getUint8(i + 6),
            view.getUint8(i + 7)
          )
          
          if (exifHeader === "Exif") {
            // Found EXIF data, try to extract GPS coordinates
            const gpsOffset = i + 8
            // Basic GPS data extraction (this is a simplified version)
            const latRef = String.fromCharCode(view.getUint8(gpsOffset + 18))
            const lat = view.getFloat32(gpsOffset + 20, true)
            const lonRef = String.fromCharCode(view.getUint8(gpsOffset + 30))
            const lon = view.getFloat32(gpsOffset + 32, true)
            
            if (!isNaN(lat) && !isNaN(lon)) {
              location = `${lat.toFixed(6)},${lon.toFixed(6)}`
              break
            }
          }
        }
      }
      
      resolve({ location })
    }
    reader.readAsArrayBuffer(file)
  })
}

