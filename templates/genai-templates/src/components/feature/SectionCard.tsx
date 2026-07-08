import type { PropsWithChildren } from 'react';

export function SectionCard({ children }: PropsWithChildren) {
  return (
    <section className="rounded-3xl border border-black/8 bg-white/92 p-6 shadow-[0_16px_32px_rgba(17,28,45,0.06)]">
      {children}
    </section>
  );
}
