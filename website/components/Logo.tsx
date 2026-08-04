export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="16" cy="16" r="13.5" stroke="#FFFFFF" strokeWidth="1.6" />
      <path
        d="M4 16H11.5L14 8L18 22L20.5 16H28"
        stroke="#FF5722"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
