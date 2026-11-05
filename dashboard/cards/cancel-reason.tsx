import type { CancelEntry } from '@/status/cancel-log';
import { orgName } from '@/status/settings';

export function CancelReason({ entry }: { entry: CancelEntry }) {
  const cause = entry.cause;
  return (
    <span className="small">
      {entry.words}
      {cause?.url && (
        <>
          {' '}
          ·{' '}
          <a href={cause.url} target="_blank" rel="noreferrer">
            #{cause.runId}
          </a>
        </>
      )}
      {cause?.sha && (
        <>
          {' '}
          ·{' '}
          <a href={`https://github.com/${orgName}/${entry.repo}/commit/${cause.sha}`} target="_blank" rel="noreferrer">
            {cause.sha.slice(0, 7)}
          </a>
        </>
      )}
      {cause?.pullRequests?.map((pr) => (
        <span key={pr.number}>
          {' '}
          ·{' '}
          <a href={pr.url} target="_blank" rel="noreferrer">
            PR #{pr.number}
          </a>
        </span>
      ))}
      {entry.outcome && <> · {entry.outcome}</>}
    </span>
  );
}
