'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const STORE = 'prreacher-save-v2';
const defaults = {
  score: 0, kills: 0, achievements: [], completed: [], sound: true,
  music: 35, effects: 70, animations: true, reducedEffects: false,
  rikiRecord: 0, clinkzRecord: 0, quizBest: 0, survivalBest: 0,
  hero: 'Riki', quizScore: 0, totalHits: 0, bossWins: 0
};
function loadState() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; }
  catch { return { ...defaults }; }
}
const state = loadState();
const screen = $('#screen');
let timers = new Set();
let currentCleanup = null;
let questionIndex = 0;
let bossHp = 100;
let bossPhase = 1;
let bossStreak = 0;
let audioContext;
let musicGain;
let musicOscillators = [];
let musicStarted = false;
let secretSequence = [];

const jokes = [
  'MMR — это просто число. В твоём случае оно просит о помощи.',
  'Ты не фидишь. Ты проводишь благотворительную раздачу золота.',
  'Мини-карта существует не только для красоты и скриншотов.',
  'Сборка настолько уникальная, что даже гайд отказался её признавать.',
  'Тиммейт из 2K объясняет макро. Крип уже пишет заявление.',
  'Ты не проиграл линию. Ты профинансировал противника.',
  '«Последняя катка» — самая длинная ложь в истории человечества.',
  'Враг пропал с карты. Ты пропал из здравого смысла.',
  'Пик был уверенный. План после пика не обнаружен.',
  'Слушать советчика из 2K — это как брать уроки плавания у утопленника.',
  'В инвентаре шесть предметов. Ни одного ответа на вопрос «зачем?».',
  'Команда просит сгруппироваться. Ты группируешься с нейтральными крипами.'
];
const questions = [
  ['Что делать, если противник пропал с линии?', ['Проверить карту и предупредить команду', 'Продолжать фармить с закрытыми глазами', 'Написать ?'], 0],
  ['Зачем нужна мини-карта?', ['Для красоты', 'Чтобы видеть происходящее на карте', 'Чтобы ставить на неё чай'], 1],
  ['Что стоит сделать перед дракой?', ['Проверить позиции и способности', 'Телепортироваться в фонтан', 'Купить третью пару ботинок'], 0],
  ['Команда просит не драться. Твои действия?', ['Подумать, почему', 'Влететь один против пяти', 'Написать ez'], 0],
  ['Кто может быть виноват в поражении?', ['Только саппорт', 'Всегда мид', 'Иногда собственные решения'], 2],
  ['Для чего нужен Observer Ward?', ['Для обзора карты', 'Для кормления Рошана', 'Для украшения инвентаря'], 0],
  ['Что означает GG?', ['Good Game', 'Get Gold', 'Go Gank'], 0]
];
const achievementsList = [
  ['FIRST BLOOD', 'Попасть по первой цели', '🩸'],
  ['INVISIBLE KILLER', 'Завершить испытание Рики', '🗡️'],
  ['BURNING SOUL', 'Завершить испытание Клинкза', '🔥'],
  ['BRAIN DAMAGE', 'Ответить правильно минимум на пять вопросов', '🧠'],
  ['SURVIVOR', 'Продержаться в паблике 30 секунд', '🛡️'],
  ['BOSS SLAYER', 'Победить финального босса', '💀'],
  ['IMMORTAL', 'Открыть праздничный сундук', '🎁'],
  ['NOT A BOT?', 'Набрать 150 очков в одном испытании', '🤖'],
  ['SECRET FINDER', 'Найти секретную комнату', '🗝️'],
  ['THE REAL 322', 'Открыть скрытый титул', '🏆']
];

