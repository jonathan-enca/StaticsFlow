/** Simple class name helper — replace with clsx/cn if needed */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
