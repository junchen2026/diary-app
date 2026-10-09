import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export function ResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/reset-password', { userName });
      setSubmitted(true);
    } catch (err) {
      setError(err.data?.errorZh || err.message);
    }
  };

  return (
    <div className="page">
      <form className="card" onSubmit={handleSubmit}>
        <h2>{t('forgotPassword')}</h2>
        {!submitted ? (
          <>
            <label>{t('userName')}<input value={userName} onChange={(e) => setUserName(e.target.value)} required /></label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary">{t('submit') || '提交'}</button>
          </>
        ) : (
          <p style={{ color: '#2e7d32', fontWeight: 'bold' }}>{t('resetSubmitted') || '已经提交给管理员'}</p>
        )}
        <Link to="/login">{t('back')}</Link>
      </form>
    </div>
  );
}
