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
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
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

            // Create preview
            const reader = new FileReader()
            reader.onload = (e) => {
              setPreview(e.target?.result as string)
            }
            reader.readAsDataURL(pastedFile)

            // Process the image with OCR
            await processImageWithOcr(pastedFile)
          }
        }
      }
    }

    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setOcrResult(null)

      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)

      // Process the image with OCR
      await processImageWithOcr(selectedFile)
    }
  }

  const processImageWithOcr = async (imageFile: File) => {
    setLoading(true)
    try {
      // Create a FormData object to send the image to our server action
      // which will then call the OCR.space API
      const formData = new FormData()
      formData.append("image", imageFile)
      formData.append("action", "ocr")

      // Call the server action to process OCR
      const response = await processProductImage(formData)

      if (response.success && response.ocrText) {
        setOcrResult(response.ocrText)
        console.log("OCR Result:", response.ocrText)
      } else {
        setOcrResult("OCR failed. Please try a clearer image.")
        setResult({
          success: false,
          message: response.message || "OCR processing failed",
        })
      }
    } catch (error) {
      console.error("OCR Error:", error)
      setOcrResult("OCR failed. Please try a clearer image.")
      setResult({
        success: false,
        message: "An error occurred during OCR processing",
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
      formData.append("action", "save")

      const result = await processProductImage(formData)
      setResult(result)

      if (result.success) {
        // Clear form on success
        setFile(null)
        setPreview(null)
        setOcrResult(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }

        // Refresh the page data after successful upload
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
    // Focus on the form to enable clipboard paste events
    if (formRef.current) {
      formRef.current.focus()
    }
    // Prompt user to paste
    setResult({
      success: true,
      message: "Press Ctrl+V or Cmd+V to paste an image from clipboard",
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" tabIndex={0}>
      <div className="grid gap-2">
        <Label htmlFor="product-image">Product Image</Label>
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

      <Alert>
        <AlertDescription>You can paste an image directly from clipboard using Ctrl+V / Cmd+V</AlertDescription>
      </Alert>

      {preview && (
        <Card className="overflow-hidden">
          <img src={preview || "/placeholder.svg"} alt="Preview" className="w-full h-auto max-h-64 object-contain" />
        </Card>
      )}

      {ocrResult && (
        <div className="p-3 bg-muted rounded-md">
          <Label>Extracted Text:</Label>
          <pre className="mt-2 text-sm whitespace-pre-wrap overflow-auto max-h-40">{ocrResult}</pre>
        </div>
      )}

      <Button type="submit" disabled={!file || loading || !ocrResult} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Save Product
          </>
        )}
      </Button>

      {result && (
        <div className={`p-3 rounded-md ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {result.message}
        </div>
      )}
    </form>
  )
}

