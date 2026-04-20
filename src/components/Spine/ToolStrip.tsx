import { getToolById } from '@/utils';
import styles from './Spine.module.css';

interface Props {
  toolIds: string[];
  max?: number;
}

export function ToolStrip({ toolIds, max = 3 }: Props) {
  const tools = toolIds
    .map((id) => getToolById(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const visible = tools.slice(0, max);
  const extra = tools.length - visible.length;

  return (
    <span className={styles.toolStrip}>
      {visible.map((tool) => (
        <span key={tool.id} className={styles.toolChip} title={tool.name}>
          {tool.logoUrl ? (
            <img src={tool.logoUrl} alt={tool.name} className={styles.toolLogo} />
          ) : (
            <span className={styles.toolInitial}>{tool.name.slice(0, 2)}</span>
          )}
        </span>
      ))}
      {extra > 0 && <span className={styles.toolExtra}>+{extra}</span>}
    </span>
  );
}