function persist() { localStorage.setItem(STORE, JSON.stringify(state)); }
function later(fn, ms) {
  const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
  timers.add(id); return id;
}
function every(fn, ms) {
  const id = setInterval(fn, ms); timers.add(id); return id;
}
function clearTimer(id) { clearTimeout(id); clearInterval(id); timers.delete(id); }
function stopScreenWork() {
  timers.forEach(id => { clearTimeout(id); clearInterval(id); });
  timers.clear();
  if (typeof currentCleanup === 'function') currentCleanup();
  currentCleanup = null;
}
function render(html) {
  stopScreenWork();
  screen.innerHTML = html;
  screen.classList.remove('screen-enter');
  void screen.offsetWidth;
  screen.classList.add('screen-enter');
  decorateScreen();
  window.scrollTo({ top: 0, behavior: state.animations ? 'smooth' : 'auto' });
}
function toast(message) {
  const el = $('#toast'); if (!el) return;
  el.textContent = message; el.classList.add('show');
  later(() => el.classList.remove('show'), 2300);
}
function complete(id) { if (!state.completed.includes(id)) state.completed.push(id); persist(); }
function award(id) {
  if (!state.achievements.includes(id)) {
    state.achievements.push(id); persist(); toast(`ДОСТИЖЕНИЕ ОТКРЫТО: ${id}`); sound('achievement');
  }
}
function ensureAudio() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}
function startAmbientMusic() {
  if (musicStarted || Number(state.music) === 0) return;
  try {
    ensureAudio();
    musicGain = audioContext.createGain();
    musicGain.gain.value = state.sound ? Number(state.music) / 100 * 0.035 : 0;
    musicGain.connect(audioContext.destination);
    [55, 82.41, 110].forEach((frequency, index) => {
      const osc = audioContext.createOscillator();
      const voiceGain = audioContext.createGain();
      osc.type = index === 1 ? 'sine' : 'triangle';
      osc.frequency.value = frequency;
      voiceGain.gain.value = index === 0 ? 0.45 : 0.18;
      osc.connect(voiceGain); voiceGain.connect(musicGain); osc.start();
      musicOscillators.push(osc);
    });
    musicStarted = true;
  } catch { /* Ambient music is optional. */ }
}
function updateMusicVolume() {
  if (musicGain && audioContext) musicGain.gain.setTargetAtTime(state.sound ? Number(state.music) / 100 * 0.035 : 0, audioContext.currentTime, 0.08);
  if ((!state.sound || Number(state.music) === 0) && musicGain) musicGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
  else if (!musicStarted && Number(state.music) > 0) startAmbientMusic();
}
function sound(kind = 'click') {
  if (!state.sound || Number(state.effects) === 0) return;
  try {
    ensureAudio();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const notes = { click: [520, 0.055], hit: [740, 0.09], miss: [150, 0.12], kill: [880, 0.22], achievement: [1040, 0.3], victory: [660, 0.5] };
    const [frequency, duration] = notes[kind] || notes.click;
    osc.type = kind === 'miss' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(frequency, now);
    if (kind === 'achievement' || kind === 'victory') osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration);
    gain.gain.setValueAtTime(Math.min(0.08, Number(state.effects) / 1000), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.start(now); osc.stop(now + duration);
  } catch { /* Audio is optional; gameplay must work without it. */ }
}
function nav(title, subtitle = '') { return `<div class="eyebrow">${subtitle}</div><h1 class="title">${title}</h1>`; }
function panelStat(label, value, id = '') { return `<div class="panel"><div class="eyebrow">${label}</div><div class="stat" ${id ? `id="${id}"` : ''}>${value}</div></div>`; }
function randomJoke() { return jokes[Math.floor(Math.random() * jokes.length)]; }
function setNavActive(name) { document.querySelectorAll('.nav [data-screen]').forEach(b => b.classList.toggle('active', b.dataset.screen === name)); }

function home() {
  setNavActive('home');
  const progress = Math.round((state.completed.length / 10) * 100);
  render(`<section class="hero-stage">
    <div class="cover-index"><b>OPERATION 322</b> &nbsp; / &nbsp; BIRTHDAY RAID</div>
    <div class="cover-coordinate"><b>EU WEST · 02:22 AM</b> MATCH FOUND // PROBABLY</div>
    <div class="hero-figure riki">
      <img src="art/riki-portrait.svg" alt="Авторская стилизованная иллюстрация Рики" fetchpriority="high">
      <div class="hero-label">RIKI · THE STEALTH ASSASSIN</div>
    </div>
    <div class="hero-center">
      <div class="eyebrow">UNOFFICIAL DOTA 2 BIRTHDAY SPECIAL</div>
      <div class="hero-badge"><i></i> A LEGENDARY BAD DECISION SINCE DAY ONE</div>
      <h1 class="title">PRREACHER<span>2K MMR // IMMORTAL DELUSION</span></h1>
      <p class="subtitle">Один игрок. Два героя. Ноль понимания происходящего на карте. Сегодня даже Габен не сможет отменить этот матч.</p>
      <div class="button-row">
        <button class="btn" data-action="start"><span>▶</span> НАЧАТЬ РЕЙД <span>↗</span></button>
        <button class="btn secondary" data-screen="profile">ДОСЬЕ ИГРОКА <span>↗</span></button>
      </div>
      <div class="button-row hero-micro"><span><b>WARNING:</b> SKILL NOT FOUND</span><span>◆</span><span>GABEN IS WATCHING</span></div>
    </div>
    <div class="hero-figure clinkz">
      <img src="art/clinkz-portrait.svg" alt="Авторская стилизованная иллюстрация Клинкза" fetchpriority="high">
      <div class="hero-label">CLINKZ · THE BONE FLETCHER</div>
    </div>
    <div class="cover-bottom"><span>01 <i></i> THE LAST FEEDER CHRONICLES</span><span>SCROLL TO INSPECT THE DAMAGE &nbsp; ↓</span></div>
  </section>
  <section class="home-dashboard" aria-label="Состояние игрока">
    <article class="panel dashboard-card"><div class="dashboard-top"><span>PLAYER STATUS</span><b>● ONLINE</b></div><div class="dashboard-main">PRREACHER <em>· 2K</em></div><div class="dashboard-foot">Уровень угрозы: критически смешной</div></article>
    <article class="panel dashboard-card"><div class="dashboard-top"><span>CAMPAIGN PROGRESS</span><b>${progress}%</b></div><div class="dashboard-main">${state.completed.length}<em> / 10</em> ЭТАПОВ</div><div class="mini-meter"><i style="width:${progress}%"></i></div></article>
    <article class="panel dashboard-card"><div class="dashboard-top"><span>GLOBAL WARNING</span><b>322 DETECTED</b></div><div class="dashboard-main">MAP AWARENESS <em>—</em></div><div class="dashboard-foot">Последний раз замечена: неизвестно</div></article>
  </section>
  <section class="mission-strip" aria-label="Состав операции">
    <div class="mission-cell"><small>MISSION BRIEF // 001</small><b>THE BIRTHDAY INCIDENT</b><p>Разобраться, как этот человек всё ещё получает рейтинг.</p></div>
    <div class="mission-cell"><small>AVAILABLE OPERATORS</small><b>RIKI + CLINKZ</b><p>Стелс, огонь и коллективное разочарование.</p></div>
    <div class="mission-cell"><small>EXPECTED OUTCOME</small><b>IMMORTAL? MAYBE.</b><p>Шанс на победу математически не подтверждён.</p></div>
  </section>`);
}

