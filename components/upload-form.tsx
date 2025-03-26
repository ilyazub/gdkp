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

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<{ title?: string; price?: number } | null>(null)
  const [editableProductName, setEditableProductName] = useState<string>("")
  const [editablePrice, setEditablePrice] = useState<string>("")
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Setup clipboard paste event listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile()
          if (blob) {
            // Convert blob to File object
            const pastedFile = new File([blob], "pasted-image.png", { type: blob.type })
            setFile(pastedFile)
            setResult(null)
            setOcrResult(null)
            setExtractedData(null)

            const reader = new FileReader()
            reader.onload = (e) => {
              setPreview(e.target?.result as string)
            }
            reader.readAsDataURL(pastedFile)

            await processImageWithAI(pastedFile)
          }
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [])

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
          setFile(droppedFile)
          setResult(null)
          setOcrResult(null)
          setExtractedData(null)

          const reader = new FileReader()
          reader.onload = (e) => {
            setPreview(e.target?.result as string)
          }
          reader.readAsDataURL(droppedFile)

          await processImageWithAI(droppedFile)
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
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setOcrResult(null)
      setExtractedData(null)

      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)

      await processImageWithAI(selectedFile)
    }
  }

  const processImageWithAI = async (imageFile: File) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("image", imageFile)
      formData.append("action", "ocr")

      const response = await processProductImage(formData)

      if (response.success && response.ocrText) {
        setOcrResult(response.ocrText)
        
        if (response.extractedData) {
          setExtractedData(response.extractedData)

          setEditableProductName(response.extractedData.title || "")
          setEditablePrice(response.extractedData.price?.toString() || "")
          console.log("AI Extracted Data:", response.extractedData)
        }
      } else {
        setOcrResult("Image processing failed. Please try a clearer image.")
        setResult({
          success: false,
          message: response.message || "Image processing failed",
        })
      }
    } catch (error) {
      console.error("Image Processing Error:", error)
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
      const editedOcrText = `Product: ${editableProductName}\nPrice: ${editablePrice}`
      
      const formData = new FormData()
      formData.append("image", file)
      formData.append("ocrText", editedOcrText)
      formData.append("productName", editableProductName)
      formData.append("productPrice", editablePrice)
      formData.append("action", "save")

      const result = await processProductImage(formData)
      setResult(result)

      if (result.success) {
        setFile(null)
        setPreview(null)
        setOcrResult(null)
        setExtractedData(null)
        setEditableProductName("")
        setEditablePrice("")
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

      {extractedData && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-4">
          <div className="font-medium">AI-Detected Information (You can edit):</div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="productName">Product Name:</Label>
              <Input 
                id="productName" 
                value={editableProductName} 
                onChange={(e) => setEditableProductName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="productPrice">Price:</Label>
              <Input 
                id="productPrice" 
                type="number" 
                step="0.01"
                value={editablePrice} 
                onChange={(e) => setEditablePrice(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      )}

      {ocrResult && !extractedData && (
        <div className="p-3 bg-muted rounded-md">
          <Label>Extracted Text:</Label>
          <pre className="mt-2 text-sm whitespace-pre-wrap overflow-auto max-h-40">{ocrResult}</pre>
        </div>
      )}

      <Button type="submit" disabled={!file || loading || !ocrResult || !extractedData} className="w-full">
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

