-- Create products table with JSONB data type
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for product search using JSONB
CREATE INDEX products_name_idx ON products USING GIN ((data->'name'));

-- Create index for price search and sorting
CREATE INDEX products_price_idx ON products USING GIN ((data->'price'));

-- Create index for full text search
CREATE INDEX products_full_text_idx ON products USING GIN (to_tsvector('english', data->>'name'));

-- Create storage bucket for product images
-- Note: This is done through the Supabase dashboard or CLI

