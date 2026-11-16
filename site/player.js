const cards = [...document.querySelectorAll('.voice-card')];
const search = document.querySelector('#search');
const filters = [...document.querySelectorAll('.filter')];
const dimensions = ['series', 'region', 'quality', 'dialect'];
const selection = { series: 'all', region: 'all', quality: 'all', dialect: 'all' };

function stopAudio(audio) {
  audio.pause();
  if (audio.readyState > 0) audio.currentTime = 0;
}

for (const card of cards) {
  const audio = card.querySelector('audio');
  const button = card.querySelector('.play-button');
  const icon = card.querySelector('.play-icon');
  const label = card.querySelector('.play-label');
  const error = card.querySelector('.audio-error');
  const sync = () => {
    const playing = !audio.paused && !audio.ended;
    card.classList.toggle('is-playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    icon.textContent = playing ? '■' : '▶';
    label.textContent = playing ? '停止试听' : '点击播放';
    button.setAttribute('aria-label', `${playing ? '停止' : '播放'} ${card.querySelector('h3').textContent}，${card.querySelector('.region-dot').textContent}，${card.querySelector('.dialect').textContent}，${card.querySelector('.edition').textContent}`);
  };
  button.addEventListener('click', async () => {
    if (!audio.paused) { stopAudio(audio); sync(); return; }
    for (const other of cards) if (other !== card) stopAudio(other.querySelector('audio'));
    if (audio.readyState > 0) audio.currentTime = 0;
    error.hidden = true;
    try { await audio.play(); }
    catch (reason) { if (reason.name !== 'AbortError') error.hidden = false; }
    sync();
  });
  audio.addEventListener('play', () => {
    for (const other of cards) if (other !== card) stopAudio(other.querySelector('audio'));
    sync();
  });
  audio.addEventListener('pause', sync);
  audio.addEventListener('ended', () => { stopAudio(audio); sync(); });
  audio.addEventListener('error', () => { stopAudio(audio); error.hidden = false; sync(); });
}

function filterCards() {
  const query = search.value.trim().toLocaleLowerCase();
  const matches = (card, exceptDimension) => card.dataset.search.includes(query) &&
    dimensions.every(dimension => dimension === exceptDimension || selection[dimension] === 'all' || card.dataset[dimension] === selection[dimension]);
  let count = 0;
  for (const card of cards) {
    const show = matches(card);
    card.hidden = !show;
    if (show) count++;
    else stopAudio(card.querySelector('audio'));
  }
  for (const filter of filters) {
    const { dimension, value } = filter.dataset;
    const active = value === selection[dimension];
    const availableCount = cards.filter(card => matches(card, dimension) && (value === 'all' || card.dataset[dimension] === value)).length;
    filter.classList.toggle('active', active);
    filter.setAttribute('aria-pressed', String(active));
    filter.querySelector('[data-count]').textContent = availableCount;
    filter.disabled = availableCount === 0 && value !== 'all' && !active;
  }
  document.querySelector('#result-count').textContent = `${count} 个声音，等你试听`;
  document.querySelector('.empty-state').hidden = count !== 0;
  document.querySelector('#clear-filters').hidden = !query && dimensions.every(dimension => selection[dimension] === 'all');
}
for (const filter of filters) filter.addEventListener('click', () => {
  const { dimension, value } = filter.dataset;
  selection[dimension] = dimension === 'series' && selection[dimension] === value ? 'all' : value;
  filterCards();
});
search.addEventListener('input', filterCards);
function resetFilters() {
  for (const dimension of dimensions) selection[dimension] = 'all';
  search.value = '';
  filterCards();
}
document.querySelector('#reset-filters').addEventListener('click', () => { resetFilters(); search.focus(); });
document.querySelector('#clear-filters').addEventListener('click', () => { resetFilters(); search.focus(); });
filterCards();
