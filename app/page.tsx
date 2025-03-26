import { UploadForm } from "@/components/upload-form"
import { ProductList } from "@/components/product-list"
import { SearchForm } from "@/components/search-form"
import { searchProducts, getRecentProducts } from "@/lib/actions"

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: { query?: string }
}) {
  const searchParamsData = await Promise.resolve(searchParams);
  const query = typeof searchParamsData.query === 'string' ? searchParamsData.query : "";
  
  // Get either search results or recent products
  const products = query ? await searchProducts(query) : await getRecentProducts();

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">GDKP - Grocery Price Tracker</h1>
        <p className="text-muted-foreground">Track and compare grocery prices across different stores</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[3fr,2fr] items-start">
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Search Products</h2>
            <SearchForm initialQuery={query} />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">
                {query ? `Results for "${query}"` : "Recent Products"}
              </h3>
              {!query && (
                <p className="text-sm text-muted-foreground">
                  Showing latest 15 products
                </p>
              )}
            </div>
            <ProductList 
              products={products.data || []} 
              limit={15}
            />
          </div>
        </div>

        <div className="lg:sticky lg:top-8 space-y-4 bg-card p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold">Upload Product Photo</h2>
          <UploadForm />
        </div>
      </div>
    </main>
  )
}

