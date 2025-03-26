"use client"

import type { Product } from "@/lib/types"
import { formatPrice, formatDate } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ProductList({ products, limit = 15 }: { products: Product[], limit?: number }) {
  if (products.length === 0) {
    return <p className="text-muted-foreground">No products found.</p>
  }

  // Take only the specified number of products
  const displayedProducts = products.slice(0, limit)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayedProducts.map((product) => (
        <Card key={product.id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-medium line-clamp-2">{product.name}</h3>
                <Badge variant="outline" className="shrink-0">
                  {product.currency === "UAH" ? "₴" : 
                   product.currency === "PLN" ? "zł" :
                   product.currency === "USD" ? "$" : 
                   product.currency}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-primary">
                {product.currency === "UAH" ? "₴" : 
                 product.currency === "PLN" ? "zł" : 
                 product.currency === "USD" ? "$" : ""}
                {product.price.toFixed(2)}
              </p>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="truncate">
                  {product.location?.name || "Unknown location"}
                </span>
                <time dateTime={product.created_at}>
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

