import type { NotificationSeverity } from '@kniho-hlod/domain';

export interface SeverityStyle {
  color: 'info' | 'warning' | 'error';
  icon: string;
  /** The icon's colour outside an alert; spelled out so Tailwind generates it. */
  iconClass: string;
}

/** How an announcement of each severity looks — in the banner and in the administration alike. */
export const SEVERITY_STYLES: Record<NotificationSeverity, SeverityStyle> = {
  info: { color: 'info', icon: 'i-lucide-info', iconClass: 'text-info' },
  warning: { color: 'warning', icon: 'i-lucide-triangle-alert', iconClass: 'text-warning' },
  critical: { color: 'error', icon: 'i-lucide-octagon-alert', iconClass: 'text-error' },
};
