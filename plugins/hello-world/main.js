// A Zpace plugin script: an ES module that exports `activate(zpace)`.
// Everything it may use is in `zpace` and gated by the permissions in plugin.json.
// Return a function to run when the plugin is disabled or removed.

export function activate(zpace) {
  const disposers = [];

  const hi = () => {
    const n = (zpace.storage.get('greeted', 0) ?? 0) + 1;
    zpace.storage.set('greeted', n);
    zpace.notify({ title: `Hi from ${zpace.plugin.id}`, summary: `Greeted ${n} time${n === 1 ? '' : 's'} · ${zpace.projects.current()?.name ?? 'no project'}`, variant: 'success' });
    chip();
  };

  // A palette command (Ctrl+K → "Hello World: say hi").
  disposers.push(zpace.commands.register({ id: 'hi', title: 'Hello World: say hi', keywords: ['hello', 'hi'], run: hi }));

  // Every time an agent finishes a turn.
  disposers.push(
    zpace.on('session:completed', (e) => {
      zpace.notify({ title: 'A session finished', summary: `${e.title} — ${(e.text ?? '').slice(0, 80)}`, variant: 'info' });
    }),
  );

  // A readout in the compact island; a click unfolds a card with buttons (zpace.island.show).
  const chip = () => zpace.island.set({ icon: '👋', text: `${zpace.storage.get('greeted', 0) ?? 0} hi`, title: 'Hello World — click for a card', onClick: () => zpace.island.show({ title: 'Hello from a plugin', lines: ['A card can carry lines, an image and buttons.'], buttons: [{ label: 'Say hi', primary: true, run: hi }, { label: 'Open', run: () => zpace.panes.open('hello') }] }) });
  chip();
  disposers.push(zpace.on('session:completed', chip));

  return () => {
    zpace.island.set(null);
    disposers.forEach((d) => d());
  };
}
