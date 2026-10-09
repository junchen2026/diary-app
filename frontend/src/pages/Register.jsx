import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { Captcha } from '../components/Captcha';

export function Register() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ userName: '', familyName: '', givenName: '', address: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState({ id: '', answer: '' });
  const [error, setError] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError(t('passwordMismatch') || '两次密码输入不同');
      setCaptchaKey(k => k + 1);
      return;
    }
    try {
      await api.post('/auth/register', {
        userName: form.userName,
        familyName: form.familyName,
        givenName: form.givenName,
        address: form.address,
        password: form.password,
      });
      navigate('/login');
    } catch (err) {
      setError(err.data?.errorZh || err.message);
      setCaptchaKey(k => k + 1);
    }
  };

  return (
    <div className="page">
      <form className="card" onSubmit={handleRegister}>
        <h2>{t('register')}</h2>
        <label>{t('userName')}<input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} required /></label>
        <label>{t('familyName') || 'Family Name'}<input value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} /></label>
        <label>{t('givenName') || 'Given Name'}<input value={form.givenName} onChange={(e) => setForm({ ...form, givenName: e.target.value })} /></label>
        <label>{t('address')}<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label>{t('password')}
          <div className="password-input-row" style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(s => !s)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              style={{
                position: 'absolute',
                right: '.4rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '.2rem',
                fontSize: '1.1rem',
                lineHeight: 1,
              }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </label>
        <label>{t('confirmPassword') || '确认新密码'}
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
          />
        </label>
        <Captcha key={captchaKey} onChange={setCaptcha} />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-primary">{t('register')}</button>
        <Link to="/login">{t('back')}</Link>
      </form>
    </div>
  );
}
