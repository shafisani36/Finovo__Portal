import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
  colorDot?: string;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  label?: string;
  options: (SelectOption | string)[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  leadingIcon?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filter' | 'ghost';
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  clearable?: boolean;
  prefix?: React.ReactNode;
  fullWidth?: boolean;
  customTrigger?: (selectedOption?: SelectOption, isOpen?: boolean) => React.ReactNode;
}

/**
 * Standard enterprise custom select dropdown
 * Uses React Portal to document.body with z-[99999] to guarantee it is NEVER clipped
 * by table overflow-hidden, overflow-x-auto, or obscured by headers.
 */
export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  leadingIcon,
  searchable,
  searchPlaceholder = 'Search...',
  error,
  helperText,
  disabled = false,
  required = false,
  size = 'md',
  variant = 'default',
  align = 'left',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  clearable = false,
  prefix,
  fullWidth = false,
  customTrigger,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options to SelectOption[]
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const stringVal = String(value ?? '');
  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === stringVal);

  // Auto-enable search if more than 7 options unless explicitly specified
  const isSearchable = searchable ?? (normalizedOptions.length > 7);

  const filteredOptions = useMemo(() => {
    if (!isSearchable || !searchTerm.trim()) {
      return normalizedOptions;
    }
    const term = searchTerm.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.description && opt.description.toLowerCase().includes(term)) ||
        (opt.badge && opt.badge.toLowerCase().includes(term))
    );
  }, [normalizedOptions, isSearchable, searchTerm]);

  // Viewport-aware position calculator with responsive boundary clamping
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // Auto-close if trigger has scrolled completely out of viewport
    if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
      setIsOpen(false);
      return;
    }

    const maxAllowedWidth = Math.max(160, window.innerWidth - 24);
    const calculatedWidth = fullWidth ? rect.width : Math.max(rect.width, Math.min(220, maxAllowedWidth));
    const menuWidth = Math.min(maxAllowedWidth, calculatedWidth);

    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    let placement: 'top' | 'bottom' = 'bottom';
    let maxHeight = Math.max(140, Math.min(320, spaceBelow));
    let top = rect.bottom + 6;

    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      placement = 'top';
      maxHeight = Math.max(140, Math.min(320, spaceAbove));
      top = Math.max(12, rect.top - maxHeight - 6);
    }

    let left = align === 'right' ? rect.right - menuWidth : rect.left;

    // Viewport clamping (guarantee menu stays strictly within screen)
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setCoords({ top, left, width: menuWidth, maxHeight, placement });
  }, [fullWidth, align]);

  // Click outside and keydown listeners
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchable && searchInputRef.current) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen, isSearchable]);

  // Size specific styles
  const sizeClasses = {
    sm: 'text-xs py-1.5 px-3 rounded-xl gap-2 min-h-[34px]',
    md: 'text-xs sm:text-sm py-2 px-3.5 rounded-xl gap-2.5 min-h-[40px]',
    lg: 'text-sm py-2.5 px-4 rounded-2xl gap-3 min-h-[46px]',
  }[size];

  // Variant specific styles
  const variantClasses = {
    default: 'bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 text-slate-800',
    filter: 'bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 text-slate-700 font-medium',
    ghost: 'bg-transparent border border-transparent hover:bg-slate-100 text-slate-700 font-medium',
  }[variant];

  return (
    <div
      ref={triggerRef}
      className={`relative text-left font-['Inter',sans-serif] ${fullWidth ? 'w-full' : 'inline-block'} ${className}`}
    >
      {label && (
        <label className="block text-[11.5px] font-bold text-slate-700 mb-1">
          {label} {required && <span className="text-[#F95716]">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      {customTrigger ? (
        <div onClick={() => !disabled && setIsOpen((prev) => !prev)}>
          {customTrigger(selectedOption, isOpen)}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={`flex items-center justify-between w-full transition-all cursor-pointer select-none ${sizeClasses} ${variantClasses} ${
            isOpen ? 'border-[#F95716] ring-2 ring-orange-500/15' : ''
          } ${error ? 'border-rose-400 focus:ring-rose-200' : ''} ${
            disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''
          } ${triggerClassName}`}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            {prefix && <span className="text-slate-400 shrink-0">{prefix}</span>}
            {leadingIcon && <span className="text-slate-400 shrink-0">{leadingIcon}</span>}

            {selectedOption ? (
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                {selectedOption.icon && (
                  <span className="shrink-0">{selectedOption.icon}</span>
                )}
                {selectedOption.colorDot && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: selectedOption.colorDot }}
                  />
                )}
                <span className="font-semibold text-slate-900 truncate block">
                  {selectedOption.label}
                </span>
              </div>
            ) : (
              <span className="text-slate-400 truncate">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
            {clearable && selectedOption && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="Clear selection"
              >
                <X className="w-3 h-3" />
              </span>
            )}

            {selectedOption?.badge && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-orange-500/10 text-[#F95716] whitespace-nowrap">
                {selectedOption.badge}
              </span>
            )}

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#F95716]' : ''
              }`}
            />
          </div>
        </button>
      )}

      {/* Floating Menu Popover (Portaled to document.body with z-[99999] so it's always on top of headers) */}
      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: `${coords.maxHeight}px`,
            zIndex: 99999,
          }}
          className={`bg-white rounded-2xl border border-slate-200/90 shadow-[0_18px_44px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Box */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#F95716] focus:border-[#F95716]"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar min-h-0">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === stringVal;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50 text-[#F95716] font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      {opt.colorDot && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: opt.colorDot }}
                        />
                      )}
                      <div className="min-w-0">
                        <span className="block truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-[10px] text-slate-400 font-normal block truncate">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.badge && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-md bg-slate-100 text-slate-600">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#F95716] stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Helper text / error */}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-rose-500">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-slate-400">{helperText}</p>
      ) : null}
    </div>
  );
};

