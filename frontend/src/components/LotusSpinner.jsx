import { useLanguage } from '../context/LanguageContext';

/**
 * 5-petal lotus loading spinner with slow rotation.
 * Use during database read/write operations.
 */
export function LotusSpinner({ size = 80, label }) {
  const { t } = useLanguage();
  const text = label || t('loading') || 'Loading...';

  // 5 petals at 72° intervals
  const petals = [0, 1, 2, 3, 4];

  return (
    <div className="lotus-spinner-wrap" role="status" aria-live="polite">
      <div
        className="lotus-spinner"
        style={{ width: size, height: size }}
      >
        {petals.map((i) => (
          <span
            key={i}
            className="lotus-petal"
            style={{ transform: `translate(-50%, -100%) rotate(${i * 72}deg)` }}
          />
        ))}
        <span className="lotus-center" />
      </div>
      <p className="lotus-label">{text}</p>
    </div>
  );
}
