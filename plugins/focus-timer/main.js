// The timer runs here, in the plugin script, so it keeps going with the pane closed.
// State: { mode: 'focus' | 'break', minutes, endsAt | null, paused: remainingMs | null, today: { date, focus: n } }

const FOCUS = 25;
const BREAK = 5;

export function activate(zpace) {
  const disposers = [];
  let state = zpace.storage.get('state') ?? { mode: 'focus', minutes: FOCUS, endsAt: null, paused: null, today: { date: today(), focus: 0 } };
  let tick = 0;

  const save = () => zpace.storage.set('state', state);
  const remaining = () => (state.endsAt ? Math.max(0, state.endsAt - Date.now()) : state.paused ?? state.minutes * 60_000);
  const fmt = (ms) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
  const broadcast = () => zpace.panes.postMessage({ ...state, remaining: remaining(), running: !!state.endsAt });
  const chip = () => {
    if (!state.endsAt && state.paused === null) return zpace.island.set(null);
    zpace.island.set({ icon: state.mode === 'focus' ? '🍅' : '☕', text: state.endsAt ? fmt(remaining()) : `${fmt(remaining())} ⏸`, title: state.mode === 'focus' ? 'Focus — click to open' : 'Break — click to open', onClick: () => zpace.panes.open('timer') });
  };

  const start = (mode = state.mode, minutes = mode === 'focus' ? FOCUS : BREAK) => {
    state = { ...state, mode, minutes, endsAt: Date.now() + (state.paused ?? minutes * 60_000), paused: null };
    save();
    run();
  };
  const pause = () => {
    if (!state.endsAt) return;
    state = { ...state, paused: remaining(), endsAt: null };
    save();
    run();
  };
  const reset = () => {
    state = { ...state, endsAt: null, paused: null };
    save();
    run();
  };
  const finish = () => {
    const wasFocus = state.mode === 'focus';
    if (wasFocus) {
      if (state.today.date !== today()) state.today = { date: today(), focus: 0 };
      state.today.focus += 1;
    }
    state = { ...state, mode: wasFocus ? 'break' : 'focus', minutes: wasFocus ? BREAK : FOCUS, endsAt: null, paused: null };
    save();
    zpace.notify({
      title: wasFocus ? 'Focus block done' : 'Break is over',
      summary: wasFocus ? `${state.today.focus} today · time for a ${BREAK} min break` : 'Back to it — start the next focus block',
      variant: 'success',
      sticky: true,
      action: { label: wasFocus ? 'Start break' : 'Start focus', run: () => start() },
    });
    run();
  };
  const run = () => {
    clearInterval(tick);
    chip();
    broadcast();
    if (!state.endsAt) return;
    tick = setInterval(() => {
      if (remaining() <= 0) finish();
      else {
        chip();
        broadcast();
      }
    }, 1000);
  };

  // the pane drives it through messages
  disposers.push(
    zpace.on('pane:message', ({ message: m }) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'start') start(m.mode ?? state.mode, m.minutes);
      else if (m.type === 'pause') pause();
      else if (m.type === 'reset') reset();
      else if (m.type === 'mode') {
        state = { ...state, mode: m.mode, minutes: m.mode === 'focus' ? FOCUS : BREAK, endsAt: null, paused: null };
        save();
        run();
      } else if (m.type === 'hello') broadcast();
    }),
  );
  disposers.push(zpace.commands.register({ id: 'start', title: 'Focus: start a 25 min block', keywords: ['pomodoro', 'timer', 'focus'], run: () => start('focus', FOCUS) }));
  disposers.push(zpace.commands.register({ id: 'break', title: 'Focus: start a 5 min break', keywords: ['pomodoro', 'timer', 'break'], run: () => start('break', BREAK) }));
  disposers.push(zpace.commands.register({ id: 'pause', title: 'Focus: pause / resume', keywords: ['pomodoro', 'timer'], run: () => (state.endsAt ? pause() : start()) }));
  disposers.push(zpace.commands.register({ id: 'stop', title: 'Focus: stop the timer', keywords: ['pomodoro', 'timer', 'stop'], run: reset }));

  run();
  return () => {
    clearInterval(tick);
    zpace.island.set(null);
    disposers.forEach((d) => d());
  };
}

const today = () => new Date().toISOString().slice(0, 10);
