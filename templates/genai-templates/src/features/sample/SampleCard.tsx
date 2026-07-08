import { Button } from '@/components/ui/Button';

type SampleCardProps = {
  onAction: () => void;
};

export function SampleCard({ onAction }: SampleCardProps) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="m-0 font-bold text-brand-500">Feature Sample</p>
        <h2 className="my-2 text-[1.4rem] font-semibold">機能単位で閉じる実装のサンプル</h2>
        <p className="m-0 text-ink-700">
          `features/sample` に UI
          と振る舞いを寄せることで、将来の機能追加時にも依存関係を追いやすくします。
        </p>
      </div>
      <Button onClick={onAction}>Run sample action</Button>
    </div>
  );
}
