"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Document,
  Page,
  pdfjs,
} from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

type Props = {
  documentUrl: string;
  currentPage: number;
  canControl: boolean;
  onPageChange: (page: number) => void;
};

type PdfDocument = {
  numPages: number;
  getPage: (
    page: number
  ) => Promise<{
    getViewport: (
      options: {
        scale: number;
      }
    ) => {
      width: number;
      height: number;
    };
  }>;
};

const PDF_OPTIONS = {
  disableRange: false,
  disableStream: false,
  disableAutoFetch: false,
};

const MAX_PAGE_WIDTH = 900;
const MIN_PAGE_WIDTH = 160;

const VirtualPdfPage = memo(
  function VirtualPdfPage({
    pageNumber,
    pageWidth,
    pageHeight,
    rowHeight,
    devicePixelRatio,
  }: {
    pageNumber: number;
    pageWidth: number;
    pageHeight: number;
    rowHeight: number;
    devicePixelRatio: number;
  }) {
    return (
      <div
        className="flex w-full shrink-0 justify-center"
        style={{
          height: rowHeight,
        }}
      >
        <Page
          pageNumber={pageNumber}
          width={pageWidth}
          devicePixelRatio={devicePixelRatio}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={
            <div
              style={{
                height: pageHeight,
                width: pageWidth,
              }}
              className="flex items-center justify-center rounded bg-white/5 text-sm text-white/40"
            >
              Loading page {pageNumber}...
            </div>
          }
        />
      </div>
    );
  }
);

function getAvailablePageWidth(
  container: HTMLDivElement
) {
  return Math.max(
    MIN_PAGE_WIDTH,
    Math.min(
      MAX_PAGE_WIDTH,
      Math.round(container.clientWidth - 24)
    )
  );
}

