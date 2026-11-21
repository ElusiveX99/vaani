"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Props = {
  documentUrl: string;
  currentPage: number;
  currentOffset: number;
  canControl: boolean;
  onPageChange: (page: number) => void;
  onPositionChange: (page: number, offset: number) => void;
};

type PdfPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
};

type PdfDocument = {
  numPages: number;
  getPage: (page: number) => Promise<PdfPage>;
};

type PageMetric = { width: number; height: number };

const PDF_OPTIONS = {
  disableRange: false,
  disableStream: true,
  disableAutoFetch: true,
};

const PAGE_GAP = 20;
const MAX_PAGE_WIDTH = 1100;
const OVERSCAN_PAGES = 2;
const POSITION_THROTTLE_MS = 80;

const PdfPageView = memo(function PdfPageView({
  pageNumber,
  width,
  height,
  devicePixelRatio,
}: {
  pageNumber: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}) {
  return (
    <div
      className="flex w-full shrink-0 justify-center"
      style={{ height: height + PAGE_GAP, paddingBottom: PAGE_GAP }}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        devicePixelRatio={devicePixelRatio}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={
          <div
            className="flex items-center justify-center rounded bg-white/[0.04] text-xs text-white/40"
            style={{ width, height }}
          >
            Loading page {pageNumber}…
          </div>
        }
        error={
          <div
            className="flex items-center justify-center rounded border border-red-400/20 bg-red-950/20 px-4 text-center text-xs text-red-200"
            style={{ width, height }}
          >
            Page {pageNumber} could not be rendered.
          </div>
        }
      />
    </div>
  );
});

function findPageAtOffset(offsets: number[], value: number) {
  let low = 0;
  let high = Math.max(0, offsets.length - 2);

  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (offsets[middle] <= value) low = middle;
    else high = middle - 1;
  }

  return low;
}

function clampPage(page: number, count: number) {
  return Math.min(count, Math.max(1, Math.floor(page) || 1));
}

function getPageWidth(container: HTMLDivElement) {
  return Math.max(1, Math.min(MAX_PAGE_WIDTH, container.clientWidth - 28));
}

