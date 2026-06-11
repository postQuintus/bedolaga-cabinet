// ──────────────────────────────────────────────────────────────────
// TrafficIcons — the icon set used across AdminTrafficUsage (header
// controls, filter buttons, sort indicator, etc.). The glyphs now come
// from the central Phosphor barrel (`@/components/icons`); only the
// sort indicator keeps its custom `direction` prop and is therefore a
// thin local wrapper over the panel's Phosphor caret icons.
// ──────────────────────────────────────────────────────────────────

import { ChevronDownIcon, ChevronExpandIcon, ChevronUpIcon } from '@/components/icons';

export {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilterIcon,
  GlobeIcon,
  RefreshIcon,
  SearchIcon,
  ServerIcon,
  ServerSmallIcon,
  ShieldIcon,
  StatusIcon,
  XIcon,
} from '@/components/icons';

export const SortIcon = ({ direction }: { direction: false | 'asc' | 'desc' }) =>
  direction === 'asc' ? (
    <ChevronUpIcon className="ml-1 inline h-3 w-3" />
  ) : direction === 'desc' ? (
    <ChevronDownIcon className="ml-1 inline h-3 w-3" />
  ) : (
    <ChevronExpandIcon className="ml-1 inline h-3 w-3" />
  );
