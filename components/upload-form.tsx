"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2, Camera, Clipboard, ZoomIn, Trash2 } from "lucide-react"
import { processProductImage, uploadImage } from "@/lib/actions"
import type { OcrResult } from "@/lib/types"
import { compressImage, extractExifData } from "@/lib/utils"
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
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const processFile = async (file: File) => {
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setResult({
        success: false,
        message: "File size must be less than 10MB",
      })
      return
    }

    setFile(file)
    setResult(null)
    setOcrResult(null)
    setExtractedProducts([])
    setLocation({ name: "", address: "" })
    setImageUrl(null)

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

    // Upload image first
    try {
      const uploadResponse = await uploadImage(file)
      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error?.message || "Failed to upload image")
      }
      setImageUrl(uploadResponse.data?.url || null)

      // Then process with AI
      const compressedFile = await compressImage(file)
      await processImageWithAI(compressedFile)
    } catch (error) {
      console.error('Error processing file:', error)
      setResult({
        success: false,
        message: 'Failed to process image. Please try again.',
      })
    }
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

  const processImageWithAI = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/image-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process image');
      }

      const data = await response.json();
      
      // Handle both array and single product responses
      const products = Array.isArray(data) ? data : [data];
      
      // Validate and normalize each product
      const normalizedProducts: OcrResult[] = products.map(product => ({
        text: product.productName || '',
        productName: product.productName || '',
        price: typeof product.price === 'number' ? product.price : null,
        currency: product.currency || 'USD'
      }));

      setOcrResult(normalizedProducts[0]?.text || '');
      setExtractedProducts(normalizedProducts);
    } catch (error) {
      console.error('Error processing image:', error);
      setResult({
        success: false,
        message: 'Failed to process image. Please try again.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !imageUrl || extractedProducts.length === 0) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("action", "save")
      formData.append("products", JSON.stringify(extractedProducts))
      formData.append("location", JSON.stringify(location))
      formData.append("imageUrl", imageUrl)

      const response = await processProductImage(formData)
      setResult({
        success: response.success,
        message: response.success ? (response.data?.message ?? "Success") : (response.error?.message ?? "An error occurred")
      })

      if (response.success) {
        setFile(null)
        setPreview(null)
        setOcrResult(null)
        setExtractedProducts([])
        setLocation({ name: "", address: "" })
        setImageUrl(null)
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
        className={`border-2 border-dashed rounded-md p-4 text-center relative ${
          isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
        }`}
      >
        <div className="flex items-center justify-center gap-3">
          <Input
            id="product-image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={loading}
            className="w-[0.1px] h-[0.1px] opacity-0 overflow-hidden absolute"
            ref={fileInputRef}
            capture={undefined}
          />
          <label 
            htmlFor="product-image" 
            className="cursor-pointer flex items-center gap-2 text-sm font-medium hover:text-primary"
          >
            <Upload className="h-5 w-5" />
            Choose file or drag & drop
          </label>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                  // Reset capture after click to allow normal file selection next time
                  setTimeout(() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                    }
                  }, 100);
                }
              }} 
              disabled={loading} 
              title="Take photo with camera"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePasteClick}
              disabled={loading}
              title="Paste from clipboard (Ctrl+V / Cmd+V)"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {result && !preview && (
        <div
          className={`p-2 text-sm rounded-md ${
            result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </div>
      )}

      {preview && (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-auto rounded-md cursor-zoom-in"
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
          <ImageZoomModal
            isOpen={isZoomModalOpen}
            onClose={() => setIsZoomModalOpen(false)}
            imageUrl={preview}
          />
        </div>
      )}

      {extractedProducts.length > 0 && (
        <div className="p-6 bg-green-50 border border-green-200 rounded-md">
          <div className="flex justify-between items-center mb-4">
            <div className="font-medium">AI-Detected Products (You can edit):</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setExtractedProducts([
                  ...extractedProducts,
                  { productName: '', text: '', price: null, currency: 'USD' }
                ])
              }}
            >
              Add Product
            </Button>
          </div>
          
          <div className="rounded-md border bg-white">
            <div className="grid grid-cols-[1fr,auto,auto] gap-4 p-3 border-b bg-muted/50 font-medium text-sm">
              <div>Product Name</div>
              <div className="w-[200px]">Price</div>
              <div className="w-[40px]"></div>
            </div>
            
            <div className="divide-y">
              {extractedProducts.map((product, index) => {
                const hasNameError = !product.productName?.trim();
                const hasPriceError = product.price === null || product.price === undefined || isNaN(Number(product.price));
                const productKey = `product-${index}-${product.productName}`;
                
                return (
                  <div key={productKey} className="grid grid-cols-[1fr,auto,auto] gap-4 p-3 items-start">
                    <div>
                      <Input 
                        id={`product-name-${productKey}`}
                        value={product.productName || ''} 
                        onChange={(e) => {
                          const newProducts = [...extractedProducts];
                          newProducts[index] = { ...product, productName: e.target.value, text: e.target.value };
                          setExtractedProducts(newProducts);
                        }}
                        className={hasNameError ? 'border-red-500' : ''}
                        placeholder="Product name"
                      />
                      {hasNameError && <p className="text-xs text-red-500 mt-1">Name is required</p>}
                    </div>
                    
                    <div className="flex gap-2 w-[200px]">
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
                        className={hasPriceError ? 'border-red-500' : ''}
                        placeholder="0.00"
                      />
                      <Input 
                        id={`product-currency-${productKey}`}
                        value={product.currency || ''} 
                        onChange={(e) => {
                          const newProducts = [...extractedProducts];
                          newProducts[index] = { ...product, currency: e.target.value };
                          setExtractedProducts(newProducts);
                        }}
                        className="w-20"
                        placeholder="USD"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const newProducts = [...extractedProducts];
                        newProducts.splice(index, 1);
                        setExtractedProducts(newProducts);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove product</span>
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Show a message when there are no products */}
          {extractedProducts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No products yet. Click "Add Product" to add one manually.</p>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location-name" className="text-sm font-medium">Store Name (optional):</Label>
              <Input
                id="location-name"
                value={location.name}
                onChange={(e) => setLocation(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter store name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-address" className="text-sm font-medium">Address (optional):</Label>
              <Input
                id="location-address"
                value={location.address}
                onChange={(e) => setLocation(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter store address or coordinates"
              />
            </div>
            <p className="text-xs text-muted-foreground">
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
          !p.productName?.trim()
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
    </form>
  )
}

