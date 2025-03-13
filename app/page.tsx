import { SearchForm } from "@/components/search-form"
import { UploadForm } from "@/components/upload-form"
import { ProductList } from "@/components/product-list"
import { searchProducts } from "@/lib/actions"

export default async function Home({
  searchParams,
}: {
  searchParams: { query?: string }
}) {
  const query = searchParams.query || ""
  const products = query ? await searchProducts(query) : []

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">GDKP - Grocery Price Tracker</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-4">Search Products</h2>
          <SearchForm initialQuery={query} />

          {query && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-2">Results for "{query}"</h3>
              <ProductList products={products} />
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Product Photo</h2>
          <UploadForm />
        </div>
      </div>
    </main>
  )
}

