import {
  LABEL_STYLES,
  type IssueLabelView,
} from "@/lib/issueMeta";

export function LabelChip({
  label,
  className = "",
}: {
  label: IssueLabelView;
  className?: string;
}) {
  return (
    <span
      title={label.name}
      className={`inline-flex max-w-[10rem] items-center truncate rounded-full px-2 py-0.5 text-xs font-medium ${LABEL_STYLES[label.color] ?? LABEL_STYLES.gray} ${className}`}
    >
      <span className="truncate">{label.name}</span>
    </span>
  );
}
