// Open-Meteo for the forecast (no key), ipwho.is for a first guess at where you are. Refreshes every 30 minutes,
// or when the pane asks. The island shows the current temperature and condition.

const CODES = {
  0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Rime fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
  61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'], 85: ['Snow showers', '🌨️'], 86: ['Snow showers', '❄️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm, hail', '⛈️'], 99: ['Thunderstorm, hail', '⛈️'],
};

export function activate(zpace) {
  const disposers = [];
  let timer = 0;
  let data = zpace.storage.get('last') ?? null;

  const describe = (code) => CODES[code] ?? ['—', '🌡️'];
  const chip = () => {
    if (!data) return zpace.island.set(null);
    const [label, icon] = describe(data.current.code);
    zpace.island.set({ icon, text: `${Math.round(data.current.temp)}°`, title: `${label} · ${data.place.name} — click for the forecast`, onClick: () => zpace.panes.open('weather') });
  };
  const send = () => zpace.panes.postMessage({ type: 'weather', data, error: null });

  async function locate() {
    const saved = zpace.storage.get('place');
    if (saved) return saved;
    for (const url of ['https://ipwho.is/', 'https://ipapi.co/json/']) {
      try {
        const r = await fetch(url).then((x) => x.json());
        const lat = r.latitude, lon = r.longitude, name = r.city ? `${r.city}, ${r.country_code ?? r.country ?? ''}`.replace(/, $/, '') : r.country;
        if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon, name };
      } catch {
        /* next */
      }
    }
    return { lat: -34.6, lon: -58.38, name: 'Buenos Aires, AR' };
  }

  async function search(q) {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${navigator.language.slice(0, 2)}`).then((x) => x.json());
    const hit = r.results?.[0];
    if (!hit) throw new Error(`No place called "${q}"`);
    return { lat: hit.latitude, lon: hit.longitude, name: `${hit.name}${hit.admin1 ? ', ' + hit.admin1 : ''}${hit.country_code ? ', ' + hit.country_code : ''}` };
  }

  async function refresh(place) {
    try {
      place = place ?? (await locate());
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=7`;
      const r = await fetch(url).then((x) => x.json());
      const nowIdx = Math.max(0, r.hourly.time.findIndex((t) => new Date(t).getTime() > Date.now()) - 1);
      data = {
        place,
        fetchedAt: Date.now(),
        current: { temp: r.current.temperature_2m, feels: r.current.apparent_temperature, humidity: r.current.relative_humidity_2m, wind: r.current.wind_speed_10m, code: r.current.weather_code, label: describe(r.current.weather_code)[0], icon: describe(r.current.weather_code)[1] },
        hours: r.hourly.time.slice(nowIdx, nowIdx + 12).map((t, i) => ({ time: t, temp: r.hourly.temperature_2m[nowIdx + i], icon: describe(r.hourly.weather_code[nowIdx + i])[1], rain: r.hourly.precipitation_probability[nowIdx + i] })),
        days: r.daily.time.map((t, i) => ({ date: t, max: r.daily.temperature_2m_max[i], min: r.daily.temperature_2m_min[i], icon: describe(r.daily.weather_code[i])[1], label: describe(r.daily.weather_code[i])[0], rain: r.daily.precipitation_probability_max[i], sunrise: r.daily.sunrise[i], sunset: r.daily.sunset[i] })),
      };
      zpace.storage.set('last', data);
      zpace.storage.set('place', place);
      chip();
      send();
    } catch (e) {
      zpace.panes.postMessage({ type: 'weather', data, error: e instanceof Error ? e.message : String(e) });
    }
    clearTimeout(timer);
    timer = setTimeout(() => refresh(), 30 * 60_000);
  }

  disposers.push(
    zpace.on('pane:message', async ({ message: m }) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'hello') {
        send();
        if (!data || Date.now() - data.fetchedAt > 10 * 60_000) refresh();
      } else if (m.type === 'refresh') refresh();
      else if (m.type === 'search') {
        try {
          await refresh(await search(m.q));
        } catch (e) {
          zpace.panes.postMessage({ type: 'weather', data, error: e.message });
        }
      } else if (m.type === 'locate') {
        zpace.storage.set('place', null);
        refresh();
      }
    }),
  );
  disposers.push(zpace.commands.register({ id: 'now', title: 'Weather: right now', keywords: ['weather', 'clima', 'temperature'], run: () => (data ? zpace.notify({ title: `${Math.round(data.current.temp)}° · ${data.current.label}`, summary: `${data.place.name} · feels ${Math.round(data.current.feels)}° · ${data.current.humidity}% · ${Math.round(data.current.wind)} km/h`, variant: 'info', action: { label: 'Forecast', run: () => zpace.panes.open('weather') } }) : refresh()) }));

  chip();
  refresh();
  return () => {
    clearTimeout(timer);
    zpace.island.set(null);
    disposers.forEach((d) => d());
  };
}
