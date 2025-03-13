import type { Product } from "@/lib/types"
import { formatPrice, formatDate } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function ProductList({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="text-muted-foreground">No products found.</p>
  }

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <Card key={product.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{product.name}</h3>
                <p className="text-2xl font-bold text-primary">{formatPrice(product.price)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {product.location || "Unknown location"} • {formatDate(product.created_at)}
                </p>
              </div>
              <Badge variant="outline">{product.currency || "USD"}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

