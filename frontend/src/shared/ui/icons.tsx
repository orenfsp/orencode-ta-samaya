import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function createIcon(name: string, children: ReactNode) {
  const Icon = ({ size = 20, ...props }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
  Icon.displayName = `Icon${name}`
  return Icon
}

export const IconChevronDown = createIcon('ChevronDown', <path d="m6 9 6 6 6-6" />)
export const IconChevronUp = createIcon('ChevronUp', <path d="m6 15 6-6 6 6" />)
export const IconChevronLeft = createIcon('ChevronLeft', <path d="m15 6-6 6 6 6" />)
export const IconChevronRight = createIcon('ChevronRight', <path d="m9 6 6 6-6 6" />)
export const IconArrowRight = createIcon('ArrowRight', <path d="M5 12h14m-6-6 6 6-6 6" />)
export const IconArrowUp = createIcon('ArrowUp', <path d="M12 19V5m-6 6 6-6 6 6" />)
export const IconCheck = createIcon('Check', <path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconClose = createIcon('Close', <path d="M6 6l12 12M18 6 6 18" />)
export const IconPlus = createIcon('Plus', <path d="M12 5v14M5 12h14" />)
export const IconMinus = createIcon('Minus', <path d="M5 12h14" />)
export const IconMenu = createIcon('Menu', <path d="M4 7h16M4 12h16M4 17h10" />)
export const IconSearch = createIcon(
  'Search',
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </>,
)
export const IconEye = createIcon(
  'Eye',
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
)
export const IconEyeOff = createIcon(
  'EyeOff',
  <>
    <path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.4M6.6 6.6C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.9-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </>,
)
export const IconDownload = createIcon('Download', <path d="M12 4v11m-5-5 5 5 5-5M5 20h14" />)
export const IconUpload = createIcon('Upload', <path d="M12 16V5m-5 5 5-5 5 5M5 20h14" />)
export const IconExternal = createIcon(
  'External',
  <path d="M14 5h5v5m0-5-8 8M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />,
)
export const IconFile = createIcon(
  'File',
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </>,
)
export const IconCalendar = createIcon(
  'Calendar',
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
)
export const IconMapPin = createIcon(
  'MapPin',
  <>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </>,
)
export const IconBell = createIcon(
  'Bell',
  <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />,
)
export const IconUser = createIcon(
  'User',
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </>,
)
export const IconSettings = createIcon(
  'Settings',
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>,
)
/** Сообщение в мессенджер: Telegram без логотипа бренда */
export const IconSend = createIcon('Send', <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />)
export const IconMail = createIcon(
  'Mail',
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </>,
)
export const IconLogOut = createIcon(
  'LogOut',
  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" />,
)
export const IconInfo = createIcon(
  'Info',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.01" />
  </>,
)
export const IconAlert = createIcon(
  'Alert',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16v.01" />
  </>,
)
export const IconCheckCircle = createIcon(
  'CheckCircle',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.3 2.8 2.7L16 9.5" />
  </>,
)
export const IconInbox = createIcon(
  'Inbox',
  <>
    <path d="M3.5 13.5 6 5.5h12l2.5 8V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
    <path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" />
  </>,
)
export const IconRefresh = createIcon('Refresh', <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />)
/** История действий: часы со стрелкой назад — журнал */
export const IconHistory = createIcon(
  'History',
  <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4M12 8v4l2.5 2.5" />,
)
export const IconGrid = createIcon(
  'Grid',
  <>
    <rect x="4" y="4" width="7" height="7" rx="2" />
    <rect x="13" y="4" width="7" height="7" rx="2" />
    <rect x="4" y="13" width="7" height="7" rx="2" />
    <rect x="13" y="13" width="7" height="7" rx="2" />
  </>,
)
export const IconBook = createIcon(
  'Book',
  <>
    <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z" />
    <path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v3H7.5A2.5 2.5 0 0 1 5 20.5ZM9 7.5h6" />
  </>,
)
export const IconSwap = createIcon('Swap', <path d="M7 4 4 7l3 3M4 7h13M17 14l3 3-3 3M20 17H7" />)
export const IconDots = createIcon(
  'Dots',
  <>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </>,
)
export const IconArchive = createIcon(
  'Archive',
  <>
    <rect x="3.5" y="4" width="17" height="4.5" rx="1.5" />
    <path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4" />
  </>,
)
export const IconTrash = createIcon(
  'Trash',
  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5h6V7" />,
)
export const IconPencil = createIcon('Pencil', <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />)
export const IconTrophy = createIcon(
  'Trophy',
  <>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" />
  </>,
)
export const IconPodium = createIcon('Podium', <path d="M9 20V8h6v12M3 20v-8h6M15 20v-5h6v5M3 20h18" />)
export const IconChart = createIcon('Chart', <path d="M4 4v16h16M8 16v-4M12 16V8M16 16v-6" />)
export const IconImage = createIcon(
  'Image',
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="m4 16 4.5-4.5 4 4 2.5-2.5L20 17.5" />
    <circle cx="15.5" cy="9.5" r="1.5" />
  </>,
)
export const IconSun = createIcon(
  'Sun',
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </>,
)
export const IconMoon = createIcon('Moon', <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />)
/** Щит с галкой — верификация ФСП, в стиле официальной иконки дисциплины ИБ */
export const IconShieldCheck = createIcon(
  'ShieldCheck',
  <>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.7 7 9.5 4.1-1.8 7-5.3 7-9.5V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </>,
)
/** Щит с крестом — в верификации отказано */
export const IconShieldX = createIcon(
  'ShieldX',
  <>
    <path d="M12 3 5 6v5.5c0 4.2 2.9 7.7 7 9.5 4.1-1.8 7-5.3 7-9.5V6z" />
    <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" />
  </>,
)

export const IconFilter = createIcon(
  'Filter',
  <>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </>,
)

export const IconLink = createIcon(
  'Link',
  <>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </>,
)

export const IconText = createIcon(
  'Text',
  <>
    <path d="M5 6h14M5 11h14M5 16h9" />
  </>,
)

export const IconHeading = createIcon(
  'Heading',
  <>
    <path d="M6 5v14M18 5v14M6 12h12" />
  </>,
)
