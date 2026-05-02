import { useState } from "react";

import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { BoltIcon, ChatIcon, GroupIcon, UserCircleIcon } from "../../icons";

const tabItems = ["Overview", "Notification", "Analytics", "Customers"] as const;
type TabKey = (typeof tabItems)[number];

const tabCopy: Record<TabKey, string> = {
  Overview:
    "Overview ipsum dolor sit amet consectetur. Non vitae facilisis urna tortor placerat egestas donec. Faucibus diam gravida enim elit lacus a. Tincidunt fermentum condimentum quis et a et tempus. Tristique urna nisi nulla elit sit libero scelerisque ante.",
  Notification:
    "Notification ipsum dolor sit amet consectetur. Non vitae facilisis urna tortor placerat egestas donec. Faucibus diam gravida enim elit lacus a. Tincidunt fermentum condimentum quis et a et tempus. Tristique urna nisi nulla elit sit libero scelerisque ante.",
  Analytics:
    "Analytics ipsum dolor sit amet consectetur. Non vitae facilisis urna tortor placerat egestas donec. Faucibus diam gravida enim elit lacus a. Tincidunt fermentum condimentum quis et a et tempus. Tristique urna nisi nulla elit sit libero scelerisque ante.",
  Customers:
    "Customers ipsum dolor sit amet consectetur. Non vitae facilisis urna tortor placerat egestas donec. Faucibus diam gravida enim elit lacus a. Tincidunt fermentum condimentum quis et a et tempus. Tristique urna nisi nulla elit sit libero scelerisque ante.",
};

const tabIcons: Record<TabKey, React.ReactNode> = {
  Overview: <BoltIcon className="h-4 w-4" />,
  Notification: <ChatIcon className="h-4 w-4" />,
  Analytics: <UserCircleIcon className="h-4 w-4" />,
  Customers: <GroupIcon className="h-4 w-4" />,
};

const tabBadges: Partial<Record<TabKey, string>> = {
  Overview: "8",
  Analytics: "4",
  Customers: "12",
};

function TabContent({ activeTab }: { activeTab: TabKey }) {
  return (
    <div className="pt-5 sm:pt-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        {activeTab}
      </h3>
      <p className="mt-3 max-w-[770px] text-sm leading-6 text-gray-500 dark:text-gray-400">
        {tabCopy[activeTab]}
      </p>
    </div>
  );
}

function DefaultTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {tabItems.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-500 text-white shadow-theme-xs"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.05] dark:hover:text-white/90"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
      <TabContent activeTab={activeTab} />
    </>
  );
}

function UnderlineTabs({
  activeTab,
  setActiveTab,
  withIcon = false,
  withBadge = false,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  withIcon?: boolean;
  withBadge?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 px-5 py-5 dark:border-gray-800 sm:px-6 sm:py-6">
      <div className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          {tabItems.map((tab) => {
            const active = activeTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative inline-flex items-center gap-2 px-0 pb-5 pt-3 text-sm font-medium leading-none transition ${
                  active
                    ? "text-brand-500"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
                }`}
              >
                {withIcon ? (
                  <span className={active ? "text-brand-500" : "text-gray-400"}>
                    {tabIcons[tab]}
                  </span>
                ) : null}
                <span>{tab}</span>
                {withBadge && tabBadges[tab] ? (
                  <span
                    className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      active
                        ? "bg-brand-50 text-brand-500 dark:bg-brand-500/10"
                        : "bg-gray-100 text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"
                    }`}
                  >
                    {tabBadges[tab]}
                  </span>
                ) : null}
                <span
                  className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full transition ${
                    active ? "bg-brand-500" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
      <TabContent activeTab={activeTab} />
    </div>
  );
}

function VerticalTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}) {
  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:gap-8">
      <div className="flex min-w-[220px] flex-col gap-2 rounded-xl border border-gray-200 p-2 dark:border-gray-800">
        {tabItems.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-3 text-left text-sm font-medium transition ${
                active
                  ? "bg-brand-500 text-white shadow-theme-xs"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-white/90"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
      <div className="flex-1">
        <TabContent activeTab={activeTab} />
      </div>
    </div>
  );
}

export default function TabsPage() {
  const [defaultTab, setDefaultTab] = useState<TabKey>("Overview");
  const [underlineTab, setUnderlineTab] = useState<TabKey>("Overview");
  const [iconTab, setIconTab] = useState<TabKey>("Overview");
  const [badgeTab, setBadgeTab] = useState<TabKey>("Overview");
  const [verticalTab, setVerticalTab] = useState<TabKey>("Overview");

  return (
    <div>
      <PageMeta
        title="React.js Tabs Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Tabs page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Tabs" />

      <div className="space-y-6">
        <ComponentCard title="Default Tabs">
          <DefaultTabs activeTab={defaultTab} setActiveTab={setDefaultTab} />
        </ComponentCard>

        <ComponentCard title="Tabs with underline">
          <UnderlineTabs
            activeTab={underlineTab}
            setActiveTab={setUnderlineTab}
          />
        </ComponentCard>

        <ComponentCard title="Tabs with underline and icon">
          <UnderlineTabs activeTab={iconTab} setActiveTab={setIconTab} withIcon />
        </ComponentCard>

        <ComponentCard title="Tabs with badge">
          <UnderlineTabs activeTab={badgeTab} setActiveTab={setBadgeTab} withBadge />
        </ComponentCard>

        <ComponentCard title="Vertical Tabs">
          <VerticalTabs activeTab={verticalTab} setActiveTab={setVerticalTab} />
        </ComponentCard>
      </div>
    </div>
  );
}
