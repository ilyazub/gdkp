"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Upload, Loader2, Camera, Clipboard } from "lucide-react"
import { processProductImage } from "@/lib/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { OcrResult } from "@/lib/types"
import imageCompression from 'browser-image-compression'

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<string | null>(null)
  const [extractedProducts, setExtractedProducts] = useState<OcrResult[]>([])
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
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

    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Compress image before processing
    const compressedFile = await compressImage(file)
    await processImageWithAI(compressedFile)
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
      formData.append("action", "save")

      const result = await processProductImage(formData)
      setResult(result)

      if (result.success) {
        setFile(null)
        setPreview(null)
        setOcrResult(null)
        setExtractedProducts([])
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
        <Card className="overflow-hidden">
          <img src={preview || "/placeholder.svg"} alt="Preview" className="w-full h-auto max-h-64 object-contain" />
        </Card>
      )}

      {extractedProducts.length > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="font-medium mb-3">AI-Detected Products (You can edit):</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {extractedProducts.map((product, index) => (
              <div key={index} className="bg-white rounded-md border border-green-100 p-2.5">
                <div className="grid grid-cols-[auto,1fr] gap-2 items-center">
                  <Label htmlFor={`productName-${index}`} className="whitespace-nowrap text-xs">Name:</Label>
                  <Input 
                    id={`productName-${index}`}
                    value={product.productName} 
                    onChange={(e) => {
                      const newProducts = [...extractedProducts]
                      newProducts[index] = { ...product, productName: e.target.value, text: e.target.value }
                      setExtractedProducts(newProducts)
                    }}
                    className="h-8 text-sm"
                  />
                  
                  <Label htmlFor={`productPrice-${index}`} className="whitespace-nowrap text-xs">Price:</Label>
                  <div className="flex gap-1">
                    <Input 
                      id={`productPrice-${index}`}
                      type="number" 
                      step="0.01"
                      value={product.price || ''} 
                      onChange={(e) => {
                        const newProducts = [...extractedProducts]
                        newProducts[index] = { ...product, price: e.target.value ? parseFloat(e.target.value) : null }
                        setExtractedProducts(newProducts)
                      }}
                      className="h-8 text-sm"
                    />
                    <Input 
                      id={`productCurrency-${index}`}
                      value={product.currency} 
                      onChange={(e) => {
                        const newProducts = [...extractedProducts]
                        newProducts[index] = { ...product, currency: e.target.value }
                        setExtractedProducts(newProducts)
                      }}
                      className="h-8 text-sm w-16"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ocrResult && !extractedProducts.length && (
        <div className="p-3 bg-muted rounded-md">
          <Label>Extracted Text:</Label>
          <pre className="mt-2 text-sm whitespace-pre-wrap overflow-auto max-h-40">{ocrResult}</pre>
        </div>
      )}

      <Button type="submit" disabled={!file || loading || !ocrResult || extractedProducts.length > 0} className="w-full">
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

