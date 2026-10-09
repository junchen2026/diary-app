import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LotusSpinner } from '../components/LotusSpinner';
import { LanguageToggle } from '../components/LanguageToggle';

export function SysAdminHome() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [newUser, setNewUser] = useState({ userName: '', email: '', photo: '', address: '', familyName: '', givenName: '', password: '' });
  const [newUserPassword, setNewUserPassword] = useState('');
  const [docUser, setDocUser] = useState('');
  const [docDate, setDocDate] = useState('');
  const [docResults, setDocResults] = useState([]);
  const [msg, setMsg] = useState('');
  const [pendingUsers, setPendingUsers] = useState([]);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [autoSubmitList, setAutoSubmitList] = useState([]);
  const [showAutoSubmitList, setShowAutoSubmitList] = useState(false);
  const [autoListLoading, setAutoListLoading] = useState(false);

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = () => {
    api.get('/users/pending-reset').then((res) => {
      setPendingUsers(res.users || []);
    }).catch(() => {});
  };

  const loadAutoSubmitList = async () => {
    setAutoListLoading(true);
    try {
      const res = await api.get('/count/auto-submit-list');
      setAutoSubmitList(res.list || []);
      setShowAutoSubmitList(true);
    } catch (err) {
      setMsg('Failed to load auto-submit list: ' + (err.data?.errorZh || err.message));
    } finally {
      setAutoListLoading(false);
    }
  };

  const handleToggleAutoSubmit = async (userName, currentValue) => {
    try {
      await api.put(`/count/admin-settings/${encodeURIComponent(userName)}`, {
        autoSubmit: !currentValue,
      });
      // Update local state without full reload
      setAutoSubmitList((prev) => prev.map((u) =>
        u.userName === userName ? { ...u, autoSubmit: !currentValue } : u
      ));
      setMsg(`✓ ${userName}: ${!currentValue ? 'ON' : 'OFF'}`);
    } catch (err) {
      setMsg('Toggle failed: ' + (err.data?.errorZh || err.message));
    }
  };

  const handleDeleteUserEntries = async (userName) => {
    const confirmed = window.confirm(t('countDeleteConfirm'));
    if (!confirmed) return;
    try {
      const res = await api.delete(`/count/entries/${encodeURIComponent(userName)}`);
      const deleted = res.deleted || 0;
      setMsg(t('countDeleted').replace('{n}', deleted));
      // Update local state: reset totalCount + latestCountDate for this user
      setAutoSubmitList((prev) => prev.map((u) =>
        u.userName === userName ? { ...u, totalCount: 0, latestCountDate: '' } : u
      ));
    } catch (err) {
      setMsg('Delete failed: ' + (err.data?.errorZh || err.message));
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setNewResetPassword(pwd);
  };

  const saveResetPassword = async () => {
    if (!newResetPassword) {
      setMsg('Password is required');
      return;
    }
    try {
      await api.post(`/users/${resetPasswordUser}/set-password`, { password: newResetPassword });
      setMsg(`Password set for ${resetPasswordUser}: ${newResetPassword}`);
      setResetPasswordUser(null);
      setNewResetPassword('');
      loadPendingUsers();
    } catch (err) {
      setMsg('Set password failed: ' + (err.data?.error || err.message));
    }
  };

  const searchUser = async () => {
    if (!searchName.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get('/users/search/' + encodeURIComponent(searchName));
      setSearchResults(res.users.filter(u => u.role === 'NORMAL_USER'));
    } catch {
      setSearchResults([]);
    }
  };

  const goToEditProfile = (u) => {
    navigate('/edit-user-profile', { state: { user: u } });
  };

  const handleDeleteUser = (u) => {
    if (confirm('Delete user ' + u.user_name + '? This will also delete all their documents.')) {
      api.delete('/users/' + u.user_name).then(() => {
        setSearchResults(searchResults.filter(us => us.user_name !== u.user_name));
        setMsg('User ' + u.user_name + ' deleted');
      }).catch(err => {
        setMsg('Delete failed: ' + (err.data?.error || err.message));
      });
    }
  };

  const createNewUser = async () => {
    if (!newUser.userName) {
      setMsg('userName is required');
      return;
    }
    if (!newUser.password) {
      setMsg('password is required');
      return;
    }
    try {
      const res = await api.post('/users/create', newUser);
      setMsg('User created! Password: ' + res.password);
      setNewUserPassword(res.password);
      setNewUser({ userName: '', email: '', photo: '', address: '', familyName: '', givenName: '', password: '' });
    } catch (err) {
      setMsg('Create failed: ' + (err.data?.error || err.message));
    }
  };

  const searchDocs = async () => {
    const params = new URLSearchParams();
    if (docUser) params.set('userName', docUser);
    if (docDate) params.set('date', docDate);
    try {
      const res = await api.get('/documents/admin/search?' + params);
      setDocResults(res.documents);
    } catch (err) {
      setMsg('Search docs failed: ' + (err.data?.error || err.message));
    }
  };

  const deleteDoc = async (id) => {
    if (!confirm('Delete document?')) return;
    try {
      await api.delete('/documents/' + id);
      setDocResults(docResults.filter(d => d.id !== id));
    } catch (err) {
      setMsg('Delete failed: ' + (err.data?.error || err.message));
    }
  };

  return (
    <div className="page admin-page">
      <header className="home-header">
        <h2>{t('userManagement') || 'User Management'} (SYS_ADMIN)</h2>
        <div className="home-header-right">
          <LanguageToggle />
          <button className="btn-secondary" onClick={() => navigate('/count')}>{t('countMode')}</button>
          <div className="user-info" onClick={() => navigate('/account')}>
            <span>{user?.user_name}</span>
          </div>
        </div>
      </header>

      <section className="card">
        <h3>{t('search') || 'Search'} {t('userName') || 'Username'} (fuzzy: ? = single char, * = any)</h3>
        <div className="row">
          <input value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="e.g. user? or *" />
          <button onClick={searchUser}>{t('search') || 'Search'}</button>
        </div>
        {searchResults.length > 0 && (
          <div className="search-results">
            <p>{searchResults.length} result(s)</p>
            {searchResults.map((u) => (
              <div key={u.id} className="search-result-item" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem', borderBottom: '1px solid #eee' }}>
                <span style={{ flex: 1 }}>
                  <strong>{u.user_name}</strong> - <span className="muted">{u.email || '(no email)'}</span>
                  {(u.familyName || u.givenName) && (
                    <span className="muted"> · {u.familyName} {u.givenName}</span>
                  )}
                </span>
                <button className="btn-sm" onClick={() => goToEditProfile(u)}>{t('save') === 'Save' ? 'Edit Profile' : '修改Profile'}</button>
                <button className="btn-sm danger" onClick={() => handleDeleteUser(u)}>{t('delete') || 'Delete'}</button>
              </div>
            ))}
          </div>
        )}
        {searchResults.length === 0 && searchName && <p className="muted">No users found</p>}
      </section>

      <section className="card">
        <h3>{t('addUser') || 'Add NORMAL_USER'}</h3>
        <div className="add-user-form">
          <label>{t('userName') || 'Username'}*: <input value={newUser.userName} onChange={(e) => setNewUser({ ...newUser, userName: e.target.value })} /></label>
          <label>Email: <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label>
          <label>Password*: <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></label>
          <label>{t('familyName') || 'Family Name'}: <input value={newUser.familyName} onChange={(e) => setNewUser({ ...newUser, familyName: e.target.value })} /></label>
          <label>{t('givenName') || 'Given Name'}: <input value={newUser.givenName} onChange={(e) => setNewUser({ ...newUser, givenName: e.target.value })} /></label>
          <label>{t('address') || 'Address'}: <input value={newUser.address} onChange={(e) => setNewUser({ ...newUser, address: e.target.value })} /></label>
          <button className="btn-primary" onClick={createNewUser}>{t('addUser') || 'Add User'}</button>
        </div>
        {newUserPassword && (
          <div className="password-display" style={{background:'#d4edda', padding:'10px', marginTop:'10px', borderRadius:'4px'}}>
            <strong>New user password:</strong> <code style={{fontSize:'16px'}}>{newUserPassword}</code>
            <br/><small>Please save this password - it cannot be recovered!</small>
          </div>
        )}
      </section>

      <section className="card">
        <h3>{t('docManagement') || 'Document Management'}</h3>
        <div className="row">
          <input placeholder={t('userName') || 'Username'} value={docUser} onChange={(e) => setDocUser(e.target.value)} />
          <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          <button onClick={searchDocs}>{t('search') || 'Search'}</button>
        </div>
        {docResults.length > 0 ? (
          <table>
            <thead><tr><th>ID</th><th>{t('titleField') || 'Title'}</th><th>{t('date') || 'Date'}</th><th>{t('userName') || 'User'}</th><th></th></tr></thead>
            <tbody>
              {docResults.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.title || '无标题'}</td>
                  <td>{d.date}</td>
                  <td>{d.user_name}</td>
                  <td><button className="danger btn-sm" onClick={() => deleteDoc(d.id)}>{t('delete') || 'Delete'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No documents found</p>
        )}
        <p className="muted" style={{marginTop:'10px'}}>Note: content and comments are encrypted and not visible to SYS_ADMIN</p>
      </section>

      <section className="card">
        <h3>{t('countViewAutoList')}</h3>
        {autoListLoading ? (
          <LotusSpinner size={70} />
        ) : !showAutoSubmitList ? (
          <button className="btn-primary" onClick={loadAutoSubmitList} disabled={autoListLoading}>
            {t('countViewAutoList')}
          </button>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <p className="muted">{t('countAutoListAll')}: {autoSubmitList.length}</p>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button className="btn-sm" onClick={loadAutoSubmitList} disabled={autoListLoading}>{t('search') || 'Search'}</button>
                <button className="btn-sm" onClick={() => setShowAutoSubmitList(false)}>{t('countAutoListHide')}</button>
              </div>
            </div>
            {autoSubmitList.length === 0 ? (
              <p className="muted">{t('countAutoListEmpty')}</p>
            ) : (
              <table className="count-table">
                <thead>
                  <tr>
                    <th>{t('countTableUsername')}</th>
                    <th>{t('countAutoSubmitOn')}/{t('countAutoSubmitOff')}</th>
                    <th>{t('countAutoListDaily')}</th>
                    <th>{t('countAutoListTotal')}</th>
                    <th>{t('countAutoListLatest')}</th>
                    <th>{t('countAutoListUpdated')}</th>
                    <th>{t('countActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {autoSubmitList.map((u) => (
                    <tr key={u.userName}>
                      <td>{u.displayName || u.userName}</td>
                      <td>
                        <button
                          className={u.autoSubmit ? 'count-toggle-on' : 'count-toggle-off'}
                          onClick={() => handleToggleAutoSubmit(u.userName, u.autoSubmit)}
                        >
                          {u.autoSubmit ? t('countAutoSubmitOn') : t('countAutoSubmitOff')}
                        </button>
                      </td>
                      <td>{u.dailyCount}</td>
                      <td>{u.totalCount}</td>
                      <td>{u.latestCountDate || '—'}</td>
                      <td>{u.updatedAt || '—'}</td>
                      <td>
                        <button
                          className="btn-sm danger"
                          onClick={() => handleDeleteUserEntries(u.userName)}
                          disabled={u.totalCount === 0}
                        >
                          {t('countDeleteEntries')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>

      {pendingUsers.length > 0 && (
        <section className="card">
          <h3>{t('pendingReset') || 'Pending Password Reset'}</h3>
          <p className="muted">These users requested password reset. Generate or set a new password for them.</p>
          <ul className="user-list">
            {pendingUsers.map((u) => (
              <li key={u.id}>
                <span className="user-name">{u.user_name}</span>
                <span className="user-email">{u.email}</span>
                <button className="btn-sm" onClick={() => { setResetPasswordUser(u.user_name); setNewResetPassword(''); }}>
                  {t('setPassword') || 'Set Password'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resetPasswordUser && (
        <section className="card">
          <h3>{t('setPassword') || 'Set Password'}: {resetPasswordUser}</h3>
          <div className="row">
            <input type="text" value={newResetPassword} onChange={(e) => setNewResetPassword(e.target.value)} placeholder={t('newPassword') || 'New Password'} />
            <button type="button" onClick={generateRandomPassword}>{t('generateRandom') || 'Generate Random'}</button>
          </div>
          <button className="btn-primary" onClick={saveResetPassword}>{t('save') || 'Save'}</button>
          <button onClick={() => { setResetPasswordUser(null); setNewResetPassword(''); }}>{t('cancel') || 'Cancel'}</button>
        </section>
      )}

      {msg && <div className="msg" style={{padding:'10px', background: msg.toLowerCase().includes('fail') ? '#f8d7da' : '#d4edda', borderRadius:'4px', margin:'10px 0'}}>{msg}</div>}

      <button className="logout-btn" onClick={logout}>{t('logout') || 'Logout'}</button>
    </div>
  );
}