function matchmaking() {
  render(`${nav('MATCHMAKING', 'ИЩЕМ СОЮЗНИКОВ')}<div class="panel center"><div class="stat">⌛</div><h2 class="card-title">Поиск игроков с аналогичным уровнем страданий…</h2><p class="muted" id="matchMsg">Проверяем доступность адекватных тиммейтов.</p><div class="progress"><i id="matchBar"></i></div><div class="button-row"><button class="btn secondary" data-screen="home">ОТМЕНА ПОИСКА</button></div></div>`);
  let n = 0;
  const msgs = ['Система анализирует последние 100 смертей…', 'Найдено 4 союзника. Все уже тильтуют.', 'Проверяем, умеет ли игрок открывать мини-карту…', 'MATCH FOUND'];
  every(() => { n++; const bar = $('#matchBar'), msg = $('#matchMsg'); if (!bar || !msg) return;
    bar.style.width = `${n * 25}%`; msg.textContent = msgs[n - 1];
    if (n === 4) { stopScreenWork(); later(heroSelect, 700); }
  }, 850);
}
function heroSelect() {
  render(`${nav('CHOOSE YOUR HERO', 'ФАЗА ПИКА // SELECT YOUR DISASTER')}<p class="subtitle">Выбери персонажа. Ответственность за последующие 30 смертей разработчики не несут.</p><div class="grid hero-select-grid">
    <article class="panel hero-choice riki-pick"><div class="hero-pick-top"><span>AGILITY · MELEE</span><b>01 / 02</b></div><div class="hero-pick-art"><img src="art/riki-portrait.svg" alt="Riki"></div><div class="hero-pick-copy"><div class="eyebrow">THE STEALTH ASSASSIN</div><h2 class="card-title">RIKI</h2><p class="muted">Исчезает с карты быстрее, чем желание команды продолжать эту катку. Идеален для тех, кто любит заходить за спину и выходить из ответственности.</p><div class="hero-pick-meta"><span>BLINK STRIKE</span><span>SMOKE SCREEN</span><span>PERMANENT INVISIBILITY</span></div><button class="btn" data-action="pick" data-hero="Riki">LOCK RIKI <span>↗</span></button></div></article>
    <article class="panel hero-choice clinkz-pick"><div class="hero-pick-top"><span>AGILITY · RANGED</span><b>02 / 02</b></div><div class="hero-pick-art"><img src="art/clinkz-portrait.svg" alt="Clinkz"></div><div class="hero-pick-copy"><div class="eyebrow">THE BONE FLETCHER</div><h2 class="card-title">CLINKZ</h2><p class="muted">Сначала поджигает врагов, потом собственную экономику. Его огненные стрелы не спасают от вопросов по закупке.</p><div class="hero-pick-meta"><span>BURNING BARRAGE</span><span>SKELETON WALK</span><span>DEATH PACT</span></div><button class="btn fire" data-action="pick" data-hero="Clinkz">LOCK CLINKZ <span>↗</span></button></div></article>
  </div>`);
}
function loading() {
  render(`${nav('LOADING MATCH', 'ПОДГОТОВКА К БОЮ')}<div class="panel center"><div class="loading-emblem">⚔</div><h2 class="card-title">GAME STARTING...</h2><p class="muted">${randomJoke()}</p><div class="progress"><i id="loadBar"></i></div></div>`);
  let n = 0;
  every(() => { n += 10; const bar = $('#loadBar'); if (!bar) return; bar.style.width = `${n}%`; if (n >= 100) { stopScreenWork(); later(rikiGame, 250); } }, 180);
}
function rikiGame() { startClickGame('INVISIBLE KILLER', 'Рики просит доказать, что ты способен попасть хотя бы по экрану.', '✦', 'riki'); }
function clinkzGame() { startClickGame('BURNING ARROWS', 'Клинкз выдал тебе стрелы. Не потрать их на воздух.', '✹', 'clinkz'); }
function startClickGame(title, description, symbol, id) {
  let time = 30, score = 0, spawned = 0;
  render(`${nav(title, 'МИНИ-ИГРА')}<p class="subtitle">${description}</p><div class="grid three">${panelStat('TIME', time, 'time')}${panelStat('SCORE', score, 'points')}${panelStat('PERSONAL RECORD', state[`${id}Record`], 'record')}</div><div class="game-area" id="arena" role="group" aria-label="Игровое поле"></div><p class="muted center">Нажимай на появляющиеся цели. За промах по пустому полю очки не начисляются.</p>`);
  const arena = $('#arena');
  function spawn() {
    if (!$('#arena') || spawned > 75) return;
    spawned++;
    const target = document.createElement('button'); target.className = 'target'; target.textContent = symbol;
    target.setAttribute('aria-label', 'Цель');
    target.style.left = `${4 + Math.random() * 88}%`; target.style.top = `${5 + Math.random() * 78}%`;
    target.style.animationDuration = `${0.8 + Math.random()}s`;
    target.addEventListener('click', event => {
      event.stopPropagation(); if (target.dataset.hit) return; target.dataset.hit = '1';
      score += 10; state.totalHits++; state.kills++; $('#points').textContent = score;
      target.classList.add('hit-target'); sound('hit'); target.textContent = '✧';
      if (score === 10) award('FIRST BLOOD');
      if (score % 50 === 0) cinematicKill(score / 50);
      if (score >= 150) award('NOT A BOT?');
      persist(); later(() => target.remove(), 150);
    });
    arena.append(target); later(() => target.remove(), 1350);
  }
  const spawnTimer = every(spawn, id === 'riki' ? 650 : 520);
  const countdown = every(() => {
    time--; const timeEl = $('#time'); if (!timeEl) return;
    timeEl.textContent = time;
    if (time <= 0) {
      clearTimer(spawnTimer); stopScreenWork();
      state.score += score; state[`${id}Record`] = Math.max(score, state[`${id}Record`]);
      complete(id); award(id === 'riki' ? 'INVISIBLE KILLER' : 'BURNING SOUL'); persist();
      result(title, score, id === 'riki' ? clinkzGame : quiz);
    }
  }, 1000);
  currentCleanup = () => { clearTimer(countdown); clearTimer(spawnTimer); };
}
function cinematicKill(streak) {
  const names = ['FIRST BLOOD', 'DOUBLE KILL', 'TRIPLE KILL', 'ULTRA KILL', 'RAMPAGE'];
  const phrases = ['Наконец-то попал', 'Два раза повезло', 'Неужели проснулся?', 'Срочно проверь, не подменили ли игрока', 'Сервер требует расследования'];
  const idx = Math.min(streak - 1, names.length - 1);
  const layer = document.createElement('div'); layer.className = 'cinematic-overlay';
  layer.innerHTML = `<div class="cinematic-kill"><span>${names[idx]}</span><small>${phrases[idx]}</small></div>`;
  document.body.append(layer); sound('kill'); later(() => layer.remove(), 1450);
  toast(`${names[idx]} — ${phrases[idx]}`);
}
function result(title, score, next) {
  render(`${nav('РЕЗУЛЬТАТ', 'ИСПЫТАНИЕ ЗАВЕРШЕНО')}<div class="panel center"><div class="kill-banner">GG WP</div><div class="stat">${score}</div><p class="muted">Очков набрано. ${score >= 100 ? 'Подозрительно хороший результат.' : 'Даже крип ожидал большего.'}</p><button class="btn" id="next">ПРОДОЛЖИТЬ</button></div>`);
  $('#next').onclick = () => { sound('click'); next(); };
}
function quiz() { questionIndex = 0; state.quizScore = 0; renderQuestion(); }
function renderQuestion() {
  const q = questions[questionIndex];
  render(`${nav('INTELLIGENCE TEST', 'ПРОВЕРКА МОЗГОВ')}<div class="panel"><div class="eyebrow">ВОПРОС ${questionIndex + 1} ИЗ 7</div><div class="progress"><i style="width:${(questionIndex / questions.length) * 100}%"></i></div><h2 class="card-title" style="margin-top:20px">${q[0]}</h2>${q[1].map((answer, i) => `<button class="choice" data-answer="${i}">${answer}</button>`).join('')}<p class="muted" id="answerMsg" aria-live="polite"></p></div>`);
}
function answerQuestion(index, button) {
  const q = questions[questionIndex], correct = index === q[2];
  button.classList.add(correct ? 'correct' : 'wrong'); sound(correct ? 'hit' : 'miss');
  if (correct) state.quizScore++;
  $('.panel').querySelectorAll('[data-answer]').forEach(el => { el.disabled = true; });
  $('#answerMsg').textContent = correct ? 'Верно. Неужели мозг найден?' : 'Неверно. Даже крип разочарован.';
  later(() => {
    questionIndex++;
    if (questionIndex < questions.length) renderQuestion();
    else {
      const score = state.quizScore; state.quizBest = Math.max(score, state.quizBest); complete('quiz');
      if (score >= 5) award('BRAIN DAMAGE'); persist(); result('INTELLIGENCE', score * 10, survival);
    }
  }, 850);
}
function survival() {
  let time = 30, dodges = 0, currentEvent = 0, activeThreat = false;
  const events = [
    ['Союзник украл крипов!', 'КРИПЫ УШЛИ. ДОВЕРИЕ ТОЖЕ.'], ['Враг активировал Blade Mail!', 'НЕ БЕЙ В НЕГО. ХОТЯ БЫ СЕЙЧАС.'],
    ['В чат прилетело загадочное ?', 'ПСИХОЛОГИЧЕСКАЯ АТАКА.'], ['Тиммейт из 2K объясняет макро!', 'СРОЧНО УКЛОНЯЙСЯ ОТ СОВЕТА.'],
    ['Команда начала драку 4 на 5!', 'КЛАССИЧЕСКИЙ ПЛАН.'], ['Кто-то купил непонятный предмет!', 'ИНВЕНТАРЬ НЕ ВЫДЕРЖИВАЕТ.']
  ];
  render(`${nav('SURVIVAL MODE', 'ВЫЖИВАНИЕ В ПАБЛИКЕ')}<div class="panel center"><div class="stat" id="survTime">30</div><h2 class="card-title">ПРОДЕРЖИСЬ 30 СЕКУНД</h2><div class="threat-card" id="event">Загрузка угроз…</div><p class="muted" id="eventTip">Жми «Уклониться», пока угроза активна.</p><div class="button-row"><button class="btn" id="dodge">УКЛОНИТЬСЯ</button><button class="btn secondary" id="ignore">СДЕЛАТЬ ВИД, ЧТО НЕ ЗАМЕТИЛ</button></div><p class="muted">Уклонений: <b id="dodges">0</b></p></div>`);
  const eventTimer = every(() => {
    const event = events[currentEvent++ % events.length]; activeThreat = true;
    $('#event').textContent = event[0]; $('#eventTip').textContent = event[1];
    $('#event').classList.add('threat-active');
    later(() => { activeThreat = false; $('#event')?.classList.remove('threat-active'); }, 650);
  }, 1150);
  $('#dodge').onclick = () => {
    if (activeThreat) { dodges++; $('#dodges').textContent = dodges; toast('УКЛОНЕНИЕ!'); sound('hit'); }
    else { toast('Уклоняться не от чего. Но попытка засчитана за инициативу.'); sound('miss'); }
  };
  $('#ignore').onclick = () => { $('#eventTip').textContent = 'Ты проигнорировал проблему. Классический паб.'; sound('click'); };
  const countdown = every(() => {
    time--; $('#survTime').textContent = time;
    if (time <= 0) {
      clearTimer(eventTimer); stopScreenWork(); state.survivalBest = Math.max(state.survivalBest, dodges);
      complete('survival'); award('SURVIVOR'); persist(); result('SURVIVAL', dodges * 10, boss);
    }
  }, 1000);
  currentCleanup = () => { clearTimer(eventTimer); clearTimer(countdown); };
}
function boss() {
  bossHp = 100; bossPhase = 1; bossStreak = 0;
  render(`${nav('THE LAST FEEDER', 'ФИНАЛЬНЫЙ БОСС')}<div class="panel center boss-panel"><div class="eyebrow">BOSS HP · PHASE <span id="bossPhase">1</span></div><div class="progress boss-progress"><i id="bossBar" style="width:100%"></i></div><div class="boss"><img src="art/last-feeder.svg" alt="The Last Feeder" loading="eager"></div><h2 class="card-title">PRREACHER</h2><div class="kill-banner">THE LAST FEEDER</div><p class="muted" id="bossLine">«Я не фижу. Просто команда не понимает мой гениальный план»</p><div class="boss-actions"><button class="btn" data-hit="12" data-line="Проверка на адекватность">ПРОВЕРКА НА АДЕКВАТНОСТЬ</button><button class="btn" data-hit="18" data-line="Открой карту">ОТКРОЙ КАРТУ</button><button class="btn fire" data-hit="22" data-line="Купи нормальные предметы">КУПИ НОРМАЛЬНЫЕ ПРЕДМЕТЫ</button><button class="btn gold" data-hit="30" data-line="Report prreacher">REPORT PRREACHER</button></div><div class="divider"></div><div class="feed" id="feed"><div>SERVER: PRREACHER JOINED THE GAME</div><div>WARNING: SKILL NOT FOUND</div></div><p class="muted" id="bossTaunt">Босс готовит очередную сомнительную закупку.</p></div>`);
}
function hitBoss(damage, line) {
  if (bossHp <= 0) return;
  bossHp = Math.max(0, bossHp - damage); bossStreak++; state.kills++; persist();
  const bar = $('#bossBar'); if (bar) bar.style.width = `${bossHp}%`;
  const bossArt = $('.boss'); if (bossArt) { bossArt.classList.remove('boss-hit'); void bossArt.offsetWidth; bossArt.classList.add('boss-hit'); later(() => bossArt.classList.remove('boss-hit'), 420); }
  const phase = bossHp <= 30 ? 3 : bossHp <= 65 ? 2 : 1;
  if (phase !== bossPhase) { bossPhase = phase; $('#bossPhase').textContent = phase; $('.boss-panel')?.classList.remove('phase-1', 'phase-2', 'phase-3'); $('.boss-panel')?.classList.add(`phase-${phase}`); toast(`ФАЗА ${phase}: БОСС ТИЛЬТУЕТ`); }
  $('#bossLine').textContent = `Способность: ${line}. ${randomJoke()}`;
  const feed = $('#feed');
  const entries = ['FIRST BLOOD — Наконец-то попал', 'DOUBLE KILL — Два раза повезло', 'TRIPLE KILL — Неужели проснулся?', 'ULTRA KILL — Проверьте, не подменили ли игрока', 'RAMPAGE — Сервер требует расследования'];
  const idx = Math.min(bossStreak - 1, entries.length - 1);
  feed.innerHTML = `<div>${entries[idx]}</div>` + feed.innerHTML;
  $('#bossTaunt').textContent = bossHp <= 30 ? '«ДА Я ПРОСТО НЕ НА СВОЁМ РЕЙТИНГЕ ИГРАЮ!»' : '«У меня был план. Команда опять не поняла»';
  sound('kill'); if (bossHp === 0) { stopScreenWork(); complete('boss'); state.bossWins++; award('BOSS SLAYER'); persist(); later(victory, 700); }
}
function victory() {
  complete('victory'); sound('victory');
  render(`<div class="center victory-screen"><div class="eyebrow">MATCH CONCLUDED</div><h1 class="title victory-title">VICTORY</h1><div class="kill-banner">PRREACHER HAS FINALLY WON SOMETHING</div><p class="subtitle" style="margin:20px auto">Ты победил самого себя. Это уже достижение.</p><div class="button-row"><button class="btn gold" data-action="treasure">OPEN IMMORTAL TREASURE</button></div></div>`);
}
function treasure() {
  render(`${nav('IMMORTAL TREASURE', 'НАГРАДА ЗА ПОБЕДУ')}<div class="panel center"><div class="treasure">♜</div><h2 class="card-title">BIRTHDAY IMMORTAL</h2><p class="muted">Содержимое: +100 к удаче, +0 к MMR, +999 к настроению.</p><button class="btn gold" id="openChest">ОТКРЫТЬ СУНДУК</button><div id="reward"></div></div>`);
  $('#openChest').onclick = () => {
    $('#reward').innerHTML = `<div class="divider"></div><div class="kill-banner">PUB LEGEND</div><p>Титул получен. MMR всё ещё под вопросом.</p><button class="btn" data-action="letter">ПОЛУЧИТЬ ПОЗДРАВЛЕНИЕ</button>`;
    award('IMMORTAL'); complete('treasure'); sound('achievement');
  };
}
function letter() {
  render(`${nav('A MESSAGE FROM MASHORKA', 'ПОСЛЕДНЕЕ И САМОЕ ВАЖНОЕ')}<div class="panel letter-panel"><div class="letter">Брат, с днём рождения!

Ну что, очередной год прожит. Сколько часов проведено в Dota, сколько нервных клеток уничтожено, сколько союзников отправлено в психологическую реабилитацию.

Твои игровые достижения, конечно, вызывают вопросы. Иногда кажется, что ты не поднимаешь MMR, а просто проверяешь, насколько низко вообще можно упасть.

Но если убрать весь этот цирк, есть кое-что гораздо важнее.

Я рад, что мы знакомы. Спасибо за совместные моменты, приколы, катки и всю ту дичь, которую мы успели пережить.

Желаю тебе здоровья, счастья, удачи, денег, исполнения желаний и людей рядом, на которых всегда можно положиться.

Пусть в жизни будет больше побед, чем поражений, больше поводов улыбаться и меньше причин тильтовать.

С днём рождения, легенда.

GG WP, BRO ❤️

— Mashorka</div><div class="divider"></div><div class="center"><button class="btn" data-action="secret">НАЙТИ СЕКРЕТНУЮ КОМНАТУ</button></div></div>`);
  complete('letter');
}
function secret() {
  render(`${nav('HIDDEN ROOM', 'СЕКРЕТНАЯ ЛОКАЦИЯ')}<div class="panel center"><div class="treasure">⌘</div><h2 class="card-title">YOU FOUND SOMETHING USELESS</h2><p class="subtitle" style="margin:auto">Just like your last purchase.</p><p class="muted">Секретный титул: THE REAL 322</p><button class="btn gold" data-action="finish">ЗАБРАТЬ ТИТУЛ</button></div>`);
  award('SECRET FINDER'); award('THE REAL 322'); complete('secret');
}
function finish() {
  render(`${nav('CAMPAIGN COMPLETE', 'GG WP, BRO')}<div class="panel center"><div class="stat">🏆</div><h2 class="card-title">С ДНЁМ РОЖДЕНИЯ, PRREACHER!</h2><p class="muted">Ты прошёл путь от сомнительного пика до сомнительной легенды.</p><button class="btn" data-screen="profile">ПОСМОТРЕТЬ ПРОФИЛЬ</button></div>`);
}
function profile() {
  setNavActive('profile');
  const title = state.achievements.includes('THE REAL 322') ? 'THE REAL 322' : 'UNRANKED LEGEND';
  const pct = Math.round((state.completed.length / 10) * 100);
  render(`${nav('PLAYER DOSSIER', 'ЛИЧНОЕ ДЕЛО // SUBJECT: PRREACHER')}<section class="profile-hero panel">
    <div class="profile-emblem">P<span>✦</span></div>
    <div class="profile-main"><div class="eyebrow">SUBJECT IDENTIFIED · STEAM ACCOUNT</div><h2 class="profile-name">PRREACHER</h2><p class="profile-subtitle">${title} <span>◆</span> ACTIVE PUB SURVIVOR</p><div class="profile-tags"><span class="tag">2K MMR ENERGY</span><span class="tag">MAP NOT FOUND</span><span class="tag">GABEN'S PROBLEM</span></div></div>
    <div class="profile-level"><small>CAMPAIGN COMPLETION</small><b>${pct}%</b><div class="progress"><i style="width:${pct}%"></i></div><span>${state.completed.length} / 10 OPERATIONS</span></div>
  </section>
  <div class="grid three profile-stats">
    ${panelStat('SITE SCORE', state.score)}${panelStat('CONFIRMED HITS', state.totalHits)}${panelStat('ACHIEVEMENTS', `${state.achievements.length}/${achievementsList.length}`)}
  </div>
  <section class="grid profile-lower">
    <article class="panel"><div class="eyebrow">COMBAT RECORD // LOCAL SAVE</div><h3 class="card-title">FIELD PERFORMANCE</h3><div class="record-row"><span>RIKI · REACTION TEST</span><b>${state.rikiRecord}</b></div><div class="record-row"><span>CLINKZ · REACTION TEST</span><b>${state.clinkzRecord}</b></div><div class="record-row"><span>INTELLIGENCE CHECK</span><b>${state.quizBest}/7</b></div><div class="record-row"><span>SURVIVAL DODGES</span><b>${state.survivalBest}</b></div><div class="record-row"><span>BOSS VICTORIES</span><b>${state.bossWins}</b></div></article>
    <article class="panel stratz-panel"><div class="eyebrow">EXTERNAL INTEL // DOTA 2</div><div class="stratz-brand">STRATZ<span>///</span></div><h3 class="card-title">PROFILE LINKED</h3><p class="muted">Профиль prreacher подключён как внешний источник. Настоящие цифры живут здесь — мы не будем рисовать ему 12 000 MMR в фотошопе.</p><div class="stratz-id"><small>STEAM ACCOUNT ID</small><b>1786601890</b></div><a class="btn stratz-link" href="https://stratz.com/players/1786601890" target="_blank" rel="noopener noreferrer">OPEN STRATZ PROFILE <span>↗</span></a><p class="muted small-note">Автоматическая загрузка матчей и ранга требует STRATZ API и защищённого серверного ключа.</p></article>
  </section>
  <div class="panel profile-versus"><div><div class="eyebrow">RIVALRY DATA</div><h3 class="card-title">PRREACHER <span style="color:var(--fire)">VS</span> MASHORKA</h3><p class="muted">Счётчик унижений пока не подключён — Mashorka не предоставил Steam ID.</p></div><div class="versus-stamp">VS</div><div class="versus-state"><b>DATA PENDING</b><small>AWAITING SECOND PLAYER</small></div></div>`);
}

