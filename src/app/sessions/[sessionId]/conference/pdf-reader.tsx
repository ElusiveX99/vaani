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
type Position = { page: number; offset: number };
type VisibleRange = { first: number; last: number };

const PDF_OPTIONS = {
  disableRange: false,
  disableStream: true,
  disableAutoFetch: true,
};

const PAGE_GAP = 18;
const MAX_PAGE_WIDTH = 1100;
const MAX_RENDER_WIDTH = 1650;
const OVERSCAN_PAGES = 2;
const POSITION_REPORT_INTERVAL = 50;
const POSITION_EPSILON = 0.002;

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
      className="flex w-full min-w-0 shrink-0 justify-center pb-[18px]"
      style={{ minHeight: height + PAGE_GAP }}
    >
      <Page
        pageNumber={pageNumber}
        width={width}
        devicePixelRatio={devicePixelRatio}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={
          <div
            className="flex items-center justify-center rounded-lg border border-black/5 bg-white text-xs text-slate-400"
            style={{ width, height }}
          >
            Rendering page {pageNumber}…
          </div>
        }
        error={
          <div
            className="flex items-center justify-center rounded-lg border border-red-300/30 bg-red-950/20 px-4 text-center text-xs text-red-200"
            style={{ width, height }}
          >
            This page could not be rendered. Other pages remain available.
          </div>
        }
      />
    </div>
  );
});

function clampPage(page: number, count: number) {
  return Math.min(count, Math.max(1, Math.floor(page) || 1));
}

