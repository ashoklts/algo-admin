import { useState } from "react";

import PageMeta from "../../components/common/PageMeta";

type PricingPlan = {
  name: string;
  price: string;
  previousPrice: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

const monthlyPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "$5.00",
    previousPrice: "$12.00",
    description: "For solo designers & freelancers",
    features: [
      "5 website",
      "500 MB Storage",
      "Unlimited Sub-Domain",
      "3 Custom Domain",
      "Free SSL Certificate",
      "Unlimited Traffic",
    ],
  },
  {
    name: "Medium",
    price: "$10.99",
    previousPrice: "$30.00",
    description: "For working on commercial projects",
    features: [
      "10 website",
      "1 GB Storage",
      "Unlimited Sub-Domain",
      "5 Custom Domain",
      "Free SSL Certificate",
      "Unlimited Traffic",
    ],
    highlighted: true,
  },
  {
    name: "Large",
    price: "$15.00",
    previousPrice: "$59.00",
    description: "For teams larger than 5 members",
    features: [
      "15 website",
      "10 GB Storage",
      "Unlimited Sub-Domain",
      "10 Custom Domain",
      "Free SSL Certificate",
      "Unlimited Traffic",
    ],
  },
];

const yearlyPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "$49.00",
    previousPrice: "$120.00",
    description: "For solo designers & freelancers",
    features: [
      "5 website",
      "500 MB Storage",
      "Unlimited Sub-Domain",
      "3 Custom Domain",
      "Free SSL Certificate",
      "Unlimited Traffic",
    ],
  },
  {
    name: "Medium",
    price: "$99.99",
    previousPrice: "$300.00",
    description: "For working on commercial projects",
    features: [
      "10 website",
      "1 GB Storage",
      "Unlimited Sub-Domain",
      "5 Custom Domain",
      "Free SSL Certificate",
      "Unlimited Traffic",
    ],
    highlighted: true,
  },
  {
    name: "Large",
    price: "$149.00",
    previousPrice: "$590.00",
    description: "For teams larger than 5 members",
    features: [
      "15 website",
      "10 GB Storage",
      "Unlimited Sub-Domain",
      "10 Custom Domain",
      "Free SSL Certificate",
      "Unlimited Traffic",
    ],
  },
];

function CheckIcon({ dark = false }: { dark?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={dark ? "text-[#22C55E]" : "text-[#22C55E]"}
    >
      <path
        d="M13.3327 4L5.99935 11.3333L2.66602 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PricingCard({ plan }: { plan: PricingPlan }) {
  const isHighlighted = !!plan.highlighted;

  return (
    <div
      className={`rounded-[22px] border px-6 pb-6 pt-7 ${
        isHighlighted
          ? "border-[#1F2A3D] bg-[#1F2A3D] text-white"
          : "border-gray-200 bg-white text-gray-900"
      }`}
    >
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h3 className={`text-[22px] font-semibold ${isHighlighted ? "text-white" : "text-[#111928]"}`}>
            {plan.name}
          </h3>
          <div className="mt-5 flex items-end gap-1">
            <span
              className={`text-[28px] leading-none font-bold tracking-[-0.03em] ${
                isHighlighted ? "text-white" : "text-[#111928]"
              } md:text-[38px]`}
            >
              {plan.price}
            </span>
            <span
              className={`mb-1 text-[15px] ${
                isHighlighted ? "text-[#C9D2E3]" : "text-[#475467]"
              }`}
            >
              /month
            </span>
          </div>
          <p
            className={`mt-3 text-[15px] ${
              isHighlighted ? "text-[#C9D2E3]" : "text-[#475467]"
            }`}
          >
            {plan.description}
          </p>
        </div>

        <span
          className={`mt-11 text-[18px] font-semibold line-through ${
            isHighlighted ? "text-[#98A2B3]" : "text-[#98A2B3]"
          }`}
        >
          {plan.previousPrice}
        </span>
      </div>

      <div
        className={`mb-7 h-px w-full ${
          isHighlighted ? "bg-white/12" : "bg-gray-200"
        }`}
      />

      <ul className="space-y-5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <CheckIcon dark={isHighlighted} />
            <span
              className={`text-[15px] ${
                isHighlighted ? "text-white" : "text-[#475467]"
              }`}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <button
        className={`mt-10 inline-flex h-[46px] w-full items-center justify-center rounded-[10px] text-[15px] font-medium transition ${
          isHighlighted
            ? "bg-[#465FFF] text-white hover:bg-[#3B54F6]"
            : "bg-[#1F2A3D] text-white hover:bg-[#172131]"
        }`}
      >
        Choose Starter
      </button>
    </div>
  );
}

export default function PricingTables() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">(
    "monthly"
  );

  const plans = billingCycle === "monthly" ? monthlyPlans : yearlyPlans;

  return (
    <div>
      <PageMeta
        title="React.js Pricing Tables Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Pricing Tables page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />

      <section className="overflow-hidden rounded-[22px] border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="text-[18px] font-semibold text-[#111928]">
            Pricing Table 1
          </h2>
        </div>

        <div className="px-6 pb-8 pt-10 md:px-10 md:pb-8 md:pt-8">
          <div className="mx-auto max-w-[620px] text-center">
            <h1 className="text-[34px] font-bold leading-[1.2] tracking-[-0.03em] text-[#111928] md:text-[52px]">
              Flexible Plans Tailored to Fit Your Unique Needs!
            </h1>

            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-full bg-[#E4E7EC] p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`min-w-[124px] rounded-full px-8 py-3 text-[16px] font-semibold transition ${
                    billingCycle === "monthly"
                      ? "bg-white text-[#111928] shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                      : "text-[#667085]"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annually")}
                  className={`min-w-[124px] rounded-full px-8 py-3 text-[16px] font-semibold transition ${
                    billingCycle === "annually"
                      ? "bg-white text-[#111928] shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                      : "text-[#667085]"
                  }`}
                >
                  Annually
                </button>
              </div>
            </div>
          </div>

          <div className="mt-11 grid grid-cols-1 gap-6 xl:grid-cols-3">
            {plans.map((plan) => (
              <PricingCard key={`${billingCycle}-${plan.name}`} plan={plan} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
