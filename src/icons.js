import React from 'react';

const createIcon = (children) =>
  React.forwardRef(function Icon(props, ref) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  });

export const FileDown = createIcon(
  <>
    <path d="M14 2H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9z" />
    <polyline points="14 2 14 9 21 9" />
    <path d="M12 12v6" />
    <path d="M9.5 15.5 12 18l2.5-2.5" />
  </>
);

export const PlusCircle = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </>
);

export const Trash2 = createIcon(
  <>
    <path d="M5 7h14" />
    <path d="M9 4h6l1 3H8z" />
    <path d="M18 7v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </>
);

export const ArrowRight = createIcon(
  <>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="15 7 20 12 15 17" />
  </>
);

export const ArrowLeft = createIcon(
  <>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="9 7 4 12 9 17" />
  </>
);

export const Info = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="10" x2="12" y2="16" />
    <line x1="12" y1="7" x2="12" y2="7" />
  </>
);

export const Loader = createIcon(
  <>
    <circle cx="12" cy="12" r="9" strokeDasharray="56" strokeDashoffset="28" />
  </>
);

export const XCircle = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </>
);

export const User = createIcon(
  <>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19c1.8-3 4.2-4.5 7-4.5s5.2 1.5 7 4.5" />
  </>
);

export const Briefcase = createIcon(
  <>
    <rect x="4" y="8" width="16" height="11" rx="2" />
    <path d="M9 8V6a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v2" />
    <path d="M4 12h16" />
    <path d="M10 12v2" />
    <path d="M14 12v2" />
  </>
);

export const Stethoscope = createIcon(
  <>
    <path d="M6 3v5a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V3" />
    <path d="M6 8c0 5 3 9 6 9s6-4 6-9" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M12 17v3a2 2 0 0 0 2 2h1.5" />
  </>
);

export const AlertTriangle = createIcon(
  <>
    <path d="M12 3 2.5 19a1 1 0 0 0 .85 1.5h17.3a1 1 0 0 0 .85-1.5L12 3z" />
    <line x1="12" y1="9" x2="12" y2="14" />
    <circle cx="12" cy="17" r="1" />
  </>
);

export const Users = createIcon(
  <>
    <circle cx="8" cy="9" r="3.5" />
    <circle cx="16" cy="11" r="3" />
    <path d="M2 19c1.5-3 3.8-4.5 6-4.5s4.5 1.5 6 4.5" />
    <path d="M12 19c1.2-2.4 2.7-3.5 4.5-3.5S20.8 16.6 22 19" />
  </>
);

export const ChevronDown = createIcon(
  <polyline points="6 9 12 15 18 9" />
);

export const ChevronUp = createIcon(
  <polyline points="6 15 12 9 18 15" />
);

export const ShieldCheck = createIcon(
  <>
    <path d="M12 3 5 6v5c0 5.5 3.5 9 7 10 3.5-1 7-4.5 7-10V6l-7-3z" />
    <polyline points="9 12 11.5 14.5 16 10" />
  </>
);

export const TrendingUp = createIcon(
  <>
    <polyline points="3 17 9 11 13 15 21 7" />
    <polyline points="21 13 21 7 15 7" />
  </>
);

export const TrendingDown = createIcon(
  <>
    <polyline points="3 7 9 13 13 9 21 17" />
    <polyline points="21 11 21 17 15 17" />
  </>
);

export const Wallet = createIcon(
  <>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h10" />
    <circle cx="17" cy="12.5" r="1.5" />
  </>
);
