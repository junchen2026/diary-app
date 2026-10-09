import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export function EditUserProfile() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const userFromState = location.state?.user;

  const [form, setForm] = useState({
    user_name: userFromState?.user_name || '',
    email: userFromState?.email || '',
    familyName: userFromState?.familyName || '',
    givenName: userFromState?.givenName || '',
    address: userFromState?.address === '(encrypted)' ? '' : (userFromState?.address || ''),
    photo: userFromState?.photo === '(encrypted)' ? '' : (userFromState?.photo || ''),
    newPassword: '',
  });
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef(null);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg('Photo must be an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 300;
        let width = img.width;
        let height = img.height;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setForm(prev => ({ ...prev, photo: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const deletePhoto = () => {
    setForm(prev => ({ ...prev, photo: '' }));
  };

  const handleSave = async () => {
    try {
      const body = {
        email: form.email,
        photo: form.photo,
        address: form.address,
        familyName: form.familyName,
        givenName: form.givenName,
      };
      if (form.newPassword) {
        body.newPassword = form.newPassword;
      }
      const res = await api.put('/users/' + form.user_name + '/profile', body);
      if (res.password) {
        setMsg('Profile saved. New password: ' + res.password);
      } else {
        setMsg(t('success') || 'Saved successfully');
      }
      setForm(prev => ({ ...prev, newPassword: '' }));
    } catch (err) {
      setMsg('Save failed: ' + (err.data?.errorZh || err.data?.error || err.message));
    }
  };

  const handleDeleteUser = async () => {
    if (!confirm('Delete user ' + form.user_name + '? This will also delete all their documents.')) return;
    try {
      await api.delete('/users/' + form.user_name);
      navigate('/sys');
    } catch (err) {
      setMsg('Delete failed: ' + (err.data?.errorZh || err.data?.error || err.message));
    }
  };

  if (!form.user_name) {
    return (
      <div className="page">
        <p className="muted">No user selected. Go back and search.</p>
        <button className="btn-back" onClick={() => navigate('/sys')}>{t('back') || 'Back'}</button>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="top-bar">
        <button className="btn-back" onClick={() => navigate('/sys')}>{t('back') || 'Back'}</button>
        <h2>{t('save') === 'Save' ? 'Edit User Profile' : '修改用户Profile'}</h2>
      </header>
      <form className="card" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <label>{t('userName') || 'Username'}: <input value={form.user_name} disabled /></label>
        <label>Email: <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>{t('password') || 'Password'}: <input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="(leave blank to keep current)" /></label>
        <label>{t('familyName') || 'Family Name'}: <input value={form.familyName} onChange={(e) => setForm({ ...form, familyName: e.target.value })} /></label>
        <label>{t('givenName') || 'Given Name'}: <input value={form.givenName} onChange={(e) => setForm({ ...form, givenName: e.target.value })} /></label>
        <label>{t('address') || 'Address'}: <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label>{t('photo') || 'Photo'}:
          <input type="hidden" value={form.photo} readOnly />
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>{t('uploadPhoto') || 'Upload Photo'}</button>
            <button type="button" className="btn-sm danger" onClick={deletePhoto} disabled={!form.photo}>{t('delete') || 'Delete'} Photo</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </div>
          {form.photo && <img src={form.photo} alt="avatar" className="avatar-preview" />}
        </label>
        {msg && <p>{msg}</p>}
        <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>{t('save') || 'Save'}</button>
          <button type="button" className="btn-danger" style={{ flex: 1 }} onClick={handleDeleteUser}>{t('delete') || 'Delete'} {t('userName') || 'User'}</button>
        </div>
      </form>
    </div>
  );
}
