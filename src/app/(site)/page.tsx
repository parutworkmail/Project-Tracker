import { HeroActions } from "@/components/hero-actions";

const FEATURES = [
  {
    title: "A space per project",
    text: "Every project gets its own link, its own members and its own isolated data.",
    icon: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    tint: "from-blue-600 to-blue-800",
    iconColor: "text-white",
  },
  {
    title: "Tasks that flow",
    text: "Priorities, due dates, assignees and comments, with search and filters to keep up.",
    icon: "M5 12l4 4L19 6",
    tint: "from-teal-500 to-teal-700",
    iconColor: "text-white",
  },
  {
    title: "Roles you control",
    text: "Super admins, project admins and members, each with exactly the access they need.",
    icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    tint: "from-yellow-300 to-yellow-400",
    iconColor: "text-slate-900",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      <div
        aria-hidden="true"
        className="animate-float pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-yellow-300/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="animate-float-slow pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-blue-500/12 blur-3xl"
      />

      <main className="relative flex w-full max-w-5xl flex-col items-center gap-10 px-6 py-20 text-center">
        <h1
          className="animate-fade-up text-5xl font-semibold tracking-tight sm:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Project Tracker
          <span className="gradient-text block pb-2">built for teams.</span>
        </h1>

        <p
          className="animate-fade-up max-w-xl text-lg text-muted"
          style={{ animationDelay: "160ms" }}
        >
          A JIRA-like project tracker. Create a project, share the link, and
          track issues with your team.
        </p>

        <div
          className="animate-fade-up flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "240ms" }}
        >
          <HeroActions />
        </div>

        <ul className="mt-6 grid w-full gap-4 text-left sm:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <li
              key={feature.title}
              className="surface card-lift animate-fade-up rounded-2xl p-6"
              style={{ animationDelay: `${340 + index * 90}ms` }}
            >
              <span
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-md ${feature.iconColor} ${feature.tint}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={feature.icon} />
                </svg>
              </span>
              <h2 className="font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted">{feature.text}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
