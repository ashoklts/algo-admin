import { useEffect, useRef, useState } from "react";

import PageMeta from "../../components/common/PageMeta";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ChevronDownIcon, UserIcon, BoltIcon, DocsIcon, MailIcon, PlugInIcon, TrashBinIcon } from "../../icons";

function TriggerButton({
  label,
  isOpen,
  onClick,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[46px] items-center gap-3 rounded-xl border px-4 text-[15px] font-medium shadow-theme-xs transition ${
        isOpen
          ? "border-brand-500 bg-brand-500 text-white hover:bg-brand-600"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span>{label}</span>
      <ChevronDownIcon
        className={`h-5 w-5 transition-transform ${
          isOpen ? "rotate-180 text-white" : "text-gray-500"
        }`}
      />
    </button>
  );
}

function MenuItem({
  children,
  icon,
  danger = false,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[15px] font-medium transition ${
        danger
          ? "text-error-500 hover:bg-error-50"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {icon ? <span className={danger ? "text-error-500" : "text-gray-500"}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

function DropdownMenu({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="absolute left-0 top-[calc(100%+10px)] z-30 min-w-[216px] rounded-2xl border border-gray-200 bg-white p-3 shadow-[0px_12px_24px_-6px_rgba(16,24,40,0.08)]">
      {children}
    </div>
  );
}

export default function Dropdowns() {
  const [openDropdown, setOpenDropdown] = useState<string | null>("default");
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = (key: string) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef}>
      <PageMeta
        title="React.js Dropdowns Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Dropdowns page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Dropdowns" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ComponentCard title="Default Dropdown">
          <div className="min-h-[230px] overflow-visible">
            <div className="relative inline-block">
              <TriggerButton
                label="Account Menu"
                isOpen={openDropdown === "default"}
                onClick={() => toggleDropdown("default")}
              />
              <DropdownMenu open={openDropdown === "default"}>
                <MenuItem>Edit Profile</MenuItem>
                <MenuItem>Account Settings</MenuItem>
                <MenuItem>License</MenuItem>
                <MenuItem>Support</MenuItem>
              </DropdownMenu>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Dropdown with Divider">
          <div className="min-h-[360px] overflow-visible">
            <div className="relative inline-block">
              <TriggerButton
                label="Options"
                isOpen={openDropdown === "divider"}
                onClick={() => toggleDropdown("divider")}
              />
              <DropdownMenu open={openDropdown === "divider"}>
                <MenuItem>Edit</MenuItem>
                <MenuItem>Duplicate</MenuItem>
                <div className="my-2 h-px bg-gray-200" />
                <MenuItem>Archive</MenuItem>
                <MenuItem>Move</MenuItem>
                <div className="my-2 h-px bg-gray-200" />
                <MenuItem danger>Delete</MenuItem>
              </DropdownMenu>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Dropdown with Icon">
          <div className="min-h-[270px] overflow-visible">
            <div className="relative inline-block">
              <TriggerButton
                label="Account Menu"
                isOpen={openDropdown === "icon"}
                onClick={() => toggleDropdown("icon")}
              />
              <DropdownMenu open={openDropdown === "icon"}>
                <MenuItem icon={<UserIcon className="h-4 w-4" />}>Edit profile</MenuItem>
                <MenuItem icon={<BoltIcon className="h-4 w-4" />}>Settings</MenuItem>
                <MenuItem icon={<PlugInIcon className="h-4 w-4" />}>Support</MenuItem>
                <MenuItem icon={<MailIcon className="h-4 w-4" />} danger>
                  Sign out
                </MenuItem>
              </DropdownMenu>
            </div>
          </div>
        </ComponentCard>

        <ComponentCard title="Dropdown with Icon & Divider">
          <div className="min-h-[360px] overflow-visible">
            <div className="relative inline-block">
              <TriggerButton
                label="Options"
                isOpen={openDropdown === "icon-divider"}
                onClick={() => toggleDropdown("icon-divider")}
              />
              <DropdownMenu open={openDropdown === "icon-divider"}>
                <MenuItem icon={<UserIcon className="h-4 w-4" />}>Edit profile</MenuItem>
                <MenuItem icon={<BoltIcon className="h-4 w-4" />}>Settings</MenuItem>
                <div className="my-2 h-px bg-gray-200" />
                <MenuItem icon={<DocsIcon className="h-4 w-4" />}>Files</MenuItem>
                <MenuItem icon={<PlugInIcon className="h-4 w-4" />}>Support</MenuItem>
                <div className="my-2 h-px bg-gray-200" />
                <MenuItem icon={<TrashBinIcon className="h-4 w-4" />} danger>
                  Delete
                </MenuItem>
              </DropdownMenu>
            </div>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}
