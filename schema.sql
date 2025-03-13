-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  location TEXT,
  image_url TEXT,
  ocr_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for product search
CREATE INDEX products_name_idx ON products USING GIN (to_tsvector('english', name));

-- Create storage bucket for product images
-- Note: This is done through the Supabase dashboard or CLI

