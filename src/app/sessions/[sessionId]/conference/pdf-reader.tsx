"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { pdfjs } from "react-pdf";

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

type PdfDocument = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type PdfPage = Awaited<ReturnType<PdfDocument["getPage"]>>;
type Metric = { width: number; height: number };
type Position = { page: number; offset: number };
type Range = { first: number; last: number };

const PAGE_GAP = 20;
const DEFAULT_RATIO = 1.4142;
const MAX_PAGE_WIDTH = 1200;
const MAX_RENDER_WIDTH = 1650;
const MAX_DPR = 1.75;
const OVERSCAN = 2;
const POSITION_INTERVAL = 80;

function pageNumberKey(page: number, width: number, retry: number) {
  return `${page}:${Math.round(width)}:${retry}`;
}

function clampPage(value: number, count: number) {
  return Math.min(count, Math.max(1, Math.floor(value) || 1));
}

function clampOffset(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function pageOffsetsFor(metrics: Array<Metric | null>, width: number) {
  const offsets = new Array(metrics.length + 1).fill(0);
  for (let i = 0; i < metrics.length; i += 1) {
    const metric = metrics[i];
    const height = metric
      ? width * metric.height / metric.width
      : width / DEFAULT_RATIO;
    offsets[i + 1] = offsets[i] + height + PAGE_GAP;
  }
  return offsets;
}

function findPage(offsets: number[], value: number) {
  let low = 0;
  let high = Math.max(0, offsets.length - 2);
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (offsets[middle] <= value) low = middle;
    else high = middle - 1;
  }
  return low;
}