function achievements() {
  setNavActive('achievements');
  render(`${nav('ACHIEVEMENTS', 'ТВОИ НАГРАДЫ')}<div class="grid">${achievementsList.map(([name, description, icon]) => `<div class="panel achievement ${state.achievements.includes(name) ? '' : 'locked'}"><div class="medal">${icon}</div><div><b>${name}</b><div class="muted">${state.achievements.includes(name) ? 'Получено' : description}</div></div></div>`).join('')}</div>`);
}
function settings() {
  setNavActive('settings');
  render(`${nav('SETTINGS', 'НАСТРОЙКИ ИГРЫ')}<div class="panel settings-panel"><label>Громкость эффектов <output id="effectsValue">${state.effects}%</output><input class="range" type="range" min="0" max="100" value="${state.effects}" id="effects"></label><label>Громкость музыки <output id="musicValue">${state.music}%</output><input class="range" type="range" min="0" max="100" value="${state.music}" id="music"></label><label class="setting-check"><input type="checkbox" id="animations" ${state.animations ? 'checked' : ''}> Включить анимации</label><label class="setting-check"><input type="checkbox" id="reduced" ${state.reducedEffects ? 'checked' : ''}> Упрощённые эффекты</label><div class="divider"></div><div class="button-row"><button class="btn secondary" id="soundTest">ПРОВЕРИТЬ ЗВУК</button><button class="btn secondary" id="reset">СБРОСИТЬ ПРОГРЕСС</button></div></div>`);
  $('#effects').oninput = e => { state.effects = +e.target.value; $('#effectsValue').textContent = `${state.effects}%`; persist(); };
  $('#music').oninput = e => { state.music = +e.target.value; $('#musicValue').textContent = `${state.music}%`; updateMusicVolume(); persist(); };
  $('#animations').onchange = e => { state.animations = e.target.checked; document.body.classList.toggle('no-animations', !state.animations); window.dispatchEvent(new Event('prreacher:motion')); persist(); };
  $('#reduced').onchange = e => { state.reducedEffects = e.target.checked; document.body.classList.toggle('reduced-effects', state.reducedEffects); persist(); };
  $('#soundTest').onclick = () => { sound('achievement'); toast(state.sound ? 'Проверка звука' : 'Сначала включи звук в верхнем меню'); };
  $('#reset').onclick = () => { if (confirm('Точно сбросить весь прогресс и достижения?')) { localStorage.removeItem(STORE); location.reload(); } };
}
function start() { complete('start'); matchmaking(); }


