import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

export interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
  value?: string;
  disabled?: boolean;
  menuClassName?: string;
  optionClassName?: string;
  selectedOptionClassName?: string;
  iconClassName?: string;
  triggerStyle?: CSSProperties;
  menuStyle?: CSSProperties;
  optionStyle?: CSSProperties;
  selectedOptionStyle?: CSSProperties;
  iconStyle?: CSSProperties;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const DEFAULT_MENU_OFFSET = 8;

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  className = "",
  defaultValue = "",
  value,
  disabled = false,
  menuClassName = "",
  optionClassName = "",
  selectedOptionClassName = "",
  iconClassName = "",
  triggerStyle,
  menuStyle,
  optionStyle,
  selectedOptionStyle,
  iconStyle,
}) => {
  const isControlled = typeof value === "string";
  const [internalValue, setInternalValue] = useState<string>(defaultValue);
  const selectedValue = isControlled ? value ?? "" : internalValue;
  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue) ?? null,
    [options, selectedValue]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null);
  const optionsMapRef = useRef<Record<string, HTMLButtonElement | null>>({});

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + DEFAULT_MENU_OFFSET,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, isControlled]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleWindowChange = () => {
      updateMenuPosition();
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const selectedNode =
      optionsMapRef.current[selectedValue] ?? selectedOptionRef.current;

    if (selectedNode) {
      selectedNode.scrollIntoView({
        block: "nearest",
      });
    } else if (menuRef.current) {
      menuRef.current.scrollTop = 0;
    }
  }, [isOpen, selectedValue]);

  const handleSelect = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange(nextValue);
    setIsOpen(false);
  };

  const handleTriggerClick = () => {
    if (disabled) {
      return;
    }

    if (!isOpen) {
      updateMenuPosition();
    }

    setIsOpen((prev) => !prev);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      updateMenuPosition();
      setIsOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className={`relative flex h-11 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm shadow-theme-xs transition focus:border-[#465fff] focus:outline-hidden focus:ring-3 focus:ring-[#465fff]/10 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-[#465fff] ${
          selectedOption
            ? "text-gray-800 dark:text-white/90"
            : "text-gray-400 dark:text-gray-400"
        } ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={triggerStyle}
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <svg
          className={`ml-3 h-4 w-4 shrink-0 text-[#465fff] transition-transform ${
            isOpen ? "rotate-180" : ""
          } ${iconClassName}`}
          style={iconStyle}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              className={`fixed max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-2xl shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-900 ${menuClassName}`}
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                zIndex: 200000,
                ...menuStyle,
              }}
              role="listbox"
            >
              {options.map((option) => {
                const isSelected = option.value === selectedValue;

                return (
                  <button
                    key={option.value}
                    ref={(element) => {
                      optionsMapRef.current[option.value] = element;
                      if (isSelected) {
                        selectedOptionRef.current = element;
                      }
                    }}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`flex w-full items-center px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                    } ${isSelected ? selectedOptionClassName : optionClassName}`}
                    role="option"
                    aria-selected={isSelected}
                    style={isSelected ? selectedOptionStyle : optionStyle}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default Select;
