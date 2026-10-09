import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DocumentListByUser } from '../components/DocumentListByUser';
import { api } from '../api/client';
import { LotusSpinner } from '../components/LotusSpinner';
import { LanguageToggle } from '../components/LanguageToggle';

export function NormalUserHome() {
  const { user, logout, loading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOpen, setShowOpen] = useState(false);
  const [notification, setNotification] = useState(null);
  const lastDocCountRef = useRef(0);
  const lastHasCommentRef = useRef(new Set());

  // Auto-refresh: check for new documents/comments every 30 seconds
  // Only on home page (not edit page), within 2 minutes of submit
  useEffect(() => {
    if (!user?.user_name) return;

    const checkForNewDocuments = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const res = await api.get(`/documents/by-user/${user.user_name}?year=${year}&month=${month}`);
        const docs = res.documents || [];

        // Check for new documents
        if (lastDocCountRef.current > 0 && docs.length > lastDocCountRef.current) {
          setNotification(t('newDocumentsNotification') || 'New documents available!');
          setTimeout(() => setNotification(null), 5000);
          setRefreshKey(k => k + 1);
        }
        lastDocCountRef.current = docs.length;

        // Check for new comments — ONLY on the user's own documents (not others' open docs)
        const ownDocs = docs.filter(d => d.user_name === user.user_name);
        for (const doc of ownDocs) {
          if (doc.has_comment && !lastHasCommentRef.current.has(doc.id)) {
            setNotification(t('newCommentNotification') || '有新批注！');
            setTimeout(() => setNotification(null), 5000);
            setRefreshKey(k => k + 1);
            break;
          }
        }

        // Update the set of own docs with comments
        const currentCommentDocs = new Set(ownDocs.filter(d => d.has_comment).map(d => d.id));
        lastHasCommentRef.current = currentCommentDocs;
      } catch (e) {
        // Ignore errors in polling
      }
    };

    // Initial check
    checkForNewDocuments();

    // Poll every 30 seconds (within 2 minutes requirement)
    const interval = setInterval(checkForNewDocuments, 30000);
    return () => clearInterval(interval);
  }, [user?.user_name, t]);

  return (
    <div className="page home-page">
      {loading && <LotusSpinner />}
      {!loading && !user && <div style={{ padding: '40px', textAlign: 'center' }}>Please log in.</div>}
      {notification && (
        <div className="notification-toast" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#8b5a2b',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
        }}>
          {notification}
        </div>
      )}
      <header className="home-header">
        <button className="btn-primary" onClick={() => navigate('/edit-diary')}>{t('writeDiary')}</button>
        <button
          className={showOpen ? 'btn-secondary' : 'btn-primary'}
          onClick={() => setShowOpen(false)}
          style={{ marginLeft: '20px' }}
        >
          {t('myDiary') || 'My Diary'}
        </button>
        <button
          className={showOpen ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setShowOpen(true)}
        >
          {t('openDiary') || 'Open Diary'}
        </button>
        <div className="home-header-right">
          <LanguageToggle />
          <button className="btn-secondary" onClick={() => navigate('/count')}>{t('countMode')}</button>
          <div className="user-info" onClick={() => navigate('/account')}>
            <img src={user?.photo || '/default-avatar.png'} alt="" className="avatar" onError={(e) => { e.target.style.display = 'none'; }} />
            <span>{user?.user_name}</span>
          </div>
        </div>
      </header>
      {user && (
        <main>
          <DocumentListByUser
            key={refreshKey}
            userName={user?.user_name}
            onSelectDoc={(doc) => navigate(`/edit-diary/${doc.id}`)}
            showOpenOnly={showOpen}
          />
        </main>
      )}
      <button className="logout-btn" onClick={logout}>{t('logout')}</button>
    </div>
  );
}