// Premium ambience: lightweight canvas particles and per-screen reveal/tilt details.
let revealObserver = null;
function decorateScreen() {
  if (revealObserver) revealObserver.disconnect();
  const revealItems = screen.querySelectorAll('.panel, .mission-strip, .home-dashboard');
  if ('IntersectionObserver' in window && state.animations) {
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealItems.forEach((item, index) => {
      item.classList.add('reveal');
      item.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
      revealObserver.observe(item);
    });
  }
}

(function startAtmosphere() {
  const canvas = $('#starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let width = 0, height = 0, stars = [], frame = 0, raf = 0;
  const pointer = { x: -1000, y: -1000 };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const amount = Math.min(115, Math.max(34, Math.floor(width / 11)));
    stars = Array.from({ length: amount }, () => ({ x: Math.random() * width, y: Math.random() * height, r: Math.random() * 1.3 + .25, a: Math.random() * .45 + .1, s: Math.random() * .18 + .035, phase: Math.random() * 6.28, warm: Math.random() > .78 }));
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const p of stars) {
      p.phase += .012;
      if (!reduce && state.animations && !document.hidden) p.y -= p.s;
      if (p.y < -3) { p.y = height + 3; p.x = Math.random() * width; }
      const alpha = p.a * (.7 + Math.sin(p.phase) * .3);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.warm ? `rgba(238,193,128,${alpha})` : `rgba(198,190,255,${alpha})`; ctx.fill();
    }
    frame++;
    if (!reduce && state.animations && !document.hidden) raf = requestAnimationFrame(draw);
  }
  resize(); draw();
  window.addEventListener('prreacher:motion', () => { cancelAnimationFrame(raf); draw(); });
  window.addEventListener('resize', () => { resize(); if (!reduce && state.animations && !document.hidden) { cancelAnimationFrame(raf); draw(); } });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce && state.animations) draw();
  });
  window.addEventListener('pointermove', event => {
    pointer.x = event.clientX; pointer.y = event.clientY;
    const aura = $('.pointer-aura');
    if (aura && !state.reducedEffects) aura.style.transform = `translate(${pointer.x}px,${pointer.y}px) translate(-50%,-50%)`;
  }, { passive: true });
})();

