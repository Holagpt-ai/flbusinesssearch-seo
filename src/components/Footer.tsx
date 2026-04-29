import React from "react";

type FooterProps = {
  footerCopy: string;
};

export function Footer({ footerCopy }: FooterProps) {
  return (
    <footer className="mt-16 bg-[#1A1A1A] px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-[#6B6B6B]">{footerCopy}</p>

        <div className="flex items-center gap-4">
          <a
            href="/privacy"
            className="text-xs text-[rgba(255,255,255,0.30)] transition-colors duration-150 hover:text-[rgba(255,255,255,0.70)]"
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="text-xs text-[rgba(255,255,255,0.30)] transition-colors duration-150 hover:text-[rgba(255,255,255,0.70)]"
          >
            Terms
          </a>
          <a
            href="/api"
            className="text-xs text-[rgba(255,255,255,0.30)] transition-colors duration-150 hover:text-[rgba(255,255,255,0.70)]"
          >
            API
          </a>
          <a
            href="/sitemap.xml"
            className="text-xs text-[rgba(255,255,255,0.30)] transition-colors duration-150 hover:text-[rgba(255,255,255,0.70)]"
          >
            Sitemap
          </a>
          <a
            href="https://dos.fl.gov/sunbiz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[rgba(255,255,255,0.30)] transition-colors duration-150 hover:text-[rgba(255,255,255,0.70)]"
          >
            Data: Florida DOS
          </a>
          <a
            href="https://www.linkedin.com/in/flbusinesssearch"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-[rgba(255,255,255,0.30)] transition-colors duration-150 hover:text-[rgba(255,255,255,0.70)]"
            aria-label="LinkedIn"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M14.5 0H1.5C0.67 0 0 0.67 0 1.5v13c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5v-13C16 .67 15.33 0 14.5 0ZM4.74 13.33H2.37V6h2.37v7.33ZM3.56 4.97c-.76 0-1.38-.62-1.38-1.38 0-.76.62-1.38 1.38-1.38.76 0 1.38.62 1.38 1.38 0 .76-.62 1.38-1.38 1.38Zm9.77 8.36h-2.36V9.76c0-.85-.02-1.94-1.18-1.94-1.18 0-1.36.92-1.36 1.88v3.63H6.06V6h2.27v1h.03c.32-.6 1.1-1.24 2.26-1.24 2.42 0 2.87 1.59 2.87 3.66v3.91Z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

