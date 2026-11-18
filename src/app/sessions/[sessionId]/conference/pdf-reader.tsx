"use client";

import {
  memo,
  useCallback,
  useEffect,
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

const VirtualPdfPage = memo(function VirtualPdfPage({
  pageNumber,
  pageWidth,
  pageHeight,
  rowHeight,
}: {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  rowHeight: number;
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
        devicePixelRatio={1.5}
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
});

export default function PdfReader({
  documentUrl,
  currentPage,
  canControl,
  onPageChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const lastReportedPage = useRef(currentPage);
  const lastAppliedRowHeight = useRef(0);
  const windowStartIndex = useRef(0);

  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(700);
  const [pageHeight, setPageHeight] = useState(990);
  const [pageAspectRatio, setPageAspectRatio] = useState(
    990 / 700
  );

  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(700);

  const [inputDraft, setInputDraft] = useState<{
    basedOnPage: number;
    value: string;
  } | null>(null);

  const [error, setError] = useState("");

  const inputPage =
    inputDraft?.basedOnPage === currentPage
      ? inputDraft.value
      : String(currentPage);

  const rowHeight = pageHeight + 24;

  // Keep a small buffer of pages rendered around the visible area.
  // The window changes once per page boundary, not on every scroll event.
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

  const renderedPages = Array.from(
    {
      length: Math.max(
        0,
        lastPage - firstPage + 1
      ),
    },
    (_, index) => firstPage + index
  );

  const topSpacerHeight =
    (firstPage - 1) * rowHeight;

  const bottomSpacerHeight =
    Math.max(0, numPages - lastPage) * rowHeight;

  const jumpToPage = useCallback(
    (page: number) => {
      if (
        !canControl ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > numPages ||
        !containerRef.current
      ) {
        return;
      }

      lastReportedPage.current = page;

      const top = (page - 1) * rowHeight;

      containerRef.current.scrollTo({
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

  const handleScroll = useCallback(() => {
    const container = containerRef.current;

    if (!container) return;

    const top = container.scrollTop;

    const nextWindowIndex = Math.floor(
      top / rowHeight
    );

    // Avoid React updates for every pixel of scrolling.
    if (nextWindowIndex !== windowStartIndex.current) {
      windowStartIndex.current = nextWindowIndex;
      setScrollTop(top);
    }

    if (!canControl || !numPages) {
      return;
    }

    // Use a point slightly below the top of the viewport
    // to determine which page is currently being read.
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
        Math.floor(readingPosition / rowHeight) + 1
      )
    );

    if (page !== lastReportedPage.current) {
      lastReportedPage.current = page;
      onPageChange(page);
    }
  }, [
    canControl,
    numPages,
    rowHeight,
    onPageChange,
  ]);

  // Align only for remote page changes or actual layout changes.
  // A controller's own scrolling must never snap back to the
  // beginning of the page after each state update.
  useEffect(() => {
    const container = containerRef.current;

    if (!container || !numPages) return;

    const remotePageChanged =
      currentPage !== lastReportedPage.current;

    const layoutChanged =
      lastAppliedRowHeight.current !== rowHeight;

    if (!remotePageChanged && !layoutChanged) {
      return;
    }

    lastAppliedRowHeight.current = rowHeight;

    if (remotePageChanged) {
      lastReportedPage.current = currentPage;
    }

    const safePage = Math.min(
      numPages,
      Math.max(1, currentPage)
    );

    const top = (safePage - 1) * rowHeight;

    container.scrollTo({
      top,
      behavior: "auto",
    });

    windowStartIndex.current = Math.floor(
      top / rowHeight
    );

    setScrollTop(top);
  }, [
    currentPage,
    numPages,
    rowHeight,
  ]);

  // Keep the reader responsive to container resizing.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const updateSize = () => {
      const availableWidth = Math.max(
        220,
        Math.min(900, container.clientWidth - 40)
      );

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
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Recalculate page height whenever the available width changes.
  useEffect(() => {
    setPageHeight(pageWidth * pageAspectRatio);
  }, [pageWidth, pageAspectRatio]);

  async function handleDocumentLoad(pdf: PdfDocument) {
    setNumPages(pdf.numPages);
    setError("");

    try {
      const firstPage = await pdf.getPage(1);

      const viewport = firstPage.getViewport({
        scale: 1,
      });

      const aspectRatio =
        viewport.height / viewport.width;

      const container = containerRef.current;

      const availableWidth = container
        ? Math.max(
            220,
            Math.min(900, container.clientWidth - 40)
          )
        : 700;

      setPageAspectRatio(aspectRatio);
      setPageWidth(availableWidth);

      if (container) {
        setContainerHeight(container.clientHeight);
      }
    } catch (loadError) {
      console.error(
        "Unable to prepare PDF pages:",
        loadError
      );

      setError("Unable to prepare PDF pages.");
    }
  }

  function submitPageJump() {
    const page = Number(inputPage);

    if (!Number.isSafeInteger(page)) {
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
            disabled={!canControl || currentPage <= 1}
            onClick={() => jumpToPage(currentPage - 1)}
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
              onChange={(event) =>
                setInputDraft({
                  basedOnPage: currentPage,
                  value: event.target.value,
                })
              }
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
              currentPage >= numPages
            }
            onClick={() => jumpToPage(currentPage + 1)}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </header>

      {error && (
        <p className="shrink-0 px-4 py-2 text-center text-sm text-red-300">
          {error}
        </p>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 [scrollbar-gutter:stable]"
      >
        <Document
          file={documentUrl}
          options={PDF_OPTIONS}
          onLoadSuccess={handleDocumentLoad}
          onLoadError={(loadError) => {
            console.error(
              "Unable to load PDF:",
              loadError
            );

            setError("Unable to load this PDF.");
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
            {renderedPages.map((pageNumber) => (
              <VirtualPdfPage
                key={pageNumber}
                pageNumber={pageNumber}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
                rowHeight={rowHeight}
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
          The session in-charge controls synchronized navigation.
        </p>
      )}
    </section>
  );
}
