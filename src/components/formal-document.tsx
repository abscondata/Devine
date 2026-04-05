import Link from "next/link";

type DocumentAction = {
  href: string;
  label: string;
};

export function FormalDocumentLayout({
  backLink,
  documentType,
  title,
  description,
  recordDate,
  actions,
  children,
}: {
  backLink?: DocumentAction;
  documentType: string;
  title: string;
  description?: string | null;
  recordDate?: string | null;
  actions?: DocumentAction[];
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: #fff !important; color: #111 !important; }
        }
      `}</style>
      <div className="space-y-10">
        <header className="space-y-3">
          {backLink ? (
            <Link
              href={backLink.href}
              className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] no-print"
            >
              {backLink.label}
            </Link>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              {documentType}
            </p>
            <h1 className="text-3xl font-semibold">{title}</h1>
            {description ? (
              <p className="text-sm text-[var(--muted)]">{description}</p>
            ) : null}
            {recordDate ? (
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Record date {recordDate}
              </p>
            ) : null}
          </div>
          {actions && actions.length ? (
            <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)] no-print">
              {actions.map((action) => (
                <Link key={action.href} href={action.href}>
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </header>
        {children}
      </div>
    </>
  );
}

export function DocumentSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
