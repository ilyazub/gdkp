"use client"

import type { Product } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ProductList({ products, limit = 15 }: { products: Product[], limit?: number }) {
  if (products.length === 0) {
    return <p className="text-muted-foreground">No products found.</p>
  }

  // Take only the specified number of products
  const displayedProducts = products.slice(0, limit)

  const formatCurrency = (price: number | null, currency: string) => {
    if (price === null) return "Price not available";
    
    const symbol = currency === "UAH" ? "₴" : 
                  currency === "PLN" ? "zł" : 
                  currency === "USD" ? "$" : 
                  currency;
    
    // Format with the symbol based on currency convention
    const formattedPrice = price.toFixed(2);
    return currency === "UAH" || currency === "PLN" 
      ? `${formattedPrice} ${symbol}`
      : `${symbol}${formattedPrice}`;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {displayedProducts.map((product) => (
        <Card key={product.id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-3">
                <h3 className="font-medium line-clamp-2 flex-1">{product.name}</h3>
                <Badge variant="secondary" className="shrink-0 uppercase text-xs">
                  {product.currency}
                </Badge>
              </div>
              <p className={`text-2xl font-bold ${product.price === null ? 'text-muted-foreground' : 'text-primary'}`}>
                {formatCurrency(product.price, product.currency)}
              </p>
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
                <span className="truncate max-w-[60%]">
                  {product.location?.name || "Unknown location"}
                </span>
                <time dateTime={product.created_at} className="text-xs">
                  {formatDate(product.created_at)}
                </time>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

