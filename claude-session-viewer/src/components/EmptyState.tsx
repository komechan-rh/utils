export function EmptyState() {
  return (
    <div className="empty-state" data-testid="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        ○
      </div>
      <div className="empty-state-title">起動中の Claude Code セッションはありません</div>
      <div className="empty-state-hint">
        ターミナルで `claude` を起動するとここに表示されます。表示されない場合は Settings から hooks
        連携をセットアップしてください。
      </div>
    </div>
  );
}
