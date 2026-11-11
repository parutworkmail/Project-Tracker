import { gradientFor, initialsFor } from "@/lib/avatar";

export function Avatar({
  name,
  seed,
  size = 44,
  rounded = "rounded-xl",
}: {
  name: string;
  seed?: string;
  size?: number;
  rounded?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-semibold text-white shadow-md ${rounded}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        backgroundImage: gradientFor(seed ?? name),
      }}
    >
      {initialsFor(name)}
    </span>
  );
}