export default function PdfReader({
  documentUrl,
  currentPage,
  canControl,
  onPageChange,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const lastReportedPage =
    useRef(currentPage);

  const lastAppliedRowHeight = useRef(0);
  const windowStartIndex = useRef(0);

  const [numPages, setNumPages] = useState(0);

  const [pageWidth, setPageWidth] = useState(0);
  const [pageAspectRatio, setPageAspectRatio] = useState(0);
  const [hasMeasuredContainer, setHasMeasuredContainer] = useState(false);
  const [pageMetricsReady, setPageMetricsReady] = useState(false);

  const [scrollTop, setScrollTop] = useState(0);

  const [containerHeight, setContainerHeight] = useState(0);

  const [devicePixelRatio, setDevicePixelRatio] =
    useState(1);

  const [inputDraft, setInputDraft] = useState<{
    basedOnPage: number;
    value: string;
  } | null>(null);

  const [error, setError] = useState("");

  const pageHeight =
    pageWidth * pageAspectRatio;

  const rowHeight = pageHeight + 24;

  // Render only visible pages and a small buffer.
  const visibleStart = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - 1
  );

  const visibleCount =
    Math.ceil(containerHeight / rowHeight) + 4;

  const firstPage = visibleStart + 1;

  const lastPage = Math.min(
    numPages,
    firstPage + visibleCount - 1
  );

  const renderedPages = useMemo(() => {
    const length = Math.max(
      0,
      lastPage - firstPage + 1
    );

    return Array.from(
      { length },
      (_, index) => firstPage + index
    );
  }, [firstPage, lastPage]);

  const topSpacerHeight =
    (firstPage - 1) * rowHeight;

  const bottomSpacerHeight =
    Math.max(0, numPages - lastPage) *
    rowHeight;

  const inputPage =
    inputDraft?.basedOnPage === currentPage
      ? inputDraft.value
      : String(currentPage);

  const jumpToPage = useCallback(
    (page: number) => {
      if (
        !canControl ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > numPages
      ) {
        return;
      }

      const container = containerRef.current;

      if (!container) return;

      lastReportedPage.current = page;

      const top = (page - 1) * rowHeight;

      container.scrollTo({
        top,
        behavior: "auto",
      });

      windowStartIndex.current = Math.floor(
        top / rowHeight
      );

      setScrollTop(top);
      onPageChange(page);
    },
    [
      canControl,
      numPages,
      rowHeight,
      onPageChange,
    ]
  );

  // Update local page position for all participants.
  // React state is updated only when the virtual window changes.
  const handleScroll = useCallback(() => {
    const container = containerRef.current;

    if (!container) return;

    const top = container.scrollTop;

    const nextWindowIndex = Math.floor(
      top / rowHeight
    );

    if (
      nextWindowIndex !==
      windowStartIndex.current
    ) {
      windowStartIndex.current =
        nextWindowIndex;

      setScrollTop(top);
    }

    if (!numPages) return;

    const readingPosition =
      top +
      Math.min(
        container.clientHeight * 0.35,
        rowHeight * 0.5
      );

    const page = Math.min(
      numPages,
      Math.max(
        1,
        Math.floor(
          readingPosition / rowHeight
        ) + 1
      )
    );

    if (page !== lastReportedPage.current) {
      lastReportedPage.current = page;
      onPageChange(page);
    }
  }, [
    numPages,
    rowHeight,
    onPageChange,
  ]);

  // Follow remote navigation, but preserve the current
  // page and fractional offset when the layout changes.
  useEffect(() => {
    const container = containerRef.current;

    if (
      !container ||
      !numPages ||
      !hasMeasuredContainer ||
      !pageMetricsReady
    ) return;

    const previousRowHeight =
      lastAppliedRowHeight.current;

    const firstLayout =
      previousRowHeight === 0;

    const remotePageChanged =
      currentPage !== lastReportedPage.current;

    const layoutChanged =
      previousRowHeight > 0 &&
      previousRowHeight !== rowHeight;

    lastAppliedRowHeight.current = rowHeight;

    if (
      remotePageChanged ||
      (firstLayout && currentPage > 1)
    ) {
      const safePage = Math.min(
        numPages,
        Math.max(1, currentPage)
      );

      lastReportedPage.current = safePage;

      const top = (safePage - 1) * rowHeight;

      container.scrollTo({
        top,
        behavior: "auto",
      });

      windowStartIndex.current = Math.floor(
        top / rowHeight
      );

      setScrollTop(top);
      return;
    }

    if (layoutChanged) {
      const oldTop = container.scrollTop;

      const oldPageIndex = Math.min(
        numPages - 1,
        Math.max(
          0,
          Math.floor(
            oldTop / previousRowHeight
          )
        )
      );

      const oldOffset =
        oldTop -
        oldPageIndex * previousRowHeight;

      const pageProgress = Math.min(
        1,
        Math.max(
          0,
          oldOffset / previousRowHeight
        )
      );

      const newTop =
        oldPageIndex * rowHeight +
        pageProgress * rowHeight;

      container.scrollTo({
        top: newTop,
        behavior: "auto",
      });

      windowStartIndex.current = Math.floor(
        newTop / rowHeight
      );

      setScrollTop(newTop);
    }
  }, [
    currentPage,
    numPages,
    rowHeight,
    hasMeasuredContainer,
    pageMetricsReady,
  ]);

  // Measure the reader container.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const updateSize = () => {
      const availableWidth =
        getAvailablePageWidth(container);

      setPageWidth((previous) =>
        previous === availableWidth
          ? previous
          : availableWidth
      );

      setContainerHeight((previous) =>
        previous === container.clientHeight
          ? previous
          : container.clientHeight
      );
      setHasMeasuredContainer(true);
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(
        updateSize
      );

      observer.observe(container);

      return () => observer.disconnect();
    }

    window.addEventListener(
      "resize",
      updateSize,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateSize
      );
    };
  }, []);

  // Cap rendering resolution to avoid excessive mobile
  // canvas memory use on high-density screens.
  useEffect(() => {
    const updatePixelRatio = () => {
      const isSmallScreen =
        window.innerWidth < 640;

      // Keep canvases crisp on high-density displays without unbounded memory use.
      const limit = 2;

      const nextRatio = Math.min(
        window.devicePixelRatio || 1,
        limit
      );

      setDevicePixelRatio((previous) =>
        previous === nextRatio
          ? previous
          : nextRatio
      );
    };

    updatePixelRatio();

    window.addEventListener(
      "resize",
      updatePixelRatio,
      { passive: true }
    );

    return () => {
      window.removeEventListener(
        "resize",
        updatePixelRatio
      );
    };
  }, []);

  async function handleDocumentLoad(
    pdf: PdfDocument
  ) {
    setNumPages(pdf.numPages);
    setError("");

    try {
      const firstPage = await pdf.getPage(1);

      const viewport = firstPage.getViewport({
        scale: 1,
      });

      if (
        viewport.width > 0 &&
        viewport.height > 0
      ) {
        setPageAspectRatio(
          viewport.height / viewport.width
        );
        setPageMetricsReady(true);
      }

      const container = containerRef.current;

      if (container) {
        setPageWidth(
          getAvailablePageWidth(container)
        );

        setContainerHeight(
          container.clientHeight
        );
      }
    } catch (loadError) {
      console.error(
        "Unable to prepare PDF pages:",
        loadError
      );

      setError(
        "Unable to prepare PDF pages."
      );
    }
  }

  function submitPageJump() {
    const page = Number(inputPage);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > numPages
    ) {
      setInputDraft(null);
      return;
    }

    jumpToPage(page);
    setInputDraft(null);
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1b1b1b] text-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-3 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            Vaani Reader
          </h2>

          <p className="text-xs text-white/50">
            {numPages
              ? `${numPages} pages`
              : "Loading document"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={
              !canControl ||
              currentPage <= 1 ||
              !numPages
            }
            onClick={() =>
              jumpToPage(currentPage - 1)
            }
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-30"
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
              onChange={(event) => {
                setInputDraft({
                  basedOnPage: currentPage,
                  value: event.target.value,
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitPageJump();
                }
              }}
              onBlur={submitPageJump}
              className="w-14 rounded-md border border-white/15 bg-white/10 px-2 py-2 text-center text-white outline-none focus:border-white/40 disabled:opacity-50"
              aria-label="Go to page"
            />

            <span className="text-white/50">
              / {numPages || "—"}
            </span>
          </div>

          <button
            type="button"
            disabled={
              !canControl ||
              !numPages ||
              currentPage >= numPages
            }
            onClick={() =>
              jumpToPage(currentPage + 1)
            }
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="shrink-0 px-4 py-2 text-center text-sm text-red-300"
        >
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
          onLoadSuccess={handleDocumentLoad}
          onLoadError={(loadError) => {
            console.error(
              "Unable to load PDF:",
              loadError
            );

            setError(
              "Unable to load this PDF. Please try reopening the reader."
            );
          }}
          loading={
            <p className="py-10 text-center text-sm text-white/50">
              Loading PDF...
            </p>
          }
        >
          <div
            style={{
              height: topSpacerHeight,
            }}
          />

          <div className="flex flex-col items-center">
            {hasMeasuredContainer && pageMetricsReady && renderedPages.map((pageNumber) => (
              <VirtualPdfPage
                key={pageNumber}
                pageNumber={pageNumber}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                rowHeight={rowHeight}
                devicePixelRatio={
                  devicePixelRatio
                }
              />
            ))}
          </div>

          <div
            style={{
              height: bottomSpacerHeight,
            }}
          />
        </Document>
      </div>

      {!canControl && (
        <p className="shrink-0 border-t border-white/10 px-4 py-2 text-center text-xs text-white/50">
          The session in-charge controls synchronized navigation. You can still read at your own pace.
        </p>
      )}
    </section>
  );
}
