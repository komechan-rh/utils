import { SectionCard } from '@/components/feature/SectionCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { appConfig } from '@/lib/env';

export function AboutPage() {
  useDocumentTitle(`${appConfig.appName} | About`);

  return (
    <SectionCard>
      <p className="m-0 font-bold text-brand-500">About</p>
      <h2 className="text-[clamp(1.5rem,4vw,2rem)] font-semibold">
        このテンプレートが意識していること
      </h2>
      <ul className="m-0 pl-5 text-ink-700">
        <li>責務ごとに入口を固定し、探索コストを下げること</li>
        <li>Tailwind CSS / Biome / Vitest を早い段階で導入すること</li>
        <li>AI エージェントが `tasks/` と `.claude/` を起点に作業しやすいこと</li>
      </ul>
    </SectionCard>
  );
}
