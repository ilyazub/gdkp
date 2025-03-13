import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Create a new FormData to send to OCR.space
    const ocrFormData = new FormData()

    // Add the file with a specific name that OCR.space expects
    ocrFormData.append("file", imageFile)

    // Add other required parameters
    ocrFormData.append("language", "eng")
    ocrFormData.append("isOverlayRequired", "false")
    ocrFormData.append("scale", "true")
    ocrFormData.append("OCREngine", "2")
    ocrFormData.append("apikey", process.env.OCR_SPACE_API_KEY || "helloworld") // Free API key for testing

    // Call OCR.space API with FormData
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: ocrFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("OCR API error:", errorText)
      return NextResponse.json({ error: "OCR API error: " + errorText }, { status: 500 })
    }

    const data = await response.json()

    if (data.IsErroredOnProcessing) {
      console.error("OCR processing error:", data.ErrorMessage)
      return NextResponse.json({ error: data.ErrorMessage }, { status: 500 })
    }

    // Extract the parsed text from the response
    const parsedText = data.ParsedResults?.[0]?.ParsedText

    if (!parsedText) {
      return NextResponse.json({ error: "No text found in the image" }, { status: 404 })
    }

    return NextResponse.json({ text: parsedText })
  } catch (error) {
    console.error("OCR API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

