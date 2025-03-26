-- Create products table with JSONB data type
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for product search using JSONB
CREATE INDEX IF NOT EXISTS products_name_idx ON products USING GIN ((data->'name'));

-- Create index for price search and sorting
CREATE INDEX IF NOT EXISTS products_price_idx ON products USING GIN ((data->'price'));

-- Create index for full text search
CREATE INDEX IF NOT EXISTS products_full_text_idx ON products USING GIN (to_tsvector('english', data->>'name'));

ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read all products
CREATE POLICY "Allow anonymous read access"
ON products FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to insert products
CREATE POLICY "Allow anonymous insert access"
ON products FOR INSERT
TO anon
WITH CHECK (true);

ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert products
CREATE POLICY "Allow anonymous insert access"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (true);