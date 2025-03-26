import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useState, useRef, useEffect } from "react"
import { ZoomIn, ZoomOut, X, MoveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImageZoomModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
}

export function ImageZoomModal({ isOpen, onClose, imageUrl }: ImageZoomModalProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [isOpen])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.01
    const newScale = Math.min(Math.max(0.5, scale + delta), 4)
    setScale(newScale)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const zoomIn = () => {
    setScale(Math.min(scale + 0.5, 4))
  }

  const zoomOut = () => {
    setScale(Math.max(scale - 0.5, 0.5))
  }

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
        <div className="relative w-full h-full min-h-[50vh]">
          {/* Controls */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-black/50 p-2 rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomIn}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={zoomOut}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={resetZoom}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <MoveIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Image container */}
          <div
            ref={containerRef}
            className="w-full h-full overflow-hidden cursor-move bg-black/90"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.2s',
                transformOrigin: 'center',
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <img
                src={imageUrl}
                alt="Zoomed view"
                className="max-w-full max-h-[80vh] object-contain"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 