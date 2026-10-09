import { useLanguage } from '../context/LanguageContext';

/**
 * Single-button language toggle.
 * Shows the language to switch TO; click toggles between 中文 and English.
 */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const target = language === '中文' ? 'English' : '中文';
  return (
    <button
      className="lang-toggle"
      onClick={() => setLanguage(target)}
      title={language === '中文' ? 'Switch to English' : '切換到中文'}
    >
      {target}
    </button>
  );
}
