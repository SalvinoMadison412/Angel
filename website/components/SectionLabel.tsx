export default function SectionLabel({
  index,
  children,
  light = false,
}: {
  index?: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest2 ${
        light ? "text-bg/60" : "text-accent"
      }`}
    >
      <span className="h-px w-6 bg-current opacity-60" />
      <span>
        {index ? `[ ${index} ] ` : "// "}
        {children}
      </span>
    </div>
  );
}
