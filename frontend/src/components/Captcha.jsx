import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

/** 扭曲数学验证码画布 */
export function Captcha({ onChange }) {
  const { t } = useLanguage();
  const [captcha, setCaptcha] = useState(null);
  const [answer, setAnswer] = useState('');
  const canvasRef = useRef(null);

  const loadCaptcha = async () => {
    const data = await api.get('/auth/captcha');
    setCaptcha(data);
    setAnswer('');
    onChange?.({ id: data.id, answer: '' });
  };

  useEffect(() => { loadCaptcha(); }, []);

  useEffect(() => {
    if (!captcha || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background gradient noise
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#e8e8e8');
    grad.addColorStop(1, '#f5f5f5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Random dot noise (dense)
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `hsla(${Math.random() * 360}, 50%, 60%, ${Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }

    // Draw each character with individual distortion
    const chars = captcha.question.split('');
    ctx.font = 'bold 24px serif';
    ctx.textBaseline = 'middle';
    const charWidth = 22;
    const startX = (W - chars.length * charWidth) / 2;

    chars.forEach((ch, i) => {
      ctx.save();
      const x = startX + i * charWidth + charWidth / 2;
      const y = H / 2 + (Math.random() - 0.5) * 10;

      // Random rotation
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.6);

      // Random color
      const hue = Math.random() * 60 + 180; // blue-purple range
      ctx.fillStyle = `hsl(${hue}, 60%, 30%)`;

      // Skew
      ctx.transform(1, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2, 1, 0, 0);

      ctx.fillText(ch, -8, 0);
      ctx.restore();
    });

    // Interference lines (curved)
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `hsla(${Math.random() * 360}, 60%, 50%, 0.4)`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      const x1 = Math.random() * W;
      const y1 = Math.random() * H;
      ctx.moveTo(x1, y1);
      // Bezier curve for more natural distortion
      ctx.bezierCurveTo(
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H
      );
      ctx.stroke();
    }

    // Random background characters (decoy noise)
    ctx.font = '14px sans-serif';
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 15; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360}, 40%, 40%)`;
      const decChar = String.fromCharCode(33 + Math.floor(Math.random() * 90));
      ctx.fillText(decChar, Math.random() * W, Math.random() * H);
    }
    ctx.globalAlpha = 1;
  }, [captcha]);

  const handleAnswer = (v) => {
    setAnswer(v);
    onChange?.({ id: captcha?.id, answer: v });
  };

  return (
    <div className="captcha-box">
      <label>{t('captchaLabel')}</label>
      <div className="captcha-row">
        <canvas ref={canvasRef} width={240} height={60} className="captcha-canvas" />
        <button type="button" className="btn-sm" onClick={loadCaptcha}>{t('captchaRefresh')}</button>
      </div>
      <input
        type="number"
        value={answer}
        onChange={(e) => handleAnswer(e.target.value)}
        placeholder="?"
      />
    </div>
  );
}
