import Link from "next/link";

export default function BusinessNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] px-6">
      <div className="max-w-md text-center">
        <h1 className="mb-3 font-display text-[32px] text-[#1A1A1A]">
          Business not found
        </h1>
        <p className="mb-6 text-sm text-[#6B6B6B]">
          This business profile does not exist or has been removed.
        </p>
        <Link
          href="/search"
          className="rounded-full bg-[#E8824A] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#D4713A]"
        >
          Back to search
        </Link>
      </div>
    </div>
  );
}