// =========================================================================
// CUSTOM CHECKBOX / MULTI-TOGGLE DROPDOWN (e.g. Columns, Multi-filters)
// =========================================================================

export interface CheckboxDropdownItem {
  id: string;
  label: string;
  checked: boolean;
  icon?: React.ReactNode;
}

export interface CustomCheckboxDropdownProps {
  label: string;
  title?: string;
  icon?: React.ReactNode;
  items: CheckboxDropdownItem[];
  onToggle: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  className?: string;
  badge?: string | number;
}

export const CustomCheckboxDropdown: React.FC<CustomCheckboxDropdownProps> = ({
  label,
  title = 'Toggle Options',
  icon,
  items,
  onToggle,
  onSelectAll,
  onDeselectAll,
  size = 'sm',
  align = 'right',
  className = '',
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
      setIsOpen(false);
      return;
    }

    const menuWidth = 220;
    const estimatedHeight = Math.min(300, items.length * 36 + 48);

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 6;
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }

    let left = align === 'right' ? rect.right - menuWidth : rect.left;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setCoords({ top, left });
  }, [items.length, align]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const sizeClasses = size === 'sm' ? 'text-xs py-1.5 px-3 rounded-xl' : 'text-xs sm:text-sm py-2 px-3.5 rounded-xl';

  return (
    <div ref={triggerRef} className={`relative inline-block text-left font-['Inter',sans-serif] ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-700 font-medium hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer select-none ${sizeClasses} ${
          isOpen ? 'border-[#F95716] ring-2 ring-orange-500/15' : ''
        }`}
      >
        {icon}
        <span>{label}</span>
        {badge !== undefined && (
          <span className="px-1.5 py-0.2 rounded-full bg-orange-50 text-[#F95716] text-[10px] font-bold">
            {badge}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#F95716]' : ''}`}
        />
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999,
          }}
          className="w-56 bg-white rounded-2xl shadow-[0_18px_44px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06)] border border-slate-200/90 p-2 text-xs animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {title}
            </span>
            {(onSelectAll || onDeselectAll) && (
              <div className="flex items-center gap-2 text-[10px] text-[#F95716] font-semibold">
                {onSelectAll && (
                  <button type="button" onClick={onSelectAll} className="hover:underline cursor-pointer">
                    All
                  </button>
                )}
                {onDeselectAll && (
                  <button type="button" onClick={onDeselectAll} className="hover:underline cursor-pointer">
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-0.5 max-h-56 overflow-y-auto custom-scrollbar">
            {items.map((item) => (
              <label
                key={item.id}
                onClick={() => onToggle(item.id)}
                className="flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer text-slate-700 select-none transition-colors"
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="font-medium text-xs text-slate-800">{item.label}</span>
                </div>
                <div
                  className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors ${
                    item.checked ? 'bg-[#F95716] text-white' : 'border border-slate-300 bg-white'
                  }`}
                >
                  {item.checked && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// =========================================================================
// CUSTOM ACTION MENU DROPDOWN (e.g. "..." table row menu, card options)
// =========================================================================

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
}

export interface CustomActionDropdownProps {
  items: ActionMenuItem[];
  trigger?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  title?: string;
}

export const CustomActionDropdown: React.FC<CustomActionDropdownProps> = ({
  items,
  trigger,
  align = 'right',
  className = '',
  title,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    // Close if scrolled out of window
    if (rect.bottom < -20 || rect.top > window.innerHeight + 20) {
      setIsOpen(false);
      return;
    }

    const menuWidth = 195;
    const estimatedHeight = items.length * 36 + (title ? 32 : 0) + 16;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 6;

    // Flip above trigger if not enough space below
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }

    let left = align === 'right' ? rect.right - menuWidth : rect.left;

    // Viewport clamping
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    setCoords({ top, left });
  }, [items.length, title, align]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-block text-left font-['Inter',sans-serif] ${className}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
      >
        {trigger}
      </div>

      {isOpen && coords && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 99999,
          }}
          className="min-w-[195px] bg-white rounded-2xl shadow-[0_18px_44px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06)] border border-slate-200/90 p-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
              {title}
            </div>
          )}

          <div className="space-y-0.5">
            {items.map((item) => (
              <React.Fragment key={item.id}>
                {item.dividerBefore && <div className="h-px bg-slate-100 my-1" />}
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    item.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                    item.danger
                      ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                  } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {item.icon && (
                    <span className={item.danger ? 'text-rose-500' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