screen.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' || window.innerWidth < 760) return;
  const card = event.target.closest('.panel');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`);
  card.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`);
});

$('#app').addEventListener('click', event => {
  const screenButton = event.target.closest('[data-screen]');
  if (screenButton) {
    const target = screenButton.dataset.screen;
    ({ home, profile, achievements, settings }[target] || home)(); sound('click'); return;
  }
  const action = event.target.closest('[data-action]');
  if (action) {
    const type = action.dataset.action; sound('click');
    if (type === 'start') start();
    if (type === 'pick') { state.hero = action.dataset.hero; persist(); loading(); }
    if (type === 'treasure') treasure();
    if (type === 'letter') letter();
    if (type === 'secret') secret();
    if (type === 'finish') finish();
    return;
  }
  const hit = event.target.closest('[data-hit]');
  if (hit) { hitBoss(Number(hit.dataset.hit), hit.dataset.line); return; }
  const answer = event.target.closest('[data-answer]');
  if (answer) { answerQuestion(Number(answer.dataset.answer), answer); return; }
});
$('#soundToggle').onclick = () => {
  state.sound = !state.sound; persist();
  $('#soundToggle').innerHTML = `<span class="sound-bars"><i></i><i></i><i></i><i></i></span><span>${state.sound ? 'ЗВУК' : 'ВЫКЛ'}</span>`; document.body.classList.toggle('sound-off', !state.sound);
  updateMusicVolume();
  if (state.sound) { sound('click'); startAmbientMusic(); }
  toast(state.sound ? 'Звук включён' : 'Звук выключен');
};
['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, () => startAmbientMusic(), { once: true }));
// Hidden keyboard easter egg: type 3-2-2 anywhere on the main menu.
document.addEventListener('keydown', event => {
  if (!['3', '2'].includes(event.key)) return;
  secretSequence.push(event.key); secretSequence = secretSequence.slice(-3);
  if (secretSequence.join('') === '322') { secretSequence = []; toast('СЕКРЕТНЫЙ КОД ОБНАРУЖЕН'); secret(); }
});
if (!state.animations) document.body.classList.add('no-animations');
if (state.reducedEffects) document.body.classList.add('reduced-effects');
$('#soundToggle').innerHTML = `<span class="sound-bars"><i></i><i></i><i></i><i></i></span><span>${state.sound ? 'ЗВУК' : 'ВЫКЛ'}</span>`; document.body.classList.toggle('sound-off', !state.sound);
home();
