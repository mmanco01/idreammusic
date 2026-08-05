import type { ReactNode } from "react";

type Props = {
  title: string;
  description: ReactNode;
  children: ReactNode;
  eyebrow?: string;
  className?: string;
};

export function RecommendedNextAction({
  title,
  description,
  children,
  eyebrow = "Recommended next step",
  className = "",
}: Props) {
  return (
    <section className={`recommended-action${className ? ` ${className}` : ""}`}>
      <div className="recommended-action__eyebrow">{eyebrow}</div>
      <h3 className="recommended-action__title">{title}</h3>
      <div className="recommended-action__description">{description}</div>
      <div className="recommended-action__controls">{children}</div>
    </section>
  );
}
