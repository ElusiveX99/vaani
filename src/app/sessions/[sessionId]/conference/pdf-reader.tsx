"use client";

import {
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

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc =
  new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

type Props = {
  documentUrl: string;
  documentSizeBytes: number;
  currentPage: number;
  canControl: boolean;
  onPageChange: (page: number) => void;
};

const PDF_OPTIONS = {
  disableRange: false,
  disableStream: true,
  disableAutoFetch: true,
  rangeChunkSize: 262144,
};

export default function PdfReader({
  documentUrl,
  documentSizeBytes,
  currentPage,
  canControl,
  onPageChange,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const lastReportedPage =
    useRef(currentPage);

  const [numPages, setNumPages] =
    useState(0);

  const [pageWidth, setPageWidth] =
    useState(700);

  const [pageHeight, setPageHeight] =
    useState(990);

  const [scrollTop, setScrollTop] =
    useState(0);

  const [containerHeight, setContainerHeight] =
    useState(700);

  const [inputPage, setInputPage] =
    useState(String(currentPage));

  const [error, setError] =
    useState("");

  const rowHeight =
    pageHeight + 24;

  const visibleStart =
    Math.max(
      0,
      Math.floor(
        scrollTop / rowHeight
      )
    );

  const visibleCount =
    Math.ceil(
      containerHeight / rowHeight
    ) + 3;

  const firstPage =
    Math.max(
      1,
      visibleStart + 1
    );

  const lastPage =
    Math.min(
      numPages,
      firstPage + visibleCount - 1
    );

  const renderedPages =
    Array.from(
      {
        length:
          Math.max(
            0,
            lastPage -
              firstPage +
              1
          ),
      },
      (_, index) =>
        firstPage + index
    );

  const topSpacerHeight =
    (firstPage - 1) *
    rowHeight;

  const bottomSpacerHeight =
    Math.max(
      0,
      numPages - lastPage
    ) *
    rowHeight;

  const jumpToPage =
    useCallback(
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

        lastReportedPage.current =
          page;

        setInputPage(
          String(page)
        );

        const top =
          (page - 1) *
          rowHeight;

        containerRef.current.scrollTo({
          top,
          behavior: "auto",
        });

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

  const handleScroll =
    useCallback(() => {
      const container =
        containerRef.current;

      if (!container) {
        return;
      }

      const top =
        container.scrollTop;

      setScrollTop(top);

      if (
        !canControl ||
        !numPages
      ) {
        return;
      }

      const page =
        Math.min(
          numPages,
          Math.max(
            1,
            Math.floor(
              top / rowHeight
            ) + 1
          )
        );

      if (
        page !==
        lastReportedPage.current
      ) {
        lastReportedPage.current =
          page;

        setInputPage(
          String(page)
        );

        onPageChange(page);
      }
    }, [
      canControl,
      numPages,
      rowHeight,
      onPageChange,
    ]);

  useEffect(() => {
    setInputPage(
      String(currentPage)
    );

    if (
      currentPage !==
        lastReportedPage.current &&
      containerRef.current &&
      numPages
    ) {
      lastReportedPage.current =
        currentPage;

      const top =
        (currentPage - 1) *
        rowHeight;

      containerRef.current.scrollTo({
        top,
        behavior: "auto",
      });

      setScrollTop(top);
    }
  }, [
    currentPage,
    numPages,
    rowHeight,
  ]);

  useEffect(() => {
    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    const updateSize =
      () => {
        const width =
          Math.max(
            280,
            Math.min(
              900,
              container.clientWidth -
                40
            )
          );

        setPageWidth(width);

        setContainerHeight(
          container.clientHeight
        );
      };

    updateSize();

    const observer =
      new ResizeObserver(
        updateSize
      );

    observer.observe(
      container
    );

    return () =>
      observer.disconnect();
  }, []);

  async function handleDocumentLoad(
    pdf: {
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
    }
  ) {
    setNumPages(
      pdf.numPages
    );

    setError("");

    try {
      const firstPage =
        await pdf.getPage(1);

      const viewport =
        firstPage.getViewport({
          scale: 1,
        });

      const availableWidth =
        Math.max(
          280,
          Math.min(
            900,
            (
              containerRef
                .current
                ?.clientWidth ??
              740
            ) - 40
          )
        );

      const calculatedHeight =
        (availableWidth /
          viewport.width) *
        viewport.height;

      setPageWidth(
        availableWidth
      );

      setPageHeight(
        calculatedHeight
      );

      setContainerHeight(
        containerRef
          .current
          ?.clientHeight ??
        700
      );

      requestAnimationFrame(
        () => {
          if (
            containerRef.current
          ) {
            const top =
              (currentPage - 1) *
              (
                calculatedHeight +
                24
              );

            containerRef.current.scrollTop =
              top;

            setScrollTop(top);
          }
        }
      );
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
    const page =
      Number(inputPage);

    if (
      !Number.isSafeInteger(
        page
      )
    ) {
      setInputPage(
        String(currentPage)
      );

      return;
    }

    jumpToPage(page);
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
              currentPage <= 1
            }
            onClick={() =>
              jumpToPage(
                currentPage - 1
              )
            }
            className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-30"
          >
            Previous
          </button>

          <div className="flex items-center gap-1 text-xs">
            <input
              type="number"
              min={1}
              max={
                numPages ||
                undefined
              }
              value={inputPage}
              disabled={
                !canControl ||
                !numPages
              }
              onChange={event =>
                setInputPage(
                  event.target.value
                )
              }
              onKeyDown={event => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  submitPageJump();
                }
              }}
              onBlur={
                submitPageJump
              }
              className="w-14 rounded-md border border-white/15 bg-white/10 px-2 py-2 text-center text-white outline-none focus:border-white/40 disabled:opacity-50"
              aria-label="Go to page"
            />

            <span className="text-white/50">
              /{" "}
              {numPages ||
                "—"}
            </span>
          </div>

          <button
            type="button"
            disabled={
              !canControl ||
              currentPage >=
                numPages
            }
            onClick={() =>
              jumpToPage(
                currentPage + 1
              )
            }
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
        onScroll={
          handleScroll
        }
        className="min-h-0 flex-1 overflow-auto px-2 py-3"
      >
        <Document
          key={documentUrl}
          file={{
            url: documentUrl,
          }}
          options={
            PDF_OPTIONS
          }
          onLoadSuccess={
            handleDocumentLoad
          }
          onLoadError={loadError => {
            console.error(
              "Unable to load PDF:",
              loadError
            );

            setError(
              "Unable to load this PDF."
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
              height:
                topSpacerHeight,
            }}
          />

          <div className="flex flex-col items-center gap-6">
            {renderedPages.map(
              pageNumber => (
                <div
                  key={
                    pageNumber
                  }
                  className="flex w-full justify-center"
                  style={{
                    minHeight:
                      rowHeight,
                  }}
                >
                  <Page
                    pageNumber={
                      pageNumber
                    }
                    width={
                      pageWidth
                    }
                    renderTextLayer
                    renderAnnotationLayer
                    loading={
                      <div
                        style={{
                          height:
                            pageHeight,
                          width:
                            pageWidth,
                        }}
                        className="flex items-center justify-center rounded bg-white/5 text-sm text-white/40"
                      >
                        Loading page{" "}
                        {pageNumber}
                        ...
                      </div>
                    }
                  />
                </div>
              )
            )}
          </div>

          <div
            style={{
              height:
                bottomSpacerHeight,
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
