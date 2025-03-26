"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Upload, Loader2, Camera, Clipboard, ZoomIn } from "lucide-react"
import { processProductImage } from "@/lib/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { OcrResult } from "@/lib/types"
import imageCompression from 'browser-image-compression'
import { ImageZoomModal } from "@/components/image-zoom-modal"

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<string | null>(null)
  const [extractedProducts, setExtractedProducts] = useState<OcrResult[]>([])
  const [location, setLocation] = useState<{ name: string; address: string }>({ name: "", address: "" })
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type,
      initialQuality: 1, // Lossless compression
    }

    try {
      const compressedFile = await imageCompression(file, options)
      return compressedFile
    } catch (error) {
      console.error('Error compressing image:', error)
      return file
    }
  }

  const processFile = async (file: File) => {
    // Check file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      setResult({
        success: false,
        message: "File size must be less than 2MB",
      })
      return
    }

    setFile(file)
    setResult(null)
    setOcrResult(null)
    setExtractedProducts([])
    setLocation({ name: "", address: "" })

    // Try to extract location from image metadata
    try {
      const exifData = await extractExifData(file)
      if (exifData?.location) {
        // If we have coordinates, we can try to get a place name
        setLocation({ 
          name: "Unknown Location", 
          address: exifData.location 
        })
      }
    } catch (error) {
      console.error("Error extracting EXIF data:", error)
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Compress image before processing
    const compressedFile = await compressImage(file)
    await processImageWithAI(compressedFile)
  }

  const extractExifData = async (file: File): Promise<{ location?: string }> => {
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

  // Setup clipboard paste event listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile()
          if (blob) {
            const pastedFile = new File([blob], "pasted-image.png", { type: blob.type })
            await processFile(pastedFile)
          }
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [processFile])

  // Setup drag and drop event listeners
  useEffect(() => {
    const dropZone = dropZoneRef.current
    if (!dropZone) return

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    }

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const droppedFile = files[0]
        if (droppedFile.type.indexOf("image") !== -1) {
          await processFile(droppedFile)
        } else {
          setResult({
            success: false,
            message: "Please drop an image file.",
          })
        }
      }
    }

    dropZone.addEventListener("dragover", handleDragOver)
    dropZone.addEventListener("dragenter", handleDragEnter)
    dropZone.addEventListener("dragleave", handleDragLeave)
    dropZone.addEventListener("drop", handleDrop)

    return () => {
      dropZone.removeEventListener("dragover", handleDragOver)
      dropZone.removeEventListener("dragenter", handleDragEnter)
      dropZone.removeEventListener("dragleave", handleDragLeave)
      dropZone.removeEventListener("drop", handleDrop)
    }
  }, [processFile])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    if (selectedFile) {
      await processFile(selectedFile)
    }
  }

  const processImageWithAI = async (imageFile: File) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("image", imageFile)
      formData.append("action", "ocr")

      const response = await processProductImage(formData)

      if (response.success && response.extractedData) {
        setOcrResult(response.extractedData)
        
        if (response.extractedData) {
          setExtractedProducts(response.extractedData)
          console.log("AI Extracted Data:", response.extractedData)
        }
      } else {
        setOcrResult("Image processing failed. Please try a clearer image.")
        setResult({
          success: false,
          message: response.message || "Image processing failed",
        })
      }
    } catch (processError) {
      console.error("Image Processing Error:", processError)
      setOcrResult("Image processing failed. Please try a clearer image.")
      setResult({
        success: false,
        message: "An error occurred during image processing",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !ocrResult) {
      setResult({
        success: false,
        message: "Please upload an image first",
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("image", file)
      formData.append("ocrText", ocrResult)
      formData.append("products", JSON.stringify(extractedProducts))
      formData.append("location", JSON.stringify(location))
      formData.append("action", "save")

      const result = await processProductImage(formData)
      setResult(result)

      if (result.success) {
        setFile(null)
        setPreview(null)
        setOcrResult(null)
        setExtractedProducts([])
        setLocation({ name: "", address: "" })
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }

        router.refresh()
      }
    } catch (error) {
      setResult({
        success: false,
        message: "An error occurred while processing the image.",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handlePasteClick = () => {
    if (formRef.current) {
      formRef.current.focus()
    }

    setResult({
      success: true,
      message: "Press Ctrl+V or Cmd+V to paste an image from clipboard",
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" tabIndex={0}>
      <div 
        ref={dropZoneRef}
        className={`border-2 border-dashed rounded-md p-6 text-center ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
        }`}
      >
        <Upload className="h-10 w-10 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium mb-1">Drag & drop an image here</p>
        <p className="text-xs text-gray-500 mb-4">or use the options below</p>
        
        <div className="grid gap-2">
          <Label htmlFor="product-image" className="sr-only">Product Image</Label>
          <div className="flex gap-2">
            <Input
              id="product-image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
              className="flex-1"
              ref={fileInputRef}
              capture="environment"
            />
            <Button type="button" variant="outline" onClick={handleCameraCapture} disabled={loading} title="Take photo">
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePasteClick}
              disabled={loading}
              title="Paste from clipboard"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Alert>
        <AlertDescription>You can paste an image directly from clipboard using Ctrl+V / Cmd+V</AlertDescription>
      </Alert>

      {preview && (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-auto rounded-md"
            onClick={() => setIsZoomModalOpen(true)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-2 right-2"
            onClick={() => setIsZoomModalOpen(true)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      )}

      {extractedProducts.length > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="font-medium mb-3">AI-Detected Products (You can edit):</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {extractedProducts.map((product, index) => {
              const hasNameError = !product.productName?.trim();
              const hasPriceError = product.price === null || product.price === undefined || isNaN(Number(product.price));
              const productKey = `product-${index}-${product.productName}`;
              
              return (
                <div key={productKey} className="bg-white rounded-md border border-green-100 p-2.5">
                  <div className="grid grid-cols-[auto,1fr] gap-2 items-center">
                    <Label htmlFor={`product-name-${productKey}`} className="whitespace-nowrap text-xs">Name:</Label>
                    <div className="space-y-1">
                      <Input 
                        id={`product-name-${productKey}`}
                        value={product.productName || ''} 
                        onChange={(e) => {
                          const newProducts = [...extractedProducts];
                          newProducts[index] = { ...product, productName: e.target.value, text: e.target.value };
                          setExtractedProducts(newProducts);
                        }}
                        className={`h-8 text-sm ${hasNameError ? 'border-red-500' : ''}`}
                      />
                      {hasNameError && <p className="text-xs text-red-500">Name is required</p>}
                    </div>
                    
                    <Label htmlFor={`product-price-${productKey}`} className="whitespace-nowrap text-xs">Price:</Label>
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <Input 
                          id={`product-price-${productKey}`}
                          type="number" 
                          step="0.01"
                          value={product.price ?? ''} 
                          onChange={(e) => {
                            const newProducts = [...extractedProducts];
                            newProducts[index] = { ...product, price: e.target.value ? parseFloat(e.target.value) : null };
                            setExtractedProducts(newProducts);
                          }}
                          className={`h-8 text-sm ${hasPriceError ? 'border-red-500' : ''}`}
                        />
                        <Input 
                          id={`product-currency-${productKey}`}
                          value={product.currency || ''} 
                          onChange={(e) => {
                            const newProducts = [...extractedProducts];
                            newProducts[index] = { ...product, currency: e.target.value };
                            setExtractedProducts(newProducts);
                          }}
                          className="h-8 text-sm w-16"
                        />
                      </div>
                      {hasPriceError && <p className="text-xs text-red-500">Valid price is required</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="location-name" className="text-sm font-medium">Store Name (optional):</Label>
              <Input
                id="location-name"
                value={location.name}
                onChange={(e) => setLocation(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter store name"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="location-address" className="text-sm font-medium">Address (optional):</Label>
              <Input
                id="location-address"
                value={location.address}
                onChange={(e) => setLocation(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter store address or coordinates"
                className="mt-1"
              />
            </div>
            <p className="text-xs text-gray-500">
              Location information will be applied to all products in this image. You can enter a store name and address, or just coordinates.
            </p>
          </div>
        </div>
      )}

      {ocrResult && !extractedProducts.length && (
        <div className="p-3 bg-muted rounded-md">
          <Label>Extracted Text:</Label>
          <pre className="mt-2 text-sm whitespace-pre-wrap overflow-auto max-h-40">{ocrResult}</pre>
        </div>
      )}

      <Button 
        type="submit" 
        disabled={!file || loading || !extractedProducts.length || extractedProducts.some(p => 
          !p.productName?.trim() || 
          p.price === null || 
          p.price === undefined || 
          isNaN(Number(p.price))
        )} 
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Submit"
        )}
      </Button>

      {result && (
        <div
          className={`p-3 rounded-md ${
            result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </div>
      )}
    </form>
  )
}

