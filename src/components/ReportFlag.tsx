import { Flag } from 'lucide-react';

/**
 * The report symbol: a red flag. Used by every report button and in the report window.
 * Pass only the size, e.g. "h-4 w-4".
 */
export default function ReportFlag({ className = 'h-4 w-4' }: { className?: string }) {
  return <Flag className={`${className} shrink-0 text-red-500`} aria-hidden="true" data-testid="report-flag" />;
}
