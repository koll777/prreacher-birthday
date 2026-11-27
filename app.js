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
function render(html) { stopScreenWork(); screen.innerHTML = html; window.scrollTo({ top: 0, behavior: state.animations ? 'smooth' : 'auto' }); }
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
  render(`<section class="hero-stage">
    <div class="hero-figure riki"><div class="hero-silhouette" aria-label="Riki">♜</div><div class="hero-label">RIKI · THE STEALTH ASSASSIN</div></div>
    <div class="hero-center"><div class="eyebrow">UNOFFICIAL DOTA 2 BIRTHDAY SPECIAL</div><h1 class="title">PRREACHER<br><span>2K MMR EDITION</span></h1><p class="subtitle">Одна легенда. Шестнадцать разделов. Ноль гарантий на победу.</p><div class="button-row"><button class="btn" data-action="start">▶ START GAME</button><button class="btn secondary" data-screen="profile">PLAYER PROFILE</button></div><div class="button-row"><span class="tag">WARNING: SKILL NOT FOUND</span><span class="tag">GABEN IS WATCHING</span></div></div>
    <div class="hero-figure clinkz"><div class="hero-silhouette" aria-label="Clinkz">♨</div><div class="hero-label">CLINKZ · THE BONE FLETCHER</div></div>
  </section>
  <div class="grid three"><div class="panel"><div class="eyebrow">PLAYER STATUS</div><h3 class="card-title">PRREACHER</h3><p class="muted">Уровень угрозы: сомнительный</p></div><div class="panel"><div class="eyebrow">CAMPAIGN PROGRESS</div><h3 class="card-title">${state.completed.length}/10</h3><p class="muted">Этапов кампании завершено</p></div><div class="panel"><div class="eyebrow">GLOBAL WARNING</div><h3 class="card-title">2K MMR DETECTED</h3><p class="muted">Пожалуйста, не кормите игрока после полуночи.</p></div></div>`);
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
  render(`${nav('CHOOSE YOUR HERO', 'ФАЗА ПИКА')}<div class="grid"><div class="panel center hero-choice"><div class="hero-choice-art riki-art">♜</div><h2 class="card-title">RIKI</h2><p class="muted">Невидимый убийца. Видит все твои ошибки.</p><button class="btn" data-action="pick" data-hero="Riki">LOCK RIKI</button></div><div class="panel center hero-choice"><div class="hero-choice-art clinkz-art">♨</div><h2 class="card-title">CLINKZ</h2><p class="muted">Огненные стрелы. Горящие надежды команды.</p><button class="btn fire" data-action="pick" data-hero="Clinkz">LOCK CLINKZ</button></div></div>`);
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
  render(`${nav('THE LAST FEEDER', 'ФИНАЛЬНЫЙ БОСС')}<div class="panel center boss-panel"><div class="eyebrow">BOSS HP · PHASE <span id="bossPhase">1</span></div><div class="progress boss-progress"><i id="bossBar" style="width:100%"></i></div><div class="boss">♛</div><h2 class="card-title">PRREACHER</h2><div class="kill-banner">THE LAST FEEDER</div><p class="muted" id="bossLine">«Я не фижу. Просто команда не понимает мой гениальный план»</p><div class="boss-actions"><button class="btn" data-hit="12" data-line="Проверка на адекватность">ПРОВЕРКА НА АДЕКВАТНОСТЬ</button><button class="btn" data-hit="18" data-line="Открой карту">ОТКРОЙ КАРТУ</button><button class="btn fire" data-hit="22" data-line="Купи нормальные предметы">КУПИ НОРМАЛЬНЫЕ ПРЕДМЕТЫ</button><button class="btn gold" data-hit="30" data-line="Report prreacher">REPORT PRREACHER</button></div><div class="divider"></div><div class="feed" id="feed"><div>SERVER: PRREACHER JOINED THE GAME</div><div>WARNING: SKILL NOT FOUND</div></div><p class="muted" id="bossTaunt">Босс готовит очередную сомнительную закупку.</p></div>`);
}
function hitBoss(damage, line) {
  if (bossHp <= 0) return;
  bossHp = Math.max(0, bossHp - damage); bossStreak++; state.kills++; persist();
  const bar = $('#bossBar'); if (bar) bar.style.width = `${bossHp}%`;
  const phase = bossHp <= 30 ? 3 : bossHp <= 65 ? 2 : 1;
  if (phase !== bossPhase) { bossPhase = phase; $('#bossPhase').textContent = phase; toast(`ФАЗА ${phase}: БОСС ТИЛЬТУЕТ`); }
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
  render(`${nav('PLAYER PROFILE', 'ИГРОК')}<div class="grid"><div class="panel"><div class="eyebrow">NICKNAME</div><h2 class="card-title">PRREACHER</h2><p class="muted">Title: ${state.achievements.includes('THE REAL 322') ? 'THE REAL 322' : 'UNRANKED LEGEND'}</p><div class="divider"></div><div class="eyebrow">SITE SCORE</div><div class="stat">${state.score}</div><p class="muted">Очки мини-игр</p><div class="grid"><div><b>${state.totalHits}</b><p class="muted">Попаданий</p></div><div><b>${state.completed.length}</b><p class="muted">Этапов</p></div></div></div><div class="panel"><div class="eyebrow">DOTA 2 DATA · STRATZ</div><h2 class="card-title">PROFILE LINKED</h2><p class="muted">Профиль prreacher привязан. Открой STRATZ, чтобы посмотреть актуальный MMR, матчи, героев и историю ранга.</p><div class="divider"></div><div class="eyebrow">STEAM ACCOUNT ID</div><div class="stat" style="font-size:25px">1786601890</div><p><span class="tag">STRATZ PROFILE: CONNECTED</span></p><a class="btn stratz-link" href="https://stratz.com/players/1786601890" target="_blank" rel="noopener noreferrer">ОТКРЫТЬ ПРОФИЛЬ В STRATZ ↗</a><p class="muted small-note">Данные не подменяются выдуманными цифрами. Для автоматической загрузки статистики на GitHub Pages потребуется отдельное подключение STRATZ API.</p></div></div><div class="panel" style="margin-top:16px"><h3 class="card-title">PRREACHER VS MASHORKA</h3><p class="muted">Профиль prreacher уже найден. Сравнение появится после добавления профиля Mashorka.</p><div class="grid"><div>PRREACHER<br><b><a href="https://stratz.com/players/1786601890" target="_blank" rel="noopener noreferrer">STRATZ · 1786601890</a></b></div><div>MASHORKA<br><b>PROFILE NOT LINKED</b></div></div></div>`);
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
  $('#animations').onchange = e => { state.animations = e.target.checked; document.body.classList.toggle('no-animations', !state.animations); persist(); };
  $('#reduced').onchange = e => { state.reducedEffects = e.target.checked; document.body.classList.toggle('reduced-effects', state.reducedEffects); persist(); };
  $('#soundTest').onclick = () => { sound('achievement'); toast(state.sound ? 'Проверка звука' : 'Сначала включи звук в верхнем меню'); };
  $('#reset').onclick = () => { if (confirm('Точно сбросить весь прогресс и достижения?')) { localStorage.removeItem(STORE); location.reload(); } };
}
function start() { complete('start'); matchmaking(); }

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
  $('#soundToggle').innerHTML = state.sound ? '♫ <span>ЗВУК</span>' : '♪ <span>ВЫКЛ</span>';
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
$('#soundToggle').innerHTML = state.sound ? '♫ <span>ЗВУК</span>' : '♪ <span>ВЫКЛ</span>';
home();
