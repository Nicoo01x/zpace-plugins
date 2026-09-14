// Polls the system media session: every 2 s while a pane is open or something plays, every 20 s otherwise,
// so an idle machine costs nothing. The island shows the track while it plays.

export function activate(zpace) {
  const disposers = [];
  let last = null;
  let panes = 0;
  let timer = 0;
  let cardId = null;

  // the card that unfolds in the island: the cover, the track, transport buttons; refreshed while it is up
  const card = (now) => ({
    title: now.title,
    lines: [now.artist ? (now.album ? `${now.artist} · ${now.album}` : now.artist) : ''],
    image: now.thumbnail ?? undefined,
    foldMs: 12000,
    buttons: [
      { label: '⏮', run: () => control('previous')() },
      { label: now.playing ? '⏸' : '▶', primary: true, run: () => control('toggle')() },
      { label: '⏭', run: () => control('next')() },
      { label: 'Open', run: () => zpace.panes.open('player') },
    ],
  });
  const showCard = () => {
    if (!last) return zpace.panes.open('player');
    if (cardId) zpace.island.update(cardId, card(last));
    else cardId = zpace.island.show(card(last));
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => (cardId = null), 13000);
  };
  let cardTimer = 0;

  const same = (a, b) => a?.title === b?.title && a?.artist === b?.artist && a?.playing === b?.playing;
  // the track stays up while paused (with a pause mark); only silence — no session at all — clears it
  const chip = (now) => {
    if (!now) return zpace.island.set(null);
    const text = now.artist ? `${now.title} — ${now.artist}` : now.title;
    zpace.island.set({ icon: now.playing ? '♪' : '⏸', text, title: now.playing ? 'Now playing — click for the cover and controls' : 'Paused — click for the cover and controls', color: now.playing ? undefined : 'rgba(255,255,255,0.55)', onClick: showCard });
  };
  const poll = async () => {
    let now = null;
    try {
      now = await zpace.media.now();
    } catch {
      now = null;
    }
    if (!same(now, last)) {
      chip(now);
      if (cardId && now) zpace.island.update(cardId, card(now));
    }
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
