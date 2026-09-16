import Link from "next/link";

/** Centred card used by every sign-in / join screen. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="sheet-in w-full max-w-[22rem]">
        <div className="mb-7 text-center">
          <h1 className="large-title">{title}</h1>
          {subtitle ? <p className="secondary mt-2 text-[15px]">{subtitle}</p> : null}
        </div>

        {children}

        <div className="footnote mt-8 text-center">
          {footer ?? (
            <Link href="/" style={{ color: "var(--accent)" }}>
              Back to the journal
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
