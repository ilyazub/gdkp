import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Steps, Step } from "@/components/ui/steps"

export default function SetupGuide() {
  return (
    <Card className="max-w-3xl mx-auto my-8">
      <CardHeader>
        <CardTitle>GDKP Setup Guide</CardTitle>
        <CardDescription>Follow these steps to complete your Supabase setup</CardDescription>
      </CardHeader>
      <CardContent>
        <Steps>
          <Step title="Create Storage Bucket">
            <p>
              In your Supabase dashboard, go to Storage and create a new bucket called <code>product-images</code>.
            </p>
            <p>Make sure to set the bucket's privacy settings to allow public access for image URLs.</p>
          </Step>

          <Step title="Set Up Database Tables">
            <p>
              Go to the SQL Editor in your Supabase dashboard and run the schema SQL from the <code>schema.sql</code>{" "}
              file.
            </p>
            <p>This will create the products table with the necessary fields and indexes.</p>
          </Step>

          <Step title="Enable Row Level Security (RLS)">
            <p>For the products table, enable Row Level Security and create policies that allow:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Anyone to read products</li>
              <li>Authenticated users to insert products</li>
            </ul>
          </Step>

          <Step title="Test Your Application">
            <p>Once deployed, test the application by:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Uploading a product image with visible price text</li>
              <li>Searching for products</li>
              <li>Verifying the OCR results</li>
            </ul>
          </Step>
        </Steps>
      </CardContent>
    </Card>
  )
}