export default function PdfReader({
  documentUrl,
  currentPage,
  currentOffset,
  canControl,
  onPageChange,
  onPositionChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(0);
  const scrollFrameRef = useRef<number | null>(null);
  const lastPositionAtRef = useRef(0);
  const lastReportedPageRef = useRef(currentPage);
  const lastReportedOffsetRef = useRef(currentOffset);
  const lastAppliedLayoutRef = useRef("");
  const lastWindowRef = useRef(-1);

  const [numPages, setNumPages] = useState(0);
  const [metrics, setMetrics] = useState<PageMetric[]>([]);
  const [pageWidth, setPageWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [inputDraft, setInputDraft] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [error, setError] = useState("");
  const [metricsLoading, setMetricsLoading] = useState(false);

  const pageHeights = useMemo(
    () => metrics.map((metric) => (pageWidth > 0 ? pageWidth * metric.height / metric.width : 0) + PAGE_GAP),
    [metrics, pageWidth]
  );

  const pageOffsets = useMemo(() => {
    const offsets = new Array(pageHeights.length + 1).fill(0);
    for (let index = 0; index < pageHeights.length; index += 1) {
      offsets[index + 1] = offsets[index] + pageHeights[index];
    }
    return offsets;
  }, [pageHeights]);

  const totalHeight = pageOffsets[pageOffsets.length - 1] ?? 0;
  const safeCurrentPage = numPages ? clampPage(currentPage, numPages) : 1;
  const visibleIndex = pageOffsets.length > 1
    ? findPageAtOffset(pageOffsets, Math.max(0, scrollTop))
    : 0;
  const visibleCount = Math.max(
    1,
    Math.ceil(containerHeight / Math.max(1, pageHeights[visibleIndex] ?? 700))
  );
  const firstIndex = Math.max(0, visibleIndex - OVERSCAN_PAGES);
  const lastIndex = Math.min(
    numPages - 1,
    visibleIndex + visibleCount + OVERSCAN_PAGES
  );
  const renderedPages = useMemo(() => {
    if (!numPages || !metrics.length) return [];
    return Array.from(
      { length: Math.max(0, lastIndex - firstIndex + 1) },
      (_, index) => firstIndex + index
    );
  }, [firstIndex, lastIndex, metrics.length, numPages]);

  const topSpacerHeight = pageOffsets[firstIndex] ?? 0;
  const bottomSpacerHeight = Math.max(0, totalHeight - (pageOffsets[lastIndex + 1] ?? totalHeight));
  const inputPage = inputDraft ?? String(safeCurrentPage);

  const applyPosition = useCallback((page: number, offset: number) => {
    const container = containerRef.current;
    if (!container || !pageOffsets.length || !numPages) return;

    const safePage = clampPage(page, numPages);
    const index = safePage - 1;
    const pageTop = pageOffsets[index] ?? 0;
    const rowHeight = pageHeights[index] ?? 1;
    const safeOffset = Math.min(1, Math.max(0, offset));
    const nextTop = pageTop + safeOffset * rowHeight;

    container.scrollTo({ top: nextTop, behavior: "auto" });
    setScrollTop(nextTop);
    lastWindowRef.current = findPageAtOffset(pageOffsets, nextTop);
    lastReportedPageRef.current = safePage;
    lastReportedOffsetRef.current = safeOffset;
  }, [numPages, pageOffsets, pageHeights]);

  const jumpToPage = useCallback((page: number) => {
    if (!canControl || !Number.isSafeInteger(page) || page < 1 || page > numPages) return;
    applyPosition(page, 0);
    onPageChange(page);
    onPositionChange(page, 0);
    setInputDraft(null);
  }, [applyPosition, canControl, numPages, onPageChange, onPositionChange]);

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const container = containerRef.current;
      if (!container || !numPages || !pageOffsets.length) return;

      const top = Math.max(0, container.scrollTop);
      const index = Math.min(numPages - 1, findPageAtOffset(pageOffsets, top));
      const page = index + 1;
      const pageTop = pageOffsets[index] ?? 0;
      const rowHeight = Math.max(1, pageHeights[index] ?? 1);
      const offset = Math.min(1, Math.max(0, (top - pageTop) / rowHeight));

      if (index !== lastWindowRef.current) {
        lastWindowRef.current = index;
        setScrollTop(top);
      }

      if (page !== lastReportedPageRef.current) {
        lastReportedPageRef.current = page;
        onPageChange(page);
      }

      const now = performance.now();
      if (now - lastPositionAtRef.current >= POSITION_THROTTLE_MS) {
        lastPositionAtRef.current = now;
        lastReportedOffsetRef.current = offset;
        onPositionChange(page, offset);
      }
    });
  }, [canControl, numPages, onPageChange, onPositionChange, pageOffsets, pageHeights]);

  async function handleDocumentLoad(pdf: PdfDocument) {
    const generation = ++generationRef.current;
    setNumPages(pdf.numPages);
    setMetrics([]);
    setError("");
    setMetricsLoading(true);

    try {
      const firstPage = await pdf.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: 1 });
      if (!firstViewport.width || !firstViewport.height) {
        throw new Error("Invalid dimensions on page 1.");
      }

      const firstMetric = {
        width: firstViewport.width,
        height: firstViewport.height,
      };

      // Show the first page immediately. Until each page's dimensions arrive,
      // use page 1's ratio as a temporary estimate; restore the anchor after
      // exact measurements replace the estimates.
      setMetrics(Array.from({ length: pdf.numPages }, () => firstMetric));

      if (pdf.numPages === 1) {
        setMetricsLoading(false);
        return;
      }

      const exactMetrics: PageMetric[] = new Array(pdf.numPages);
      exactMetrics[0] = firstMetric;
      let cursor = 2;

      const worker = async () => {
        while (true) {
          const pageNumber = cursor++;
          if (pageNumber > pdf.numPages || generation !== generationRef.current) return;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          if (!viewport.width || !viewport.height) {
            throw new Error(`Invalid dimensions on page ${pageNumber}.`);
          }
          exactMetrics[pageNumber - 1] = {
            width: viewport.width,
            height: viewport.height,
          };
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(4, pdf.numPages - 1) }, () => worker())
      );

      if (generation !== generationRef.current) return;
      setMetrics(exactMetrics);
      setMetricsLoading(false);
    } catch (loadError) {
      if (generation !== generationRef.current) return;
      console.error("Unable to measure PDF pages:", loadError);
      setMetricsLoading(false);
      setError("Some PDF page information could not be loaded. Please reopen the document.");
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      setPageWidth(getPageWidth(container));
      setContainerHeight(container.clientHeight);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updatePixelRatio = () => {
      setDevicePixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    };
    updatePixelRatio();
    window.addEventListener("resize", updatePixelRatio, { passive: true });
    return () => window.removeEventListener("resize", updatePixelRatio);
  }, []);

  useEffect(() => {
    if (!numPages || metrics.length !== numPages || !pageOffsets.length) return;

    const layoutKey = `${pageWidth}:${numPages}:${metrics.map((metric) => metric.width + "x" + metric.height).join(",")}`;
    const layoutChanged = lastAppliedLayoutRef.current !== layoutKey;

    if (layoutChanged) {
      lastAppliedLayoutRef.current = layoutKey;
      applyPosition(currentPage, currentOffset);
      return;
    }

    if (
      currentPage !== lastReportedPageRef.current ||
      Math.abs(currentOffset - lastReportedOffsetRef.current) > 0.01
    ) {
      applyPosition(currentPage, currentOffset);
    }
  }, [applyPosition, currentOffset, currentPage, metrics, numPages, pageOffsets, pageWidth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pageOffsets.length) return;
    const nextIndex = findPageAtOffset(pageOffsets, container.scrollTop);
    if (nextIndex !== lastWindowRef.current) {
      lastWindowRef.current = nextIndex;
      setScrollTop(container.scrollTop);
    }
  }, [pageOffsets]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  function submitPageJump() {
    const page = Number(inputPage);
    if (!Number.isSafeInteger(page) || page < 1 || page > numPages) {
      setInputDraft(null);
      return;
    }
    jumpToPage(page);
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--conference-line)] bg-[var(--conference-surface)] text-white">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--conference-line)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium">PDF</span>
          <span className="shrink-0 text-[11px] tabular-nums text-white/45">
            {numPages ? `${safeCurrentPage} / ${numPages}` : "Loading"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {controlsVisible && (
            <>
              <button
                type="button"
                disabled={!canControl || safeCurrentPage <= 1 || !numPages}
                onClick={() => jumpToPage(safeCurrentPage - 1)}
                aria-label="Previous page"
                className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20 disabled:opacity-30"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min={1}
                  max={numPages || undefined}
                  value={inputPage}
                  disabled={!canControl || !numPages}
                  onChange={(event) => setInputDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitPageJump();
                  }}
                  className="w-12 rounded-md border border-white/15 bg-white/10 px-1.5 py-1.5 text-center text-white outline-none focus:border-white/40 disabled:opacity-50"
                  aria-label="Go to page"
                />
                <span className="text-white/40">/ {numPages || "—"}</span>
              </div>
              <button
                type="button"
                disabled={!canControl || !numPages || safeCurrentPage >= numPages}
                onClick={() => jumpToPage(safeCurrentPage + 1)}
                aria-label="Next page"
                className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20 disabled:opacity-30"
              >
                Next
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setControlsVisible((visible) => !visible)}
            aria-expanded={controlsVisible}
            aria-label={controlsVisible ? "Hide PDF controls" : "Show PDF controls"}
            title={controlsVisible ? "Hide controls" : "Show controls"}
            className="rounded-md bg-white/10 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/20"
          >
            {controlsVisible ? "Done" : "⋯"}
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="shrink-0 px-4 py-2 text-center text-xs text-red-300">
          {error}
        </p>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2 py-3 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]"
      >
        <Document
          key={documentUrl}
          file={documentUrl}
          options={PDF_OPTIONS}
          onLoadSuccess={(pdf) => void handleDocumentLoad(pdf)}
          onLoadError={(loadError) => {
            console.error("Unable to load PDF:", loadError);
            setError("Unable to load this PDF. Please try reopening the reader.");
          }}
          loading={
            <p className="py-10 text-center text-sm text-white/50">Loading PDF…</p>
          }
          error={
            <p className="py-10 text-center text-sm text-red-300">Unable to open this PDF.</p>
          }
        >
          {metricsLoading && !metrics.length && (
            <p className="py-10 text-center text-xs text-white/45">Preparing page layout…</p>
          )}
          <div style={{ height: topSpacerHeight }} />
          {renderedPages.map((index) => {
            const metric = metrics[index];
            if (!metric || !pageWidth) return null;
            const height = pageWidth * metric.height / metric.width;
            return (
              <PdfPageView
                key={index + 1}
                pageNumber={index + 1}
                width={pageWidth}
                height={height}
                devicePixelRatio={devicePixelRatio}
              />
            );
          })}
          <div style={{ height: bottomSpacerHeight }} />
        </Document>
      </div>
    </section>
  );
}
