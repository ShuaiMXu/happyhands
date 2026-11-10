// Refresh the README's self-contained chart from GitHub, using the existing gh login.
// Only daily aggregates are saved; account names and credentials never enter assets.
import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const repository = 'ShuaiMXu/happyhands';
const directory = fileURLToPath(new URL('../assets/readme/', import.meta.url));
const api = args => execFileSync('gh', ['api', ...args], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
const metadata = JSON.parse(api([`repos/${repository}`]));
const timestamps = api(['-H', 'Accept: application/vnd.github.star+json', `repos/${repository}/stargazers?per_page=100`, '--paginate', '--jq', '.[].starred_at']).trim().split('\n').filter(Boolean);
if (!timestamps.length || timestamps.some(value => !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))) {
  throw new Error('GitHub returned missing or invalid star dates; existing charts were retained.');
}
if (timestamps.length !== metadata.stargazers_count) {
  throw new Error('Star count changed during collection; rerun to obtain a consistent snapshot. Existing charts were retained.');
}
const now = new Date();
const day = value => new Date(value).toISOString().slice(0, 10);
const firstDay = day(Math.min(...timestamps.map(Date.parse)));
const lastDay = day(now);
const daily = new Map();
for (const value of timestamps) daily.set(day(value), (daily.get(day(value)) || 0) + 1);
let total = 0;
const series = [];
for (let time = Date.parse(firstDay); time <= Date.parse(lastDay); time += 86400000) {
  const date = day(time);
  total += daily.get(date) || 0;
  series.push({date, stars: total});
}
const recent = timestamps.filter(value => Date.parse(value) >= now.getTime() - 7 * 86400000).length;
const snapshot = {
  repository, generatedAt: now.toISOString(), totalStars: total, starredInLast7Days: recent,
  method: 'Cumulative starred_at dates of current stargazers. Removed stars are not reconstructed; this is not a historical net-count ledger.',
  series,
};

function chart(dark) {
  const palette = dark
    ? {background: '#111111', text: '#f5f5f5', muted: '#a3a3a3', grid: '#343434', accent: '#f79b60'}
    : {background: '#ffffff', text: '#171717', muted: '#666666', grid: '#e5e5e5', accent: '#d65f16'};
  const left = 78, right = 1056, top = 142, bottom = 326;
  const maximum = Math.max(4, Math.ceil(total / 4 / 10) * 10 * 4);
  const x = index => left + index / Math.max(1, series.length - 1) * (right - left);
  const y = count => bottom - count / maximum * (bottom - top);
  const points = series.map((point, index) => `${x(index).toFixed(2)},${y(point.stars).toFixed(2)}`);
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point}`).join(' ');
  const ticks = [0, 1, 2, 3, 4].map(index => {
    const count = maximum * index / 4;
    return `<path d="M${left} ${y(count)}H${right}" stroke="${palette.grid}" stroke-width="0.7"/><text x="${left - 18}" y="${y(count) + 6}" text-anchor="end">${count}</text>`;
  }).join('');
  const dates = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])].map(index =>
    `<text x="${x(index)}" y="358" text-anchor="${index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'}">${series[index].date}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 410" role="img" aria-labelledby="title description">
<title id="title">HappyHands GitHub star growth</title>
<desc id="description">${total} current stars as of ${lastDay}. ${recent} current stargazers added their star in the preceding seven days. Daily cumulative dates from ${firstDay}. Unstars are not reconstructed.</desc>
<rect width="1120" height="410" fill="${palette.background}"/>
<g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif" font-weight="400">
<text x="78" y="48" font-size="24" fill="${palette.text}">GitHub stars</text>
<text x="78" y="108" font-size="48" fill="${palette.text}">${total}</text>
<text x="186" y="104" font-size="21" fill="${palette.muted}">+${recent} starred in the last 7 days</text>
<text x="1056" y="48" text-anchor="end" font-size="18" fill="${palette.muted}">Updated ${lastDay} UTC</text>
<g font-size="18" fill="${palette.muted}">${ticks}${dates}</g>
<path d="${line} L${right},${bottom} L${left},${bottom} Z" fill="${palette.accent}" fill-opacity="0.08"/>
<path d="${line}" fill="none" stroke="${palette.accent}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="${x(series.length - 1)}" cy="${y(total)}" r="4.5" fill="${palette.accent}"/>
<text x="78" y="395" font-size="16" fill="${palette.muted}">Source: GitHub / current stargazers, grouped by date</text>
</g></svg>\n`;
}

await mkdir(directory, {recursive: true});
await writeFile(`${directory}/star-history.json`, JSON.stringify(snapshot, null, 2) + '\n');
await writeFile(`${directory}/star-history-light.svg`, chart(false));
await writeFile(`${directory}/star-history-dark.svg`, chart(true));
console.log(`Updated ${repository}: ${total} stars; ${recent} current stargazers in the last 7 days (${lastDay} UTC).`);
