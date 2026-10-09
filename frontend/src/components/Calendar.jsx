import { useState } from 'react';

export function Calendar({ selectedDate, onSelectDate }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const todayStr = today.toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(dateStr);
  }

  return (
    <div className="calendar">
      <div className="cal-header">
        <button onClick={() => setViewMonth(m => m === 0 ? (setViewYear(y => y - 1), 11) : m - 1)}>◀</button>
        <span>{viewYear} - {viewMonth + 1}</span>
        <button onClick={() => setViewMonth(m => m === 11 ? (setViewYear(y => y + 1), 0) : m + 1)}>▶</button>
      </div>
      <div className="cal-grid">
        {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
          <div key={d} className="cal-weekday">{d}</div>
        ))}
        {cells.map((dateStr, i) => (
          <div
            key={i}
            className={`cal-day ${!dateStr ? 'empty' : ''} ${dateStr === todayStr ? 'today' : ''} ${dateStr === selectedDate ? 'selected' : ''}`}
            onClick={() => dateStr && onSelectDate?.(dateStr)}
          >
            {dateStr ? parseInt(dateStr.slice(-2), 10) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
