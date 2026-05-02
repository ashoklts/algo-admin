import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

function SpinnerRing({
  size = "h-10 w-10",
  border = "border-4",
  color = "border-brand-500",
}: {
  size?: string;
  border?: string;
  color?: string;
}) {
  return (
    <div
      className={`${size} ${border} ${color} animate-spin rounded-full border-t-transparent`}
    />
  );
}

function SpinnerDots() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3 w-3 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.3s]" />
      <span className="h-3 w-3 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.15s]" />
      <span className="h-3 w-3 animate-bounce rounded-full bg-brand-500" />
    </div>
  );
}

function SpinnerBars() {
  return (
    <div className="flex h-10 items-end gap-1.5">
      <span className="h-4 w-1.5 animate-pulse rounded-full bg-brand-500" />
      <span className="h-7 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:150ms]" />
      <span className="h-10 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:300ms]" />
      <span className="h-6 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:450ms]" />
      <span className="h-8 w-1.5 animate-pulse rounded-full bg-brand-500 [animation-delay:600ms]" />
    </div>
  );
}

function ButtonSpinner({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${
        dark
          ? "border-white/50 border-t-white"
          : "border-gray-400/50 border-t-gray-700"
      }`}
    />
  );
}

export default function SpinnersPage() {
  return (
    <div>
      <PageMeta
        title="React.js Spinners Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Spinners page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Spinners" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ComponentCard title="Spinner 1">
          <div className="flex min-h-[160px] items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-8">
              <SpinnerRing />
              <SpinnerRing size="h-12 w-12" border="border-[5px]" color="border-success-500" />
              <SpinnerRing size="h-8 w-8" border="border-4" color="border-warning-500" />
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Spinner 2">
          <div className="flex min-h-[160px] items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-10">
              <SpinnerDots />
              <div className="relative h-12 w-12">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />
                <span className="absolute inset-2 rounded-full bg-brand-500" />
              </div>
              <div className="relative h-12 w-12">
                <span className="absolute inset-0 animate-pulse rounded-full border-4 border-brand-100" />
                <span className="absolute inset-2 animate-pulse rounded-full border-4 border-brand-500" />
              </div>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Spinner 3">
          <div className="flex min-h-[160px] items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-10">
              <SpinnerBars />
              <div className="flex items-center gap-1">
                <span className="h-3 w-3 animate-pulse rounded-full bg-brand-500" />
                <span className="h-3 w-3 animate-pulse rounded-full bg-brand-500 [animation-delay:150ms]" />
                <span className="h-3 w-3 animate-pulse rounded-full bg-brand-500 [animation-delay:300ms]" />
                <span className="h-3 w-3 animate-pulse rounded-full bg-brand-500 [animation-delay:450ms]" />
              </div>
              <SpinnerRing size="h-14 w-14" border="border-[6px]" color="border-brand-200 border-t-brand-500" />
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Spinner with Button">
          <div className="flex min-h-[160px] items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-5">
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-theme-xs">
                <ButtonSpinner />
                Loading...
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white shadow-theme-xs">
                <ButtonSpinner dark />
                Loading...
              </button>
            </div>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}
