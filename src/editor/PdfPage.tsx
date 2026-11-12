import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { AnnotationLayer } from './AnnotationLayer'
import { zoomAtom } from './state'
import type { EditorPage } from './types'

/**
 * Most pixels one page's canvas may have (64 MB). Past this a zoomed-in page renders at a lower
 * resolution than the screen's: a bit blurry, but browsers (Safari especially) fail outright on
 * canvases much bigger than this.
 */
const MAX_CANVAS_PIXELS = 4096 * 4096

/**
 * One page: the PDF rendered into a canvas, with the page's annotations on top.
 *
 * Only pages near the visible area are rendered. Further ones are kept as empty white boxes of the
 * right size, since a long scanned PDF rendered in full would need gigabytes of memory.
 */
export function PdfPage({ pdf, page, pageIndex }: { pdf: PDFDocumentProxy; page: EditorPage; pageIndex: number }) {
  const zoom = useAtomValue(zoomAtom)
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isNearView, setIsNearView] = useState(false)

  useEffect(() => {
    // "Near" = within one screen height above or below what's visible, so pages are usually ready
    // by the time they scroll into view.
    const observer = new IntersectionObserver(
      (entries) => setIsNearView(entries[entries.length - 1].isIntersecting),
      { rootMargin: '100% 0px' },
    )
    observer.observe(boxRef.current!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    if (!isNearView) {
      // Frees the page's pixels.
      canvas.width = 0
      canvas.height = 0
      return
    }

    let cancelled = false
    let renderTask: RenderTask | undefined
    // Render off-screen and copy the result over when it's done. On a zoom change the old image
    // stays up (stretched) until then, instead of the page going blank while it renders.
    const offscreen = document.createElement('canvas')

    const render = async () => {
      const pdfPage = await pdf.getPage(pageIndex + 1)
      if (cancelled) return
      const cssWidth = page.width * zoom
      const cssHeight = page.height * zoom
      const pixelRatio = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight)))
      const viewport = pdfPage.getViewport({ scale: zoom * pixelRatio })
      offscreen.width = Math.floor(viewport.width)
      offscreen.height = Math.floor(viewport.height)
      // The default annotationMode draws form field values and the PDF's own annotations into the
      // canvas, which matches the saved PDF (the export flattens form fields).
      renderTask = pdfPage.render({ canvas: offscreen, viewport })
      await renderTask.promise
      if (cancelled) return
      canvas.width = offscreen.width
      canvas.height = offscreen.height
      canvas.getContext('2d')!.drawImage(offscreen, 0, 0)
    }

    render()
      .catch((err) => {
        // Cancelling (zoom changed, page scrolled away, document closed) rejects with an error too.
        if (!cancelled) console.error(`Could not render page ${pageIndex + 1}`, err)
      })
      .finally(() => {
        // Release the off-screen pixels now rather than whenever garbage collection gets to them.
        offscreen.width = 0
        offscreen.height = 0
      })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdf, page, pageIndex, zoom, isNearView])

  return (
    // No z-index, opacity, transform, filter or isolation here: highlights use mix-blend-mode, which
    // only blends with the canvas if nothing in between starts a new stacking context.
    <div
      ref={boxRef}
      style={{
        position: 'relative',
        width: page.width * zoom,
        height: page.height * zoom,
        // Centers the page; when zoomed wider than the screen it starts at the left edge instead,
        // so all of it can be scrolled to.
        margin: '0 auto',
        flexShrink: 0,
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
      }}
    >
      <canvas ref={canvasRef} aria-label={`Page ${pageIndex + 1}`} style={{ display: 'block', width: '100%', height: '100%' }} />
      <AnnotationLayer pageIndex={pageIndex} />
    </div>
  )
}
