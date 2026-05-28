/** Head silhouette with curved orbit arrows — auto-rotate control. */
export default function AutoRotateHeadIcon({
  size = 15,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Orbiting rotation arrows */}
      <path d="M4.6 10.1a8.4 8.4 0 0 1 14.8-1.6" />
      <path d="M17.9 7l1.7 1.1-2.2 1.2" />
      <path d="M19.4 13.9a8.4 8.4 0 0 1-14.8 1.6" />
      <path d="M6.1 17l-1.7-1.1 2.2-1.2" />
      {/* Head */}
      <ellipse cx="12" cy="10.6" rx="3.1" ry="4.05" />
      <path d="M9.35 14.35c.85 1.15 1.75 1.75 2.65 1.75s1.8-.6 2.65-1.75" />
    </svg>
  );
}
