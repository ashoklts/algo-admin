import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

const ribbonText =
  "Lorem ipsum dolor sit amet consectetur. Eget nulla suscipit arcu rutrum amet vel nec fringilla vulputate. Sed aliquam fringilla vulputate imperdiet arcu natoque purus ac nec ultricies nulla ultrices.";

function RibbonBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-gray-200 bg-white px-5 pb-5 pt-[58px]">
      <div className="absolute left-0 top-0">{children}</div>
      <p className="max-w-[620px] text-[15px] leading-8 text-gray-500">
        {ribbonText}
      </p>
    </div>
  );
}

function RoundedRibbon() {
  return (
    <span className="inline-flex h-[40px] items-center rounded-br-full rounded-tr-full bg-brand-500 px-5 text-[14px] font-semibold text-white">
      Popular
    </span>
  );
}

function ShapeRibbon() {
  return (
    <div className="inline-flex h-[38px] items-center overflow-hidden bg-brand-500 text-white">
      <span className="px-4 text-[14px] font-semibold">Popular</span>
      <span className="block h-0 w-0 border-b-[19px] border-l-[15px] border-t-[19px] border-b-transparent border-l-white border-t-transparent" />
      <span className="block h-0 w-0 border-b-[19px] border-r-[15px] border-t-[19px] border-b-transparent border-r-brand-500 border-t-transparent" />
    </div>
  );
}

function CornerRibbon() {
  return (
    <div className="absolute left-0 top-0 overflow-hidden rounded-tl-[18px]">
      <div className="relative h-[54px] w-[54px] overflow-hidden">
        <div className="absolute -left-[18px] top-[9px] w-[76px] -rotate-45 bg-brand-500 py-0.5 text-center text-[14px] font-semibold text-white shadow-sm">
          New
        </div>
      </div>
    </div>
  );
}

function IconRibbon() {
  return (
    <div className="inline-flex h-[40px] items-center overflow-hidden bg-brand-500 text-white">
      <span className="flex items-center px-4">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9.0712 1.3335L3.42834 8.10684H7.28549L6.92834 14.6668L12.5712 7.8935H8.71406L9.0712 1.3335Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="block h-0 w-0 border-b-[20px] border-l-[16px] border-t-[20px] border-b-transparent border-l-white border-t-transparent" />
      <span className="block h-0 w-0 border-b-[20px] border-r-[16px] border-t-[20px] border-b-transparent border-r-brand-500 border-t-transparent" />
    </div>
  );
}

export default function RibbonsPage() {
  return (
    <div>
      <PageMeta
        title="React.js Ribbons Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Ribbons page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Ribbons" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ComponentCard title="Rounded Ribbon">
          <RibbonBox>
            <RoundedRibbon />
          </RibbonBox>
        </ComponentCard>

        <ComponentCard title="Ribbon With Shape">
          <RibbonBox>
            <ShapeRibbon />
          </RibbonBox>
        </ComponentCard>

        <ComponentCard title="Filed Ribbon">
          <div className="relative overflow-hidden rounded-[18px] border border-gray-200 bg-white px-5 pb-5 pt-[58px]">
            <CornerRibbon />
            <p className="max-w-[620px] text-[15px] leading-8 text-gray-500">
              {ribbonText}
            </p>
          </div>
        </ComponentCard>

        <ComponentCard title="Filed Ribbon">
          <RibbonBox>
            <IconRibbon />
          </RibbonBox>
        </ComponentCard>
      </div>
    </div>
  );
}
