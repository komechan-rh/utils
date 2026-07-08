import { useState } from 'react';

import { SectionCard } from '@/components/feature/SectionCard';
import { Button } from '@/components/ui/Button';
import { SampleCard } from '@/features/sample/SampleCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { appConfig } from '@/lib/env';

export function HomePage() {
  const [message, setMessage] = useState('まだアクションは実行されていません。');

  useDocumentTitle(`${appConfig.appName} | Home`);

  return (
    <div className="grid gap-5">
      <SectionCard>
        <p className="m-0 font-bold text-brand-500">Home</p>
        <h2 className="mb-3 text-[clamp(1.5rem,4vw,2.3rem)] font-semibold">
          AI と人が追いやすい最小構成
        </h2>
        <p className="mt-0 text-ink-700">
          ルーティング、共通 UI、機能単位ディレクトリ、テスト基盤を最小サイズで揃えています。
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setMessage('サンプルアクションを実行しました。')}>
            Try action
          </Button>
          <Button
            variant="secondary"
            onClick={() => setMessage('まだアクションは実行されていません。')}
          >
            Reset
          </Button>
        </div>
        <p aria-live="polite" className="mb-0 font-semibold">
          {message}
        </p>
      </SectionCard>

      <SectionCard>
        <SampleCard onAction={() => setMessage('features/sample からアクションを実行しました。')} />
      </SectionCard>
    </div>
  );
}
