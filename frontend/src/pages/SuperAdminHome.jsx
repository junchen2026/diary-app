import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Calendar } from '../components/Calendar';
import { DocumentListByDate } from '../components/DocumentListByDate';
import { DocumentListByUser } from '../components/DocumentListByUser';
import { LanguageToggle } from '../components/LanguageToggle';

export function SuperAdminHome() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState('date'); // Default to 'date' view showing today's documents
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get('/users/all').then((res) => setUsers(res.users));
  }, []);

  return (
    <div className="page admin-page">
      <header className="home-header">
        <h2>SUPER_ADMIN — {t('title')}</h2>
        <div className="home-header-right">
          <LanguageToggle />
          <button className="btn-secondary" onClick={() => navigate('/count')}>{t('countMode')}</button>
          <div className="user-info" onClick={() => navigate('/account')}>
            <span>{user?.user_name}</span>
          </div>
        </div>
      </header>

      <div className="super-layout">
        <aside className="sidebar">
          <h3>{t('calendar')}</h3>
          <Calendar selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setView('date'); setSelectedUser(null); }} />
          <h3>{t('allUsers')}</h3>
          <ul className="user-list compact">
            {users.map((u) => (
              <li key={u.id} className="link" onClick={() => { setSelectedUser(u.user_name); setView('user'); }}>
                {u.user_name}
              </li>
            ))}
          </ul>
        </aside>
        <main>
          {view === 'date' && (
            <DocumentListByDate date={selectedDate} onSelectDoc={(doc) => navigate(`/edit-comment/${doc.id}`)} />
          )}
          {view === 'user' && selectedUser && (
            <DocumentListByUser userName={selectedUser} onSelectDoc={(doc) => navigate(`/edit-comment/${doc.id}`)} />
          )}
          {view === 'calendar' && <p className="muted">{t('calendar')} — select a date or user</p>}
        </main>
      </div>

      <button className="logout-btn" onClick={logout}>{t('logout')}</button>
    </div>
  );
}
