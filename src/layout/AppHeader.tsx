import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

import { ChevronDownIcon } from "../icons";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { useSidebar } from "../context/SidebarContext";
import { navItems, othersItems, type NavItem } from "./AppSidebar";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);

  const location = useLocation();
  const navGroups = useMemo(
    () => [
      { title: "Menu", items: navItems },
      { title: "Others", items: othersItems },
    ],
    []
  );

  const {
    isMobileOpen,
    toggleMobileSidebar,
  } = useSidebar();

  const desktopNavRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    toggleMobileSidebar();
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen((prev) => !prev);
  };

  const isActivePath = (path: string) => location.pathname === path;

  const isItemActive = (item: NavItem) => {
    if (item.path) {
      return isActivePath(item.path);
    }

    return item.subItems?.some((subItem) => isActivePath(subItem.path)) ?? false;
  };

  useEffect(() => {
    setOpenDesktopMenu(null);
    setApplicationMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        desktopNavRef.current &&
        !desktopNavRef.current.contains(event.target as Node)
      ) {
        setOpenDesktopMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const renderDesktopNavItem = (item: NavItem) => {
    const itemIsActive = isItemActive(item);

    if (item.subItems?.length) {
      const isOpen = openDesktopMenu === item.name;

      return (
        <div
          key={item.name}
          className="relative shrink-0"
          onMouseEnter={() => setOpenDesktopMenu(item.name)}
          onMouseLeave={() => setOpenDesktopMenu(null)}
        >
          <button
            type="button"
            onClick={() =>
              setOpenDesktopMenu((prev) => (prev === item.name ? null : item.name))
            }
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              itemIsActive
                ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            }`}
          >
            <span className="h-4 w-4">{item.icon}</span>
            <span>{item.name}</span>
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          <div
            className={`absolute left-0 top-[calc(100%+4px)] z-[100000] min-w-[220px] rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl shadow-gray-200/50 transition-all dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/30 ${
              isOpen
                ? "visible translate-y-0 opacity-100"
                : "invisible -translate-y-2 opacity-0"
            }`}
          >
            {item.subItems.map((subItem) => {
              const subItemIsActive = isActivePath(subItem.path);

              return (
                <Link
                  key={subItem.name}
                  to={subItem.path}
                  className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors last:mb-0 ${
                    subItemIsActive
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                  }`}
                >
                  <span className="flex-1">{subItem.name}</span>
                  {subItem.new ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:bg-green-500/10 dark:text-green-300">
                      New
                    </span>
                  ) : null}
                  {subItem.pro ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Pro
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      );
    }

    if (!item.path) {
      return null;
    }

    return (
      <Link
        key={item.name}
        to={item.path}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          itemIsActive
            ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
        }`}
      >
        <span className="h-4 w-4">{item.icon}</span>
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-99999 flex w-full border-b border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/95">
      <div className="flex w-full grow flex-col lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-3 py-1.5 dark:border-gray-800 lg:flex-1 lg:border-b-0 lg:px-0 lg:py-2">
          <div className="flex min-w-0 items-center gap-3 lg:flex-1 lg:overflow-visible">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400 lg:hidden"
              onClick={handleToggle}
              aria-label="Toggle navigation"
            >
              {isMobileOpen ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="12"
                  viewBox="0 0 16 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>

            <Link to="/" className="shrink-0">
              <img
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                height={34}
              />
              <img
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                height={34}
              />
            </Link>

            <div
              ref={desktopNavRef}
              className="hidden min-w-0 flex-1 overflow-visible lg:ml-8 lg:block xl:ml-12"
            >
              <div className="flex min-w-max items-center gap-2 pr-4 py-1 overflow-visible">
                {navGroups.map((group) => (
                  <div key={group.title} className="flex items-center gap-2">
                    {group.items.map(renderDesktopNavItem)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={toggleApplicationMenu}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <div
          className={`${isApplicationMenuOpen ? "flex" : "hidden"} w-full items-center justify-between gap-4 px-5 py-2 shadow-theme-md lg:flex lg:w-auto lg:shrink-0 lg:items-center lg:justify-end lg:px-0 lg:py-2 lg:pl-6 lg:shadow-none`}
        >
          <div className="flex items-center gap-2 2xsm:gap-3">
            <ThemeToggleButton />
            <NotificationDropdown />
          </div>
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
