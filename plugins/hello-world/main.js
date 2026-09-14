// A Zpace plugin script: an ES module that exports `activate(zpace)`.
// Everything it may use is in `zpace` and gated by the permissions in plugin.json.
// Return a function to run when the plugin is disabled or removed.

export function activate(zpace) {
  const disposers = [];

  // A palette command (Ctrl+K → "Hello World: say hi").
  disposers.push(
    zpace.commands.register({
      id: 'hi',
      title: 'Hello World: say hi',
      keywords: ['hello', 'hi'],
      run: () => {
        const n = (zpace.storage.get('greeted', 0) ?? 0) + 1;
        zpace.storage.set('greeted', n);
        zpace.notify({ title: `Hi from ${zpace.plugin.id}`, summary: `Greeted ${n} time${n === 1 ? '' : 's'} · ${zpace.projects.current()?.name ?? 'no project'}`, variant: 'success' });
      },
    }),
  );

  // Every time an agent finishes a turn.
  disposers.push(
    zpace.on('session:completed', (e) => {
      zpace.notify({ title: 'A session finished', summary: `${e.title} — ${(e.text ?? '').slice(0, 80)}`, variant: 'info' });
    }),
  );

  return () => disposers.forEach((d) => d());
}
