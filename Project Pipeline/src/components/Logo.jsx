/**
 * Logo Pipelio sebagai SVG inline.
 *
 * Sebelumnya di-hardcode ke https://media.base44.com/... — laporan yang dicetak
 * akan kehilangan logo bila offline atau bila aset itu dihapus dari CDN.
 */
export default function Logo({ className = "w-8 h-8", title = "Pipelio" }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={className}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      {/* Tiga batang menaik — pipeline yang bergerak menuju closing */}
      <rect x="8" y="19" width="4" height="6" rx="1.5" fill="#fff" opacity="0.55" />
      <rect x="14" y="14" width="4" height="11" rx="1.5" fill="#fff" opacity="0.8" />
      <rect x="20" y="8" width="4" height="17" rx="1.5" fill="#fff" />
    </svg>
  );
}
