import { useState } from "react";
import { Link } from "react-router";

import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { PlusIcon } from "../../icons";

type IntegrationCardItem = {
  name: string;
  description: string;
  enabled: boolean;
  logo: React.ReactNode;
};

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative h-8 w-[46px] rounded-full transition-colors ${
        enabled ? "bg-brand-500" : "bg-gray-200"
      }`}
      aria-label="Toggle integration"
    >
      <span
        className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-[20px]" : "translate-x-[4px]"
        }`}
      />
    </button>
  );
}

function CardActionIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.0013 5.83366C10.4616 5.83366 10.8346 5.46056 10.8346 5.00033C10.8346 4.54009 10.4616 4.16699 10.0013 4.16699C9.54108 4.16699 9.16797 4.54009 9.16797 5.00033C9.16797 5.46056 9.54108 5.83366 10.0013 5.83366Z"
        fill="currentColor"
      />
      <path
        d="M10.0013 10.8337C10.4616 10.8337 10.8346 10.4606 10.8346 10.0003C10.8346 9.54009 10.4616 9.16699 10.0013 9.16699C9.54108 9.16699 9.16797 9.54009 9.16797 10.0003C9.16797 10.4606 9.54108 10.8337 10.0013 10.8337Z"
        fill="currentColor"
      />
      <path
        d="M10.0013 15.8337C10.4616 15.8337 10.8346 15.4606 10.8346 15.0003C10.8346 14.5401 10.4616 14.167 10.0013 14.167C9.54108 14.167 9.16797 14.5401 9.16797 15.0003C9.16797 15.4606 9.54108 15.8337 10.0013 15.8337Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.25898 2.92957C8.61931 1.69014 10.3807 1.69014 10.741 2.92957C10.9731 3.7279 11.8898 4.09666 12.5874 3.64417C13.6702 2.94154 15.0585 4.32977 14.3558 5.41261C13.9033 6.11018 14.2721 7.02692 15.0704 7.25898C16.3099 7.61931 16.3099 9.38069 15.0704 9.74102C14.2721 9.97308 13.9033 10.8898 14.3558 11.5874C15.0585 12.6702 13.6702 14.0585 12.5874 13.3558C11.8898 12.9033 10.9731 13.2721 10.741 14.0704C10.3807 15.3099 8.61931 15.3099 8.25898 14.0704C8.02692 13.2721 7.11018 12.9033 6.41261 13.3558C5.32977 14.0585 3.94154 12.6702 4.64417 11.5874C5.09666 10.8898 4.7279 9.97308 3.92957 9.74102C2.69014 9.38069 2.69014 7.61931 3.92957 7.25898C4.7279 7.02692 5.09666 6.11018 4.64417 5.41261C3.94154 4.32977 5.32977 2.94154 6.41261 3.64417C7.11018 4.09666 8.02692 3.7279 8.25898 2.92957Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12.0833 8.33366C12.0833 9.48425 11.1506 10.417 10 10.417C8.84941 10.417 7.91666 9.48425 7.91666 8.33366C7.91666 7.18307 8.84941 6.25033 10 6.25033C11.1506 6.25033 12.0833 7.18307 12.0833 8.33366Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MailchimpLogo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center text-[#111827]">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17.8295 6.33545C20.4198 6.33545 22.5186 8.43416 22.5186 11.0245V14.3337C22.5186 17.728 19.7665 20.4801 16.3722 20.4801H13.6462C9.86629 20.4801 6.802 17.4158 6.802 13.6359V11.0245C6.802 8.43416 8.90071 6.33545 11.4911 6.33545H17.8295Z"
          fill="#111827"
        />
        <path
          d="M8.1875 13.8397C8.1875 16.4984 10.3428 18.6537 13.0014 18.6537H16.2827C18.2705 18.6537 19.882 17.0422 19.882 15.0544V10.7617C19.882 9.28911 18.6884 8.09551 17.2158 8.09551H12.2217C10.0028 8.09551 8.1875 9.9108 8.1875 12.1297V13.8397Z"
          fill="#FFF4D9"
        />
        <path
          d="M20.1555 8.57093C21.2315 8.57093 22.1037 7.69871 22.1037 6.62273C22.1037 5.54675 21.2315 4.67453 20.1555 4.67453C19.0796 4.67453 18.2073 5.54675 18.2073 6.62273C18.2073 7.69871 19.0796 8.57093 20.1555 8.57093Z"
          fill="#111827"
        />
      </svg>
    </div>
  );
}