function clampOffset(offset: number) {
  return Math.min(1, Math.max(0, Number.isFinite(offset) ? offset : 0));
}

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
  const positionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPositionRef = useRef<Position>({
    page: Math.max(1, currentPage),
    offset: clampOffset(currentOffset),
  });
  const lastReportedPositionRef = useRef<Position>({
    page: Math.max(1, currentPage),
    offset: clampOffset(currentOffset),
  });
  const lastAppliedLayoutRef = useRef("");
  const visibleRangeRef = useRef<VisibleRange>({ first: 0, last: 3 });
  const suppressReportsUntilRef = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [metrics, setMetrics] = useState<PageMetric[]>([]);
  const [basePageWidth, setBasePageWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    first: 0,
    last: 3,
  });
  const [visiblePage, setVisiblePage] = useState(Math.max(1, currentPage));
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageDraft, setPageDraft] = useState("");
  const [error, setError] = useState("");
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const pageWidth = Math.max(
    1,
    Math.min(MAX_RENDER_WIDTH, basePageWidth * zoom)
  );

  const pageHeights = useMemo(
    () =>
      metrics.map((metric) =>
        pageWidth > 0 ? (pageWidth * metric.height) / metric.width : 0
      ),
    [metrics, pageWidth]
  );

  const pageOffsets = useMemo(() => {
    const offsets = new Array(pageHeights.length + 1).fill(0);
    for (let index = 0; index < pageHeights.length; index += 1) {
      offsets[index + 1] = offsets[index] + pageHeights[index] + PAGE_GAP;
    }
    return offsets;
  }, [pageHeights]);

  const totalHeight = pageOffsets[pageOffsets.length - 1] ?? 0;
  const safeCurrentPage = numPages ? clampPage(visiblePage, numPages) : 1;
  const inputPage = pageDraft || String(safeCurrentPage);
  const firstIndex = Math.min(
    Math.max(0, visibleRange.first),
    Math.max(0, numPages - 1)
  );
  const lastIndex = Math.min(
    Math.max(firstIndex, visibleRange.last),
    Math.max(0, numPages - 1)
  );
  const topSpacerHeight = pageOffsets[firstIndex] ?? 0;
  const bottomSpacerHeight = Math.max(
    0,
    totalHeight - (pageOffsets[lastIndex + 1] ?? totalHeight)
  );

  const updateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container || !numPages || pageOffsets.length < 2) return;

    const top = Math.max(0, container.scrollTop);
    const bottom = Math.min(
      Math.max(0, totalHeight - 1),
      top + Math.max(1, container.clientHeight)
    );
    const firstVisible = findPageAtOffset(pageOffsets, top);
    const lastVisible = findPageAtOffset(pageOffsets, bottom);
    const next = {
      first: Math.max(0, firstVisible - OVERSCAN_PAGES),
      last: Math.min(numPages - 1, lastVisible + OVERSCAN_PAGES),
    };

    if (
      next.first !== visibleRangeRef.current.first ||
      next.last !== visibleRangeRef.current.last
    ) {
      visibleRangeRef.current = next;
      setVisibleRange(next);
    }
  }, [numPages, pageOffsets, totalHeight]);

  const applyPosition = useCallback(
    (page: number, offset: number) => {
      const container = containerRef.current;
      if (!container || !numPages || metrics.length !== numPages) return;

      const safePage = clampPage(page, numPages);
      const safeOffset = clampOffset(offset);
      const index = safePage - 1;
      const pageTop = pageOffsets[index] ?? 0;
      const contentHeight = pageHeights[index] ?? 1;
      const nextTop = pageTop + safeOffset * contentHeight;

      pendingPositionRef.current = { page: safePage, offset: safeOffset };
      lastReportedPositionRef.current = {
        page: safePage,
        offset: safeOffset,
      };
      setVisiblePage(safePage);
      suppressReportsUntilRef.current = performance.now() + 120;

      if (Math.abs(container.scrollTop - nextTop) > 1) {
        container.scrollTo({ top: nextTop, behavior: "auto" });
      }
      updateVisibleRange();
    },
    [metrics.length, numPages, pageOffsets, pageHeights]
  );

  const reportPendingPosition = useCallback(() => {
    positionTimerRef.current = null;
    const next = pendingPositionRef.current;
    const previous = lastReportedPositionRef.current;

    if (
      next.page === previous.page &&
      Math.abs(next.offset - previous.offset) < POSITION_EPSILON
    ) {
      return;
    }

    lastReportedPositionRef.current = next;
    if (next.page !== previous.page) onPageChange(next.page);
    onPositionChange(next.page, next.offset);
  }, [onPageChange, onPositionChange]);

  const schedulePositionReport = useCallback(() => {
    if (positionTimerRef.current !== null) return;
    positionTimerRef.current = window.setTimeout(
      reportPendingPosition,
      POSITION_REPORT_INTERVAL
    );
  }, [reportPendingPosition]);

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const container = containerRef.current;
      if (!container || !numPages || pageOffsets.length < 2) return;

      updateVisibleRange();

      const top = Math.max(0, container.scrollTop);
      const index = Math.min(
        numPages - 1,
        findPageAtOffset(pageOffsets, top)
      );
      const pageTop = pageOffsets[index] ?? 0;
      const contentHeight = Math.max(1, pageHeights[index] ?? 1);
      const offset = clampOffset((top - pageTop) / contentHeight);
      const next = { page: index + 1, offset };

      pendingPositionRef.current = next;
      setVisiblePage(next.page);

      if (performance.now() >= suppressReportsUntilRef.current) {
        schedulePositionReport();
      }
    });
  }, [
    numPages,
    pageOffsets,
    pageHeights,
    schedulePositionReport,
    updateVisibleRange,
  ]);

  useEffect(() => {
    generationRef.current += 1;
    lastAppliedLayoutRef.current = "";
    const initial = {
      page: Math.max(1, currentPage),
      offset: clampOffset(currentOffset),
    };
    pendingPositionRef.current = initial;
    lastReportedPositionRef.current = initial;
    visibleRangeRef.current = { first: 0, last: 3 };
    setVisibleRange(visibleRangeRef.current);
    setNumPages(0);
    setMetrics([]);
    setError("");
    setMetricsLoading(false);
    setLoadProgress(0);
  }, [documentUrl]);

  async function handleDocumentLoad(pdf: PdfDocument) {
    const generation = ++generationRef.current;
    setNumPages(pdf.numPages);
    setMetrics([]);
    setError("");
    setLoadProgress(100);
    setMetricsLoading(true);
    visibleRangeRef.current = { first: 0, last: Math.min(3, pdf.numPages - 1) };
    setVisibleRange(visibleRangeRef.current);

    if (!Number.isSafeInteger(pdf.numPages) || pdf.numPages < 1) {
      setMetricsLoading(false);
      setError("This PDF does not contain any readable pages.");
      return;
    }

    try {
      const firstPage = await pdf.getPage(1);
      const firstViewport = firstPage.getViewport({ scale: 1 });
      if (!firstViewport.width || !firstViewport.height) {
        throw new Error("The first page has invalid dimensions.");
      }

      const firstMetric = {
        width: firstViewport.width,
        height: firstViewport.height,
      };

      if (generation !== generationRef.current) return;

      // Render page one immediately; the remaining page geometry is measured
      // concurrently and replaces these temporary estimates when ready.
      setMetrics(Array.from({ length: pdf.numPages }, () => firstMetric));

      if (pdf.numPages === 1) {
        setMetricsLoading(false);
        return;
      }

      const exactMetrics: PageMetric[] = new Array(pdf.numPages);
      exactMetrics[0] = firstMetric;
      let cursor = 2;
      let hadMeasurementError = false;

      const worker = async () => {
        while (generation === generationRef.current) {
          const pageNumber = cursor++;
          if (pageNumber > pdf.numPages) return;

          try {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1 });
            if (!viewport.width || !viewport.height) {
              throw new Error("Invalid page dimensions.");
            }
            exactMetrics[pageNumber - 1] = {
              width: viewport.width,
              height: viewport.height,
            };
          } catch (pageError) {
            hadMeasurementError = true;
            exactMetrics[pageNumber - 1] = firstMetric;
            console.warn(
              "Unable to measure PDF page " + pageNumber + "; using a fallback size.",
              pageError
            );
          }
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(3, pdf.numPages - 1) },
          () => worker()
        )
      );

      if (generation !== generationRef.current) return;

      setMetrics(exactMetrics);
      setMetricsLoading(false);
      if (hadMeasurementError) {
        setError(
          "Some page dimensions could not be read. The reader is using fallback sizing for those pages."
        );
      }
    } catch (loadError) {
      if (generation !== generationRef.current) return;
      console.error("Unable to prepare PDF pages:", loadError);
      setMetricsLoading(false);
      setError("The PDF opened, but its page layout could not be prepared. Try reopening it.");
    }
  }

  const jumpToPage = useCallback(
    (requestedPage: number) => {
      if (!numPages || !Number.isSafeInteger(requestedPage)) return;
      const page = clampPage(requestedPage, numPages);
      applyPosition(page, 0);
      setPageDraft("");
      pendingPositionRef.current = { page, offset: 0 };
      if (positionTimerRef.current !== null) {
        clearTimeout(positionTimerRef.current);
        positionTimerRef.current = null;
      }
      onPageChange(page);
      onPositionChange(page, 0);
    },
    [applyPosition, numPages, onPageChange, onPositionChange]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const nextWidth = Math.max(
        120,
        Math.min(MAX_PAGE_WIDTH, container.clientWidth - 32)
      );
      const nextHeight = container.clientHeight;
      setBasePageWidth((current) =>
        current === nextWidth ? current : nextWidth
      );
      setContainerHeight((current) =>
        current === nextHeight ? current : nextHeight
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updatePixelRatio = () => {
      setDevicePixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.75)
      );
    };
    updatePixelRatio();
    window.addEventListener("resize", updatePixelRatio, { passive: true });
    return () => window.removeEventListener("resize", updatePixelRatio);
  }, []);

  useEffect(() => {
    updateVisibleRange();
  }, [basePageWidth, containerHeight, pageWidth, updateVisibleRange]);

  useEffect(() => {
    if (!numPages || metrics.length !== numPages || !pageOffsets.length) return;

    const layoutKey =
      String(pageWidth) +
      ":" +
      String(numPages) +
      ":" +
      metrics.map((metric) => metric.width + "x" + metric.height).join(",");

    if (lastAppliedLayoutRef.current !== layoutKey) {
      lastAppliedLayoutRef.current = layoutKey;
      const anchor = pendingPositionRef.current;
      applyPosition(anchor.page || currentPage, anchor.offset);
    }
  }, [
    applyPosition,
    currentPage,
    metrics,
    numPages,
    pageOffsets,
    pageWidth,
  ]);

  useEffect(() => {
    if (!numPages || metrics.length !== numPages) return;

    const page = clampPage(currentPage, numPages);
    const offset = clampOffset(currentOffset);
    const last = lastReportedPositionRef.current;

    if (
      page !== last.page ||
      Math.abs(offset - last.offset) > POSITION_EPSILON
    ) {
      pendingPositionRef.current = { page, offset };
      applyPosition(page, offset);
    }
  }, [applyPosition, currentOffset, currentPage, metrics.length, numPages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    updateVisibleRange();
  }, [containerHeight, pageOffsets, updateVisibleRange]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (positionTimerRef.current !== null) {
        clearTimeout(positionTimerRef.current);
      }
    };
  }, []);

  function submitPageJump() {
    const requested = Number(pageDraft);
    if (!Number.isSafeInteger(requested) || requested < 1 || requested > numPages) {
      setPageDraft("");
      return;
    }
    jumpToPage(requested);
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--conference-line)] bg-[#17151a] text-white">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-[#1d1a20] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
            Vaani reader
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span className="text-xs tabular-nums text-white/65">
            {numPages ? safeCurrentPage + " / " + numPages : "Opening PDF"}
          </span>
          {metricsLoading && (
            <span className="hidden text-[10px] text-white/35 sm:inline">
              Preparing pages…
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => jumpToPage(safeCurrentPage - 1)}
            disabled={!numPages || safeCurrentPage <= 1}
            aria-label="Previous page"
            title="Previous page"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-sm text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
          >
            ‹
          </button>
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              submitPageJump();
            }}
          >
            <input
              type="number"
              min={1}
              max={numPages || undefined}
              value={inputPage}
              disabled={!numPages}
              onChange={(event) => setPageDraft(event.target.value)}
              aria-label="Go to page"
              className="h-8 w-12 rounded-md border border-white/[0.09] bg-white/[0.05] px-1 text-center text-xs tabular-nums text-white outline-none focus:border-white/30 disabled:opacity-40"
            />
          </form>
          <button
            type="button"
            onClick={() => jumpToPage(safeCurrentPage + 1)}
            disabled={!numPages || safeCurrentPage >= numPages}
            aria-label="Next page"
            title="Next page"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-sm text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
          >
            ›
          </button>

          <span className="mx-1 h-5 w-px bg-white/10" />

          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.7, Math.round((value - 0.1) * 10) / 10))}
            disabled={zoom <= 0.7}
            aria-label="Zoom out"
            title="Zoom out"
            className="h-8 w-8 rounded-md border border-white/[0.08] text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-25"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
            title="Fit page"
            className="h-8 min-w-12 rounded-md px-1 text-[10px] tabular-nums text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.7, Math.round((value + 0.1) * 10) / 10))}
            disabled={zoom >= 1.7}
            aria-label="Zoom in"
            title="Zoom in"
            className="h-8 w-8 rounded-md border border-white/[0.08] text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-25"
          >
            +
          </button>
        </div>
      </header>

      {error && (
        <p
          role="status"
          className="shrink-0 border-b border-amber-300/10 bg-amber-300/[0.05] px-3 py-2 text-[11px] leading-5 text-amber-100/75"
        >
          {error}
        </p>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto overscroll-contain px-2 py-3 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]"
      >
        <Document
          key={documentUrl}
          file={documentUrl}
          options={PDF_OPTIONS}
          onLoadSuccess={(pdf) => void handleDocumentLoad(pdf)}
          onLoadProgress={({ loaded, total }) => {
            if (total > 0) {
              setLoadProgress(Math.min(100, Math.round((loaded / total) * 100)));
            }
          }}
          onLoadError={(loadError) => {
            console.error("Unable to load PDF:", loadError);
            setNumPages(0);
            setMetrics([]);
            setMetricsLoading(false);
            setError("Unable to open this PDF. Check the connection and try reopening the reader.");
          }}
          loading={
            <div className="mx-auto flex min-h-56 max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/60 transition-[width] duration-200"
                  style={{ width: Math.max(8, loadProgress) + "%" }}
                />
              </div>
              <p className="text-xs text-white/45">
                Loading document{loadProgress ? " · " + loadProgress + "%" : "…"}
              </p>
            </div>
          }
          error={
            <p className="py-12 text-center text-xs text-red-200/80">
              This document could not be opened.
            </p>
          }
        >
          {numPages > 0 && metrics.length === numPages && (
            <div className="mx-auto w-full" style={{ minWidth: pageWidth }}>
              <div style={{ height: topSpacerHeight }} />
              {Array.from(
                { length: Math.max(0, lastIndex - firstIndex + 1) },
                (_, offset) => firstIndex + offset
              ).map((index) => {
                const metric = metrics[index];
                if (!metric || !pageWidth) return null;
                const height = (pageWidth * metric.height) / metric.width;
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
            </div>
          )}
          {metricsLoading && (
            <p className="py-3 text-center text-[10px] text-white/30">
              Preparing page layout…
            </p>
          )}
        </Document>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-white/[0.06] bg-[#1d1a20] px-3 py-1.5">
        <span className="text-[10px] text-white/35">
          {canControl ? "You are guiding the shared reading" : "Your reading position is local"}
        </span>
        <span className="text-[10px] tabular-nums text-white/30">
          {metricsLoading ? "Optimizing layout" : numPages ? numPages + " pages" : " "}
        </span>
      </footer>
    </section>
  );
}
