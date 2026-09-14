// Polls the system media session: every 2 s while a pane is open or something plays, every 20 s otherwise,
// so an idle machine costs nothing. The island shows the track while it plays.

export function activate(zpace) {
  const disposers = [];
  let last = null;
  let panes = 0;
  let timer = 0;

  const same = (a, b) => a?.title === b?.title && a?.artist === b?.artist && a?.playing === b?.playing;
  // the track stays up while paused (with a pause mark); only silence — no session at all — clears it
  const chip = (now) => {
    if (!now) return zpace.island.set(null);
    const text = now.artist ? `${now.title} — ${now.artist}` : now.title;
    zpace.island.set({ icon: now.playing ? '♪' : '⏸', text, title: now.playing ? 'Now playing — click to open' : 'Paused — click to open', color: now.playing ? undefined : 'rgba(255,255,255,0.55)', onClick: () => zpace.panes.open('player') });
  };
  const poll = async () => {
    let now = null;
    try {
      now = await zpace.media.now();
    } catch {
      now = null;
    }
    if (!same(now, last)) chip(now);
    last = now;
    if (panes > 0) zpace.panes.postMessage({ type: 'now', now });
    schedule(now?.playing || panes > 0 ? 2000 : 20000);
  };
  const schedule = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  };

  disposers.push(
    zpace.on('pane:message', async ({ message: m }) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'hello') {
        panes += 1;
        void poll();
      } else if (m.type === 'bye') panes = Math.max(0, panes - 1);
      else if (m.type === 'control') {
        await zpace.media.control(m.action);
        setTimeout(poll, 250);
      }
    }),
  );
  const control = (action) => async () => {
    await zpace.media.control(action);
    setTimeout(poll, 250);
  };
  disposers.push(zpace.commands.register({ id: 'toggle', title: 'Music: play / pause', keywords: ['spotify', 'music', 'pause', 'play'], run: control('toggle') }));
  disposers.push(zpace.commands.register({ id: 'next', title: 'Music: next track', keywords: ['spotify', 'music', 'next', 'skip'], run: control('next') }));
  disposers.push(zpace.commands.register({ id: 'previous', title: 'Music: previous track', keywords: ['spotify', 'music', 'previous', 'back'], run: control('previous') }));

  void poll();
  return () => {
    clearTimeout(timer);
    zpace.island.set(null);
    disposers.forEach((d) => d());
  };
}
