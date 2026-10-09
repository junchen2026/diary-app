import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LotusSpinner } from '../components/LotusSpinner';
import { LanguageToggle } from '../components/LanguageToggle';

const DEFAULT_STATS = {
  goal: 10_000_000,
  sumCountTotal: 0,
  sumCountToday: 0,
  sumEntryToday: 0,
  progress: 0,
};

export function CountPage() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(DEFAULT_STATS);
  const [entries, setEntries] = useState([]);
  const [dailyCount, setDailyCount] = useState('');
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const dailyCountRef = useRef('');
  const autoSubmitRef = useRef(false);

  const refreshAll = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const [statsRes, entriesRes] = await Promise.all([
        api.get('/count/stats'),
        api.get('/count/entries'),
      ]);
      setStats(statsRes);
      setEntries(entriesRes.entries || []);
    } finally {
      setEntriesLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await api.get('/count/settings');
      setAutoSubmit(settings.autoSubmit);
      if (settings.dailyCount > 0 && dailyCount === '') {
        setDailyCount(String(settings.dailyCount));
      }
    } catch {
      // ignore — settings may not exist yet
    }
  }, [dailyCount]);

  useEffect(() => {
    refreshAll().catch((err) => setError(err.data?.errorZh || err.message));
    loadSettings();
  }, [refreshAll, loadSettings]);

  // Auto-refresh entries + stats every 60 seconds (so new submissions from other users appear)
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshAll().catch(() => {});
    }, 60_000);
    return () => clearInterval(intervalId);
  }, [refreshAll]);

  const handleManualSubmit = async () => {
    setError('');
    setSuccess('');
    const n = Number(dailyCount);
    if (!Number.isInteger(n) || n < 1 || n > 1080) {
      setError(n > 1080 || n < 1 ? t('countOutOfRange') : t('countInvalid'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/count/submit', { dailyCount: n, autoSubmit });
      setStats(res.stats || DEFAULT_STATS);
      setSuccess(t('countSubmitted'));
      // Refresh entries list
      const entriesRes = await api.get('/count/entries');
      setEntries(entriesRes.entries || []);
    } catch (err) {
      setError(err.data?.errorZh || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Persist (debounced) whenever the user types a new daily count.
  // This ensures the auto-submit scheduler at 2 AM uses the latest value,
  // even if the user never re-toggles the checkbox.
  const persistSettingsDebounceRef = useRef(null);
  const persistSettings = useCallback((nextAutoSubmit, nextDailyCount) => {
    if (persistSettingsDebounceRef.current) {
      clearTimeout(persistSettingsDebounceRef.current);
    }
    persistSettingsDebounceRef.current = setTimeout(async () => {
      const payload = {
        autoSubmit: nextAutoSubmit,
        dailyCount: Number.isInteger(nextDailyCount) && nextDailyCount > 0 ? nextDailyCount : 0
      };
      try {
        await api.put('/count/settings', payload);
      } catch (err) {
        // Soft-fail: don't disturb the UI on background sync
        console.warn('[count] settings sync failed:', err.message);
      }
    }, 600);
  }, []);

  const handleDailyCountChange = (raw) => {
    // Strip non-digit characters and clamp to 1080.
    // If the user input had anything other than digits, show a notice.
    const digitsOnly = String(raw ?? '').replace(/[^\d]/g, '');
    const hadInvalid = digitsOnly !== String(raw ?? '');
    let value = digitsOnly;
    if (value.length > 1) {
      // Collapse leading zeros (e.g. "00500" -> "500")
      value = value.replace(/^0+/, '') || '0';
    }
    let n = value === '' ? NaN : parseInt(value, 10);
    let notice = null;
    if (hadInvalid && !Number.isNaN(n)) {
      notice = t('countInvalidChar').replace('{value}', String(n));
    }
    // Clamp to [1, 1080] once we have a real number
    if (Number.isInteger(n)) {
      if (n < 1) {
        n = 1;
        notice = notice || t('countOutOfRange');
      } else if (n > 1080) {
        n = 1080;
        notice = notice || t('countOutOfRange');
      }
    }
    const displayValue = Number.isInteger(n) ? String(n) : '';
    setDailyCount(displayValue);
    dailyCountRef.current = displayValue;
    if (notice) setSuccess(notice);
    // Sync to backend so midnight auto-submit uses the latest value
    persistSettings(autoSubmitRef.current, n);
  };

  const handleAutoSubmitToggle = async (checked) => {
    setAutoSubmit(checked);
    autoSubmitRef.current = checked;
    setError('');
    setSuccess('');
    // Persist the auto-submit preference immediately.
    // If dailyCount is set, include it; otherwise keep existing settings.daily_count.
    const n = Number(dailyCount);
    const payload = { autoSubmit: checked, dailyCount: Number.isInteger(n) && n > 0 ? n : 0 };
    try {
      await api.put('/count/settings', payload);
    } catch (err) {
      setError(err.data?.errorZh || err.message);
      // Revert on failure
      setAutoSubmit(!checked);
      autoSubmitRef.current = !checked;
    }
  };

  // Keep refs in sync with state for the debounced persistSettings
  useEffect(() => { dailyCountRef.current = dailyCount; }, [dailyCount]);
  useEffect(() => { autoSubmitRef.current = autoSubmit; }, [autoSubmit]);

  const handleGoDiary = () => {
    localStorage.setItem('loginMode', 'diary');
    if (user?.role === 'SUPER_ADMIN') navigate('/super');
    else if (user?.role === 'SYS_ADMIN') navigate('/sys');
    else navigate('/home');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const progressPct = Math.max(0, Math.min(100, stats.progress));
  const progressDisplay = `${stats.sumCountTotal.toLocaleString()} / ${stats.goal.toLocaleString()} (${progressPct.toFixed(2)}%)`;

  return (
    <div className="page count-page">
      <header className="top-bar">
        <div className="count-header-col">
          <img src="Logo400x80.png" alt="Logo" className="count-logo" />
          <h1 className="count-title">{t('countTitle')}</h1>
        </div>
        <div className="count-nav">
          <LanguageToggle />
          <button className="btn-secondary" onClick={() => navigate('/account')}>
            {t('countProfile')}
          </button>
          <button className="btn-secondary" onClick={handleGoDiary}>{t('countGoDiary')}</button>
          <button className="btn-secondary danger" onClick={handleLogout}>{t('logout')}</button>
        </div>
      </header>

      <div className="card">
        {/* Stats section */}
        <div className="count-stats">
          <div className="count-stat">
            <div className="stat-label">{t('countTotalCompleted')}</div>
            <div className="stat-value">{stats.sumCountTotal.toLocaleString()}</div>
          </div>
          <div className="count-stat">
            <div className="stat-label">{t('countReportedToday')}</div>
            <div className="stat-value">{stats.sumCountToday.toLocaleString()}</div>
            <div className="stat-sub">{t('countEntriesToday')}: {stats.sumEntryToday}</div>
          </div>
          <div className="count-stat">
            <div className="stat-label">{t('countGoal')}</div>
            <div className="stat-value">{stats.goal.toLocaleString()}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-wrap" role="progressbar" aria-valuenow={progressPct} aria-valuemin="0" aria-valuemax="100">
          <div className="progress-bar" style={{ width: `${progressPct}%` }}></div>
          <div className="progress-label">{progressDisplay}</div>
        </div>

        {/* Input row: daily count + manual submit + auto submit */}
        <div className="count-input-row">
          <label>{t('countTodayInput')}</label>
          <input
            type="number"
            min="1"
            step="1"
            value={dailyCount}
            onChange={(e) => handleDailyCountChange(e.target.value)}
            placeholder="0"
          />
          <button type="button" className="btn-primary" onClick={handleManualSubmit} disabled={loading}>
            {t('countManualSubmit')}
          </button>
          <label className="auto-submit-label">
            <input
              type="checkbox"
              checked={autoSubmit}
              onChange={(e) => handleAutoSubmitToggle(e.target.checked)}
            />
            {t('countAutoSubmit')}
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p className="count-success">{success}</p>}
        {loading && <LotusSpinner size={70} />}

        {/* Entries table */}
        {entriesLoading && entries.length === 0 ? (
          <LotusSpinner size={80} />
        ) : (
        <table className="count-table">
          <thead>
            <tr>
              <th>{t('countTableUsername')}</th>
              <th>{t('countTableTodayCount')}</th>
              <th>{t('countTableTotalCount')}</th>
              <th>{t('countTableFirstDate')}</th>
              <th>{t('countTableSubmitTime')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="count-empty">{t('countNoEntries')}</td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className={e.autoSubmit ? 'auto-row' : ''}>
                  <td>{e.displayName || e.userName}</td>
                  <td>{e.dailyCount}</td>
                  <td>{e.totalCount}</td>
                  <td>{e.firstCountDate}</td>
                  <td>{e.submitTime}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}