import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

function ProgressTrack({
  value,
  barClassName = "bg-brand-500",
  trackClassName = "bg-gray-200",
  heightClassName = "h-2",
  showOutsideLabel = false,
  showInsideLabel = false,
}: {
  value: number;
  barClassName?: string;
  trackClassName?: string;
  heightClassName?: string;
  showOutsideLabel?: boolean;
  showInsideLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative w-full overflow-hidden rounded-full ${trackClassName} ${heightClassName}`}
      >
        <div
          className={`h-full rounded-full ${barClassName} ${
            showInsideLabel ? "flex items-center justify-center" : ""
          }`}
          style={{ width: `${value}%` }}
        >
          {showInsideLabel ? (
            <span className="text-[11px] font-semibold text-white">{value}%</span>
          ) : null}
        </div>
      </div>
      {showOutsideLabel ? (
        <span className="min-w-[40px] text-[15px] font-semibold text-gray-800 dark:text-white/90">
          {value}%
        </span>
      ) : null}
    </div>
  );
}

export default function ProgressBars() {
  return (
    <div>
      <PageMeta
        title="React.js Progress Bars Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Progress Bars page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Progress Bars" />

      <div className="space-y-6">
        <ComponentCard title="Default Progress Bar">
          <div className="space-y-5">
            <ProgressTrack value={55} />
            <ProgressTrack value={85} barClassName="bg-success-500" />
            <ProgressTrack value={35} barClassName="bg-warning-500" />
          </div>
        </ComponentCard>

        <ComponentCard title="Progress Bar In Multiple Sizes">
          <div className="space-y-5">
            <ProgressTrack value={55} heightClassName="h-2" />
            <ProgressTrack value={55} heightClassName="h-3" />
            <ProgressTrack value={55} heightClassName="h-4" />
            <ProgressTrack value={55} heightClassName="h-5" />
          </div>
        </ComponentCard>

        <ComponentCard title="Progress Bar with Outside Label">
          <div className="space-y-6">
            <ProgressTrack value={40} showOutsideLabel />
            <ProgressTrack value={70} showOutsideLabel />
            <ProgressTrack value={30} showOutsideLabel />
          </div>
        </ComponentCard>

        <ComponentCard title="Progress Bar with Inside Label">
          <div className="space-y-6">
            <ProgressTrack value={40} showInsideLabel heightClassName="h-4" />
            <ProgressTrack value={70} showInsideLabel heightClassName="h-4" />
            <ProgressTrack value={30} showInsideLabel heightClassName="h-4" />
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}
