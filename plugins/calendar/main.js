// Reminders: once a minute, any event starting within ten minutes that has not been announced yet goes to the island.
// Events live in storage as { id, date: 'YYYY-MM-DD', time: 'HH:MM' | '', title, noteId? }.

export function activate(zpace) {
  const disposers = [];
  const announced = new Set(zpace.storage.get('announced', []));
  const check = () => {
    const events = zpace.storage.get('events', []);
    const now = Date.now();
    for (const e of events) {
      if (!e.time || announced.has(e.id)) continue;
      const at = new Date(`${e.date}T${e.time}:00`).getTime();
      const delta = at - now;
      if (delta > 10 * 60_000 || delta < -60_000) continue;
      announced.add(e.id);
      zpace.storage.set('announced', [...announced].slice(-200));
      zpace.notify({
        title: delta > 0 ? `In ${Math.max(1, Math.round(delta / 60_000))} min: ${e.title}` : `Now: ${e.title}`,
        summary: `${e.date} ${e.time}`,
        variant: 'info',
        sticky: true,
        action: e.noteId ? { label: 'Open the note', run: () => zpace.notes.open(e.noteId) } : { label: 'Open the calendar', run: () => zpace.panes.open('calendar') },
      });
    }
  };
  // the next event within the day, in the island
  const chip = () => {
    const now = Date.now();
    const up = zpace.storage
      .get('events', [])
      .map((e) => ({ ...e, at: new Date(`${e.date}T${e.time || '23:59'}:00`).getTime() }))
      .filter((e) => e.at >= now - 5 * 60_000 && e.at <= now + 24 * 3_600_000)
      .sort((a, b) => a.at - b.at)[0];
    if (!up) return zpace.island.set(null);
    const sameDay = new Date(up.at).toDateString() === new Date().toDateString();
    zpace.island.set({ icon: '📅', text: `${sameDay ? up.time || '' : new Date(up.at).toLocaleDateString(undefined, { weekday: 'short' })} ${up.title}`.trim(), title: 'Next event — click to open the calendar', onClick: () => zpace.panes.open('calendar') });
  };
  const timer = setInterval(() => {
    check();
    chip();
  }, 60_000);
  check();
  chip();
  disposers.push(zpace.on('pane:message', ({ message: m }) => { if (m?.type === 'changed') chip(); }));
  disposers.push(
    zpace.commands.register({
      id: 'next',
      title: 'Calendar: what is next',
      keywords: ['calendar', 'next', 'agenda'],
      run: () => {
        const now = new Date();
        const up = zpace.storage
          .get('events', [])
          .map((e) => ({ ...e, at: new Date(`${e.date}T${e.time || '00:00'}:00`).getTime() }))
          .filter((e) => e.at >= now.getTime() - 60_000)
          .sort((a, b) => a.at - b.at)[0];
        zpace.notify({ title: up ? up.title : 'Nothing coming up', summary: up ? `${up.date}${up.time ? ' ' + up.time : ''}` : 'The calendar is clear', variant: 'info', action: { label: 'Open', run: () => zpace.panes.open('calendar') } });
      },
    }),
  );
  return () => {
    clearInterval(timer);
    zpace.island.set(null);
    disposers.forEach((d) => d());
  };
}