function GoogleMeetLogo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center">
      <svg
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6 8.625C6 7.72754 6.72754 7 7.625 7H14.75V15.5H6V8.625Z" fill="#FBBC04" />
        <path d="M14.75 7H19.125C20.0225 7 20.75 7.72754 20.75 8.625V12.25H14.75V7Z" fill="#EA4335" />
        <path d="M14.75 12.25H20.75V20.375C20.75 21.2725 20.0225 22 19.125 22H14.75V12.25Z" fill="#34A853" />
        <path d="M6 15.5H14.75V22H7.625C6.72754 22 6 21.2725 6 20.375V15.5Z" fill="#4285F4" />
        <path d="M24 10.625L20.75 12.75V16.25L24 18.375C24.665 18.8097 25.5 18.3327 25.5 17.5399V11.4601C25.5 10.6673 24.665 10.1903 24 10.625Z" fill="#34A853" />
      </svg>
    </div>
  );
}

function ZoomLogo() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A7CFF]">
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="4" y="6" width="9.5" height="10" rx="2.5" fill="white" />
        <path d="M14.5 9.04865L17.6135 7.26376C18.2799 6.88171 19.1 7.36322 19.1 8.13011V13.8699C19.1 14.6368 18.2799 15.1183 17.6135 14.7362L14.5 12.9513V9.04865Z" fill="white" />
      </svg>
    </div>
  );
}

function IntegrationCard({
  item,
  onToggle,
}: {
  item: IntegrationCardItem;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="min-h-[198px] px-5 pb-10 pt-6">
        <div className="mb-5 flex items-start justify-between">
          {item.logo}
          <button className="text-gray-300 transition hover:text-gray-500">
            <CardActionIcon />
          </button>
        </div>

        <h3 className="mb-3 text-[20px] font-semibold tracking-[-0.02em] text-gray-900">
          {item.name}
        </h3>
        <p className="max-w-[320px] text-[15px] leading-8 text-gray-500">
          {item.description}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-5 py-5">
        <div className="flex items-center gap-3">
          <button className="flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:bg-gray-50">
            <SettingsIcon />
          </button>
          <button className="inline-flex h-[44px] items-center rounded-xl border border-gray-200 bg-white px-4 text-[15px] font-medium text-gray-900 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:bg-gray-50">
            Details
          </button>
        </div>

        <Toggle enabled={item.enabled} onToggle={onToggle} />
      </div>
    </div>
  );
}

export default function Integrations() {
  const [cards, setCards] = useState<IntegrationCardItem[]>([
    {
      name: "Mailchimp",
      description:
        "Connect Mailchimp to streamline your email marketing—automate campaigns.",
      enabled: true,
      logo: <MailchimpLogo />,
    },
    {
      name: "Google Meet",
      description:
        "Connect your Google Meet account for seamless video conferencing.",
      enabled: false,
      logo: <GoogleMeetLogo />,
    },
    {
      name: "Zoom",
      description:
        "Integrate Zoom to streamline your virtual meetings and team collaborations",
      enabled: false,
      logo: <ZoomLogo />,
    },
  ]);

  const handleToggle = (index: number) => {
    setCards((prev) =>
      prev.map((card, cardIndex) =>
        cardIndex === index ? { ...card, enabled: !card.enabled } : card
      )
    );
  };

  return (
    <div className="bg-white">
      <PageMeta
        title="React.js Integrations Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Integrations page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />

      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-gray-900">
          Integrations
        </h1>

        <div className="flex flex-wrap items-center gap-5">
          <nav>
            <ol className="flex items-center gap-2 text-[15px] text-gray-500">
              <li>
                <Link to="/" className="transition hover:text-gray-700">
                  Home
                </Link>
              </li>
              <li className="text-gray-300">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 12L10 8L6 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </li>
              <li className="font-medium text-gray-800">Integrations</li>
            </ol>
          </nav>

          <Button
            className="h-[44px] rounded-xl px-5 text-[15px] font-medium"
            startIcon={<PlusIcon className="h-4 w-4" />}
          >
            Add New Integration
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {cards.map((item, index) => (
          <IntegrationCard
            key={item.name}
            item={item}
            onToggle={() => handleToggle(index)}
          />
        ))}
      </div>
    </div>
  );
}
