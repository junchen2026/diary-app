import { useState } from 'react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { LotusSpinner } from './LotusSpinner';

/**
 * Translation buttons block — renders two buttons below a content/comment block:
 *   - 翻译   : translate from English to 繁體中文
 *   - Translate: translate from 繁體中文 to English
 *
 * Props:
 *   html: string  — HTML content to translate (plain text is extracted)
 */
export function TranslateButtons({ html }) {
  const { t } = useLanguage();
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!html) return null;

  // Extract plain text from HTML for translation
  const plainText = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  if (!plainText) return null;

  const doTranslate = async (direction) => {
    setError('');
    setResult('');
    setLoading(true);
    try {
      const res = await api.post('/translate', { text: plainText, direction });
      setResult(res.translation || '');
    } catch (err) {
      setError(err.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="translate-block">
      <div className="translate-buttons">
        <button className="btn-primary" onClick={() => doTranslate('to-zh')} disabled={loading}>
          {t('translateToZh') || '翻译'}
        </button>
        <button className="btn-primary" onClick={() => doTranslate('to-en')} disabled={loading}>
          {t('translateToEn') || 'Translate'}
        </button>
      </div>
      {loading && <LotusSpinner size={40} />}
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="translate-result">{result}</div>
      )}
    </div>
  );
}
