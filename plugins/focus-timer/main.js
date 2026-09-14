// The timer runs here, in the plugin script, so it keeps going with the pane closed.
// State: { mode: 'focus' | 'break', minutes, focusMinutes (the last focus length chosen), endsAt | null, paused: remainingMs | null, today: { date, focus: n } }

const FOCUS = 25;
const BREAK = 5;

// real icons for the island readout (drawn in the chip's colour), not emoji
const ICON_TIMER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M12 14v-4"/><circle cx="12" cy="14" r="8"/></svg>';
const ICON_CUP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/></svg>';

export function activate(zpace) {
  const disposers = [];
  let state = zpace.storage.get('state') ?? { mode: 'focus', minutes: FOCUS, endsAt: null, paused: null, today: { date: today(), focus: 0 } };
  let tick = 0;
  let cardId = null;
  let cardTimer = 0;

  const save = () => zpace.storage.set('state', state);
  const remaining = () => (state.endsAt ? Math.max(0, state.endsAt - Date.now()) : state.paused ?? state.minutes * 60_000);
  const fmt = (ms) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
  const broadcast = () => zpace.panes.postMessage({ ...state, remaining: remaining(), running: !!state.endsAt });
  const isIdle = () => !state.endsAt && state.paused === null;
  const todayCount = () => (state.today?.date === today() ? state.today.focus : 0);

  // the card that unfolds from the chip: the time, and the controls that matter right now
  const card = () => {
    const idle = isIdle();
    const running = !!state.endsAt;
    const label = state.mode === 'focus' ? 'Focus' : 'Break';
    const open = { label: 'Open', run: () => zpace.panes.open('timer') };
    return {
      title: running ? `${fmt(remaining())} left` : idle ? `${state.minutes} min ${label.toLowerCase()} block` : `${fmt(remaining())} · paused`,
      lines: [`${label} · ${todayCount()} block${todayCount() === 1 ? '' : 's'} done today`],
      foldMs: 12000,
      buttons: running
        ? [{ label: 'Pause', primary: true, run: pause }, { label: 'Reset', run: reset }, open]
        : idle
          ? [{ label: `Start ${state.minutes}`, primary: true, run: () => start() }, { label: '15', run: () => start(state.mode, 15) }, { label: '50', run: () => start(state.mode, 50) }, open]
          : [{ label: 'Resume', primary: true, run: () => start() }, { label: 'Reset', run: reset }, open],
    };
  };
  const showCard = () => {
    if (cardId) zpace.island.update(cardId, card());
    else cardId = zpace.island.show(card());
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => (cardId = null), 13000);
  };
  const refreshCard = () => {
    if (cardId) zpace.island.update(cardId, card());
  };

  // always in the island: idle shows the block length, running counts down, paused shows a pause mark; a click opens the card
  const chip = () => {
    const idle = isIdle();
    zpace.island.set({
      icon: state.mode === 'focus' ? ICON_TIMER : ICON_CUP,
      text: state.endsAt ? fmt(remaining()) : idle ? fmt(state.minutes * 60_000) : `${fmt(remaining())} ⏸`,
      title: idle ? 'Focus timer — click for the controls' : state.mode === 'focus' ? 'Focus — click for the controls' : 'Break — click for the controls',
      color: idle ? 'rgba(255,255,255,0.55)' : undefined,
      onClick: showCard,
    });
  };

  const start = (mode = state.mode, minutes) => {
    const fresh = minutes !== undefined || state.paused === null;
    const mins = minutes ?? state.minutes;
    state = { ...state, mode, minutes: mins, focusMinutes: mode === 'focus' ? mins : state.focusMinutes, endsAt: Date.now() + (fresh ? mins * 60_000 : state.paused), paused: null };
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
    state = { ...state, mode: wasFocus ? 'break' : 'focus', minutes: wasFocus ? BREAK : state.focusMinutes ?? FOCUS, endsAt: null, paused: null };
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
    refreshCard();
    if (!state.endsAt) return;
    tick = setInterval(() => {
      if (remaining() <= 0) finish();
      else {
        chip();
        broadcast();
        refreshCard();
      }
    }, 1000);
  };

  // the pane drives it through messages
  disposers.push(
    zpace.on('pane:message', ({ message: m }) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'start') start(m.mode ?? state.mode, m.minutes ? Math.min(600, Math.max(1, Math.round(m.minutes))) : undefined);
      else if (m.type === 'pause') pause();
      else if (m.type === 'reset') reset();
      else if (m.type === 'mode') {
        state = { ...state, mode: m.mode, minutes: m.mode === 'focus' ? state.focusMinutes ?? FOCUS : BREAK, endsAt: null, paused: null };
        save();
        run();
      } else if (m.type === 'hello') broadcast();
    }),
  );
  disposers.push(zpace.commands.register({ id: 'start', title: 'Focus: start a block', keywords: ['pomodoro', 'timer', 'focus'], run: () => start('focus', state.focusMinutes ?? FOCUS) }));
  disposers.push(zpace.commands.register({ id: 'break', title: 'Focus: start a 5 min break', keywords: ['pomodoro', 'timer', 'break'], run: () => start('break', BREAK) }));
  disposers.push(zpace.commands.register({ id: 'pause', title: 'Focus: pause / resume', keywords: ['pomodoro', 'timer'], run: () => (state.endsAt ? pause() : start()) }));
  disposers.push(zpace.commands.register({ id: 'stop', title: 'Focus: stop the timer', keywords: ['pomodoro', 'timer', 'stop'], run: reset }));
  disposers.push(zpace.commands.register({ id: 'card', title: 'Focus: show the timer in the island', keywords: ['pomodoro', 'timer', 'island'], run: showCard }));

  run();
  return () => {
    clearInterval(tick);
    clearTimeout(cardTimer);
    if (cardId) zpace.island.hide(cardId);
    zpace.island.set(null);
    disposers.forEach((d) => d());
  };
}

const today = () => new Date().toISOString().slice(0, 10);