function PdfCanvas({
  pdf,
  pageNumber,
  width,
  active,
  onMetric,
  onRenderError,
  onRendered,
}: {
  pdf: PdfDocument;
  pageNumber: number;
  width: number;
  active: boolean;
  onMetric: (page: number, metric: Metric) => void;
  onRenderError: (page: number, error: unknown) => void;
  onRendered: (page: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!active || !canvasRef.current || width < 1) return;

    let cancelled = false;
    let renderTask: ReturnType<PdfPage["render"]> | null = null;
    let page: PdfPage | null = null;

    async function renderPage() {
      setStatus("loading");
      try {
        page = await pdf.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;

        const base = page.getViewport({ scale: 1 });
        if (!base.width || !base.height) {
          throw new Error("The PDF page has invalid dimensions.");
        }

        onMetric(pageNumber, { width: base.width, height: base.height });

        const scale = width / base.width;
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(
          window.devicePixelRatio || 1,
          MAX_DPR
        );
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("This browser could not create a PDF canvas.");

        canvas.width = Math.max(1, Math.ceil(viewport.width * outputScale));
        canvas.height = Math.max(1, Math.ceil(viewport.height * outputScale));
        canvas.style.width = Math.ceil(viewport.width) + "px";
        canvas.style.height = Math.ceil(viewport.height) + "px";

        renderTask = page.render({
          canvas,
          viewport,
          transform: outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0],
        });

        await renderTask.promise;
        if (!cancelled) {
          setStatus("ready");
          onRendered(pageNumber);
        }
      } catch (error) {
        if (cancelled || (error instanceof Error && error.name === "RenderingCancelledException")) return;
        setStatus("error");
        onRenderError(pageNumber, error);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch {}
      }
    };
  }, [active, pageNumber, pdf, width, onMetric, onRenderError, onRendered]);

  return (
    <div className="relative flex w-full justify-center">
      <canvas
        ref={canvasRef}
        aria-label={"PDF page " + pageNumber}
        className="block max-w-full rounded-[2px] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.22)]"
        style={{ visibility: status === "ready" ? "visible" : "hidden" }}
      />
      {status !== "ready" && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-sm bg-white text-xs text-slate-500"
          style={{ minHeight: Math.max(160, width / DEFAULT_RATIO) }}
        >
          {status === "error" ? "Page unavailable" : ""}
        </div>
      )}
    </div>
  );
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
  const metricFrameRef = useRef<number | null>(null);
  const metricsRef = useRef<Array<Metric | null>>([]);
  const positionRef = useRef<Position>({ page: Math.max(1, currentPage), offset: clampOffset(currentOffset) });
  const lastSentRef = useRef<Position>(positionRef.current);
  const lastWidthRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const suppressUntilRef = useRef(0);
  const navigationTargetRef = useRef<{ page: number; top: number; expiresAt: number } | null>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const lastAppliedRef = useRef("");
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [metrics, setMetrics] = useState<Array<Metric | null>>([]);
  const [width, setWidth] = useState(0);
  const [visibleRange, setVisibleRange] = useState<Range>({ first: 0, last: 3 });
  const [visiblePage, setVisiblePage] = useState(Math.max(1, currentPage));
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "rendering" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [pageErrors, setPageErrors] = useState<Record<number, string>>({});
  const [pageDraft, setPageDraft] = useState("");
  const [zoom, setZoom] = useState(1);
  const [retryToken, setRetryToken] = useState(0);
  const [pageRetryToken, setPageRetryToken] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);

  const pageWidth = Math.max(1, Math.min(MAX_RENDER_WIDTH, width * zoom));
  const offsets = useMemo(() => pageOffsetsFor(metrics, pageWidth), [metrics, pageWidth]);
  const totalHeight = offsets[offsets.length - 1] || 0;
  const safePage = pageCount ? clampPage(visiblePage, pageCount) : 1;
  const first = Math.min(Math.max(0, visibleRange.first), Math.max(0, pageCount - 1));
  const last = Math.min(Math.max(first, visibleRange.last), Math.max(0, pageCount - 1));
  const topSpacer = offsets[first] || 0;
  const bottomSpacer = Math.max(0, totalHeight - (offsets[last + 1] || totalHeight));

  const reportPosition = useCallback(() => {
    timerRef.current = null;
    const next = positionRef.current;
    const previous = lastSentRef.current;
    if (next.page === previous.page && Math.abs(next.offset - previous.offset) < 0.0015) return;
    lastSentRef.current = next;
    if (next.page !== previous.page) onPageChange(next.page);
    onPositionChange(next.page, next.offset);
  }, [onPageChange, onPositionChange]);

  const queuePosition = useCallback(() => {
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(reportPosition, POSITION_INTERVAL);
  }, [reportPosition]);

  const updateVisibleRange = useCallback(() => {
    const node = containerRef.current;
    if (!node || !pageCount || offsets.length < 2) return;
    const top = Math.max(0, node.scrollTop);
    const bottom = Math.min(totalHeight, top + Math.max(1, node.clientHeight));
    const firstVisible = findPage(offsets, top);
    const lastVisible = findPage(offsets, bottom);
    const next = {
      first: Math.max(0, firstVisible - OVERSCAN),
      last: Math.min(pageCount - 1, lastVisible + OVERSCAN),
    };
    setVisibleRange(previous =>
      previous.first === next.first && previous.last === next.last ? previous : next
    );
  }, [offsets, pageCount, totalHeight]);

  const applyPosition = useCallback((page: number, offset: number) => {
    const node = containerRef.current;
    if (!node || !pageCount) return;
    const safe = clampPage(page, pageCount);
    const safeOffset = clampOffset(offset);
    const index = safe - 1;
    const pageHeight = offsets[index + 1] - offsets[index] - PAGE_GAP;
    const nextTop = offsets[index] + safeOffset * Math.max(1, pageHeight);
    positionRef.current = { page: safe, offset: safeOffset };
    lastSentRef.current = positionRef.current;
    setVisiblePage(safe);
    const now = performance.now();
    const distance = Math.abs(node.scrollTop - nextTop);
    suppressUntilRef.current = now + 700;
    navigationTargetRef.current = distance > 2
      ? { page: safe, top: nextTop, expiresAt: now + 700 }
      : null;
    if (distance > 2) {
      node.scrollTo({ top: nextTop, behavior: "auto" });
    } else {
      navigationTargetRef.current = null;
    }
    updateVisibleRange();
  }, [offsets, pageCount, updateVisibleRange]);

  const handleMetric = useCallback((pageNumber: number, metric: Metric) => {
    const index = pageNumber - 1;
    const previous = metricsRef.current;
    const old = previous[index];
    if (old && Math.abs(old.width - metric.width) < 0.1 && Math.abs(old.height - metric.height) < 0.1) return;

    const node = containerRef.current;
    const oldOffsets = pageOffsetsFor(previous, pageWidth);
    const anchorIndex = node && previous.length ? findPage(oldOffsets, node.scrollTop) : 0;
    const anchorHeight = Math.max(1, oldOffsets[anchorIndex + 1] - oldOffsets[anchorIndex] - PAGE_GAP);
    const anchorFraction = node
      ? clampOffset((node.scrollTop - oldOffsets[anchorIndex]) / anchorHeight)
      : 0;
    const next = previous.slice();
    next[index] = metric;
    metricsRef.current = next;
    setMetrics(next);

    if (node && index <= anchorIndex) {
      const newOffsets = pageOffsetsFor(next, pageWidth);
      const newAnchorHeight = Math.max(1, newOffsets[anchorIndex + 1] - newOffsets[anchorIndex] - PAGE_GAP);
      suppressUntilRef.current = performance.now() + 180;
      if (metricFrameRef.current !== null) window.cancelAnimationFrame(metricFrameRef.current);
      metricFrameRef.current = window.requestAnimationFrame(() => {
        metricFrameRef.current = null;
        if (containerRef.current) {
          containerRef.current.scrollTop = newOffsets[anchorIndex] + anchorFraction * newAnchorHeight;
        }
      });
    }
  }, [pageWidth]);

  const handlePageRendered = useCallback((pageNumber: number) => {
    setPhase("ready");
    setPageErrors(previous => {
      if (!(pageNumber in previous)) return previous;
      const next = { ...previous };
      delete next[pageNumber];
      return next;
    });
  }, []);

  const handleRenderError = useCallback((pageNumber: number, cause: unknown) => {
    const message = cause instanceof Error ? cause.message : "Unknown PDF rendering error";
    console.error("Vaani PDF page render failed:", { pageNumber, message, cause });
    setPageErrors(previous => ({ ...previous, [pageNumber]: message }));
    setPhase("ready");
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(120, Math.min(MAX_PAGE_WIDTH, node.clientWidth - 36)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;
    setPhase("loading");
    setError("");
    setProgress(0);
    setPageErrors({});
    setPdf(null);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (metricFrameRef.current !== null) {
      window.cancelAnimationFrame(metricFrameRef.current);
      metricFrameRef.current = null;
    }
    setPageCount(0);
    setVisiblePage(Math.max(1, currentPage));
    lastSentRef.current = { page: Math.max(1, currentPage), offset: clampOffset(currentOffset) };
    setVisibleRange({ first: 0, last: 3 });
    setMetrics([]);
    metricsRef.current = [];
    lastAppliedRef.current = "";
    lastWidthRef.current = 0;
    positionRef.current = { page: Math.max(1, currentPage), offset: clampOffset(currentOffset) };

    try {
      task = pdfjs.getDocument({
        url: documentUrl,
        rangeChunkSize: 65536,
        disableRange: false,
        disableStream: false,
        disableAutoFetch: false,
      });
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
        if (!cancelled && total > 0) setProgress(Math.min(100, Math.round(loaded / total * 100)));
      };
      task.promise.then(loadedPdf => {
        if (cancelled) return;
        setPdf(loadedPdf);
        setPageCount(loadedPdf.numPages);
        setMetrics(Array.from({ length: loadedPdf.numPages }, () => null));
        metricsRef.current = Array.from({ length: loadedPdf.numPages }, () => null);
        setPhase("rendering");
        setProgress(100);
      }).catch(loadError => {
        if (cancelled) return;
        console.error("Vaani PDF document load failed:", loadError);
        setPhase("error");
        setError(loadError instanceof Error ? loadError.message : "The PDF could not be opened.");
      });
    } catch (loadError) {
      setPhase("error");
      setError(loadError instanceof Error ? loadError.message : "The PDF could not be opened.");
    }

    return () => {
      cancelled = true;
      if (task) void task.destroy();
    };
  }, [documentUrl, retryToken]);

  useEffect(() => {
    if (!pdf || !pageCount || !width) return;
    const targetPage = clampPage(currentPage, pageCount);
    const targetOffset = clampOffset(currentOffset);
    const key = documentUrl + ":" + pageWidth + ":" + targetPage + ":" + targetOffset;
    if (lastAppliedRef.current === key) return;
    const widthChanged = lastWidthRef.current !== pageWidth;
    lastWidthRef.current = pageWidth;
    const local = positionRef.current;
    const alreadyAtTarget =
      local.page === targetPage &&
      Math.abs(local.offset - targetOffset) < 0.012;
    lastAppliedRef.current = key;
    if (!widthChanged && alreadyAtTarget) return;
    applyPosition(targetPage, targetOffset);
  }, [applyPosition, currentOffset, currentPage, documentUrl, pageCount, pageWidth, pdf, width]);

  useEffect(() => {
    updateVisibleRange();
  }, [updateVisibleRange]);

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const node = containerRef.current;
      if (!node || !pageCount) return;
      updateVisibleRange();
      const now = performance.now();
      const navigationTarget = navigationTargetRef.current;
      if (navigationTarget) {
        const distance = Math.abs(node.scrollTop - navigationTarget.top);
        if (distance <= 4 || now >= navigationTarget.expiresAt) {
          navigationTargetRef.current = null;
          suppressUntilRef.current = now + 40;
        } else {
          setVisiblePage(navigationTarget.page);
          return;
        }
      }

      const index = Math.min(pageCount - 1, findPage(offsets, Math.max(0, node.scrollTop)));
      const pageTop = offsets[index] || 0;
      const pageHeight = Math.max(1, (offsets[index + 1] || 0) - pageTop - PAGE_GAP);
      const next = { page: index + 1, offset: clampOffset((node.scrollTop - pageTop) / pageHeight) };

      if (now < suppressUntilRef.current) {
        setVisiblePage(positionRef.current.page);
        return;
      }

      positionRef.current = next;
      setVisiblePage(next.page);
      queuePosition();
    });
  }, [offsets, pageCount, queuePosition, updateVisibleRange]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    if (metricFrameRef.current !== null) window.cancelAnimationFrame(metricFrameRef.current);
  }, []);

  function jumpToPage(requested: number) {
    if (!pageCount) return;

    const target = clampPage(
      Number.isFinite(requested) ? Math.trunc(requested) : 1,
      pageCount
    );

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    applyPosition(target, 0);
    setPageDraft(String(target));
    positionRef.current = { page: target, offset: 0 };
    lastSentRef.current = positionRef.current;
    onPageChange(target);
    onPositionChange(target, 0);
  }

  function submitJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = pageDraft.trim();
    const parsed = raw === "" ? 1 : Number(raw);
    jumpToPage(Number.isFinite(parsed) ? parsed : 1);
  }

  useEffect(() => {
    const input = pageInputRef.current;
    if (!input || document.activeElement === input) return;
    setPageDraft(String(safePage));
  }, [safePage]);

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--conference-line)] bg-[#17151a] text-white">
      {controlsVisible ? <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-[#1d1a20] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Vaani reader</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span className="text-xs tabular-nums text-white/65">
            {pageCount ? safePage + " / " + pageCount : phase === "error" ? "PDF unavailable" : "Opening PDF"}
          </span>
          {phase === "loading" && <span className="hidden text-[10px] text-white/35 sm:inline">{progress ? progress + "%" : "Connecting…"}</span>}
          {phase === "rendering" && <span className="hidden text-[10px] text-white/35 sm:inline">Preparing pages…</span>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => jumpToPage(safePage - 1)} disabled={!pageCount || safePage <= 1} aria-label="Previous page" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-25"><svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none"><path d="m12.5 5-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <form className="flex items-center gap-1" onSubmit={submitJump}>
            <input ref={pageInputRef} type="text" inputMode="numeric" value={pageDraft} disabled={!pageCount} onChange={event => setPageDraft(event.target.value)} aria-label="Go to page" className="h-8 w-12 rounded-md border border-white/[0.09] bg-white/[0.05] px-1 text-center text-xs tabular-nums text-white outline-none focus:border-white/30 disabled:opacity-40" />
          </form>
          <button type="button" onClick={() => jumpToPage(safePage + 1)} disabled={!pageCount || safePage >= pageCount} aria-label="Next page" className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-25"><svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none"><path d="m7.5 5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" onClick={() => setZoom(value => Math.max(0.7, Math.round((value - 0.1) * 10) / 10))} disabled={zoom <= 0.7} aria-label="Zoom out" className="h-8 w-8 rounded-md border border-white/[0.08] text-sm text-white/75 disabled:opacity-25">−</button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Fit page" className="h-8 min-w-12 rounded-md px-1 text-[10px] tabular-nums text-white/55 hover:text-white">{Math.round(zoom * 100)}%</button>
          <button type="button" onClick={() => setZoom(value => Math.min(1.7, Math.round((value + 0.1) * 10) / 10))} disabled={zoom >= 1.7} aria-label="Zoom in" className="h-8 w-8 rounded-md border border-white/[0.08] text-sm text-white/75 disabled:opacity-25">+</button>
          <button type="button" onClick={() => setControlsVisible(false)} aria-label="Hide reader controls" className="ml-1 h-8 rounded-md border border-white/[0.08] px-2 text-[10px] text-white/55 transition hover:bg-white/10 hover:text-white sm:block">Hide</button>
        </div>
      </header> : null}

      {!controlsVisible && (
        <button type="button" onClick={() => setControlsVisible(true)} aria-label="Show reader controls" className="absolute right-2 top-2 z-20 rounded-md border border-white/10 bg-[#17151a]/90 px-2 py-1.5 text-[10px] text-white/65 shadow-lg backdrop-blur transition hover:bg-[#242027] hover:text-white">
          Show controls
        </button>
      )}

      {phase === "error" && (
        <div role="alert" className="absolute inset-x-3 bottom-3 z-10 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-lg border border-red-300/15 bg-[#17151a]/95 px-3 py-2 text-xs text-red-100/85 shadow-lg">
          <span className="min-w-0 flex-1">The PDF could not be opened. {error}</span>
          <button type="button" onClick={() => setRetryToken(value => value + 1)} className="shrink-0 rounded-md border border-red-200/20 px-3 py-1.5 text-red-50 hover:bg-white/10">Retry</button>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error" className="shrink-0 rounded-md px-2 py-1 text-white/60 hover:bg-white/10">×</button>
        </div>
      )}

      <div ref={containerRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-auto overscroll-contain px-2 py-3 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]">
        {phase === "loading" && (
          <div className="mx-auto flex min-h-64 max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-white/60 transition-[width] duration-200" style={{ width: Math.max(8, progress) + "%" }} />
            </div>
            <p className="text-xs text-white/45">Loading PDF{progress ? " · " + progress + "%" : "…"}</p>
          </div>
        )}
        {phase === "error" && (
          <div className="mx-auto flex min-h-64 max-w-sm items-center justify-center px-4 text-center text-xs text-red-200/75">
            Check that the document is accessible, then ask the organizer to reselect it.
          </div>
        )}
        {pdf && pageCount > 0 && (
          <div className="mx-auto" style={{ width: pageWidth, maxWidth: pageWidth }}>
            <div style={{ height: topSpacer }} />
            {Array.from({ length: Math.max(0, last - first + 1) }, (_, offset) => first + offset).map(index => {
              const metric = metrics[index];
              const estimatedHeight = metric ? pageWidth * metric.height / metric.width : pageWidth / DEFAULT_RATIO;
              return (
                <div key={index + 1} className="mx-auto flex w-full justify-center pb-5" style={{ minHeight: estimatedHeight + PAGE_GAP }}>
                  <div className="w-full">
                    <PdfCanvas
                      key={pageNumberKey(index + 1, pageWidth, pageRetryToken)}
                      pdf={pdf}
                      pageNumber={index + 1}
                      width={pageWidth}
                      active={true}
                      onMetric={handleMetric}
                      onRenderError={handleRenderError}
                      onRendered={handlePageRendered}
                    />
                  </div>
                </div>
              );
            })}
            <div style={{ height: bottomSpacer }} />
          </div>
        )}
      </div>


    </section>
  );
}
