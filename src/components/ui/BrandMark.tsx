/** Brand-only vector mask. Text beside the mark supplies its accessible name. */
export default function BrandMark({ className = '' }: { className?: string }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true" />
}
