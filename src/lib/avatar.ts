const GRADIENTS = [
  ["#1f3a5f", "#2f5d8a"],
  ["#0f766e", "#14917f"],
  ["#8a5210", "#b06f1a"],
  ["#7c4a2d", "#a8663b"],
  ["#3f6212", "#5f8a1c"],
  ["#334e68", "#486581"],
  ["#8a3b2e", "#b4533f"],
  ["#155e75", "#2a86a0"],
] as const;

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }
  return value;
}

export function gradientFor(seed: string): string {
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}
