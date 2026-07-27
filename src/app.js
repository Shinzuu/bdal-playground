/* BDAL Playground — UI layer. Depends on BDALEngine + BDALLessons globals. */
(function () {
'use strict';

var engine = window.BDALEngine;
var lessons = window.BDALLessons;
var app = document.getElementById('app');

var OS_META = {
  linux: { name: 'Linux / WSL2', detail: 'Ubuntu, EndeavourOS, or WSL2 inside Windows', cmd: 'hadoop-start' },
  mac: { name: 'macOS', detail: 'Apple Silicon or Intel', cmd: 'hadoop-start' },
  windows: { name: 'Windows (native)', detail: 'Hadoop + winutils, the teacher-manual way', cmd: 'start-all.cmd' }
};

// ---------- persistence ----------

function loadJSON(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
}
function getOS() { return loadJSON('bdalp.os', null); }
function setOS(os) { saveJSON('bdalp.os', os); }
function getProgress() {
  var os = getOS();
  var all = loadJSON('bdalp.progress', {});
  return all[os] || { m1: {}, m2: {}, m3: {}, examBest: null };
}
function setProgress(p) {
  var os = getOS();
  var all = loadJSON('bdalp.progress', {});
  all[os] = p;
  saveJSON('bdalp.progress', all);
}

// ---------- tiny dom helpers ----------

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function md(s) { // backtick -> code
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function promptFor(state) {
  if (state.os === 'windows') return engine.cwdString(state) + '>';
  return 'student@' + (state.os === 'mac' ? 'mac' : 'linux') + ':' + engine.cwdString(state) + '$ ';
}

// ---------- header ----------

function headerHTML() {
  var os = getOS();
  return '<header class="top">' +
    '<button class="brand" id="go-home">bdal-playground<span class="tail">$ _</span></button>' +
    (os ? '<button class="oschip" id="switch-os" title="Switch operating system">' + esc(OS_META[os].name) + ' ⇄</button>' : '') +
    '</header>';
}

function bindHeader() {
  var home = document.getElementById('go-home');
  if (home) home.onclick = function () { renderHome(); };
  var sw = document.getElementById('switch-os');
  if (sw) sw.onclick = function () { renderOSPicker(); };
}

// ---------- screens ----------

function renderOSPicker() {
  var cards = Object.keys(OS_META).map(function (os) {
    var m = OS_META[os];
    return '<button class="oscard" data-os="' + os + '">' +
      '<span class="osname">' + esc(m.name) + '</span>' +
      '<span class="osdetail">' + esc(m.detail) + '</span>' +
      '<span class="oscmd">cluster starts with: ' + esc(m.cmd) + '</span>' +
      '</button>';
  }).join('');
  app.innerHTML = headerHTML() +
    '<div class="hero">' +
    '<h1>Learn the lab by typing it.<span class="cursor"></span></h1>' +
    '<p>A simulated Hadoop terminal for the BDAL labs — cluster startup, HDFS commands (Lab&nbsp;2) and MapReduce matrix multiplication (Lab&nbsp;3). Short theory, then you type every command yourself. Nothing to install.</p>' +
    '<p><strong>First: which machine will you sit at tomorrow?</strong></p>' +
    '</div>' +
    '<div class="oslist">' + cards + '</div>';
  bindHeader();
  Array.prototype.forEach.call(document.querySelectorAll('.oscard'), function (el) {
    el.onclick = function () { setOS(el.getAttribute('data-os')); renderHome(); };
  });
}

function modStatus(p, id) {
  var st = p[id] || {};
  if (st.recap) return '<span class="done">✓ guided + recap done</span>';
  if (st.guided) return '<span class="done">✓ guided done</span> · recap open';
  return '';
}

function renderHome() {
  if (!getOS()) return renderOSPicker();
  var p = getProgress();
  var mods = lessons.MODULES.map(function (m, i) {
    var st = p[m.id] || {};
    return '<div class="modcard">' +
      '<span class="modnum">module ' + (i + 1) + '</span>' +
      '<h2>' + esc(m.title) + '</h2>' +
      '<p class="sub">' + esc(m.subtitle) + '  ' + modStatus(p, m.id) + '</p>' +
      '<div class="btnrow">' +
      '<button class="btn" data-run="guided" data-mod="' + i + '">' + (st.guided ? 'Redo guided' : 'Start guided') + '</button>' +
      '<button class="btn ghost" data-run="recap" data-mod="' + i + '" ' + (st.guided ? '' : 'disabled') + '>Recap round</button>' +
      '</div>' +
      (st.guided ? '' : '<p class="lockhint">Recap unlocks after the guided run — same commands, new paths, no theory.</p>') +
      '</div>';
  }).join('');
  var allRecaps = ['m1', 'm2', 'm3'].every(function (id) { return (p[id] || {}).recap; });
  var exam = '<div class="modcard">' +
    '<span class="modnum">final</span>' +
    '<h2>Exam mode</h2>' +
    '<p class="sub">Lab 2 + Lab 3 start to finish, fresh cluster, no theory. Hints only after two misses.' +
    (p.examBest != null ? '  <span class="done">best: ' + p.examBest + '%</span>' : '') + '</p>' +
    '<div class="btnrow"><button class="btn" id="run-exam" ' + (allRecaps ? '' : 'disabled') + '>Start exam</button></div>' +
    (allRecaps ? '' : '<p class="lockhint">Unlocks when the recap rounds of modules 1–3 are done. (Module 4 is bonus material.)</p>') +
    '</div>';
  var sandbox = '<div class="modcard">' +
    '<span class="modnum">free play</span>' +
    '<h2>Sandbox</h2>' +
    '<p class="sub">An open simulated terminal — same cluster, no questions. Try anything.</p>' +
    '<div class="btnrow"><button class="btn ghost" id="run-sandbox">Open sandbox</button></div>' +
    '</div>';
  app.innerHTML = headerHTML() +
    '<div class="modlist">' + mods + exam + sandbox + '</div>' +
    '<div class="footer">Simulator for practice — commands behave like the real lab, output is faithful but canned. ' +
    'Companion to the <a href="https://github.com/shinzuu/hadoop-bdal-lab-kit">hadoop-bdal-lab-kit</a>. ' +
    'Matrix program credit: <a href="https://github.com/hossain-tamim/big_data_analytics_lab">hossain-tamim</a>. ' +
    '<button id="reset-progress">Reset progress</button></div>';
  bindHeader();
  Array.prototype.forEach.call(document.querySelectorAll('[data-run]'), function (el) {
    el.onclick = function () {
      var m = lessons.MODULES[parseInt(el.getAttribute('data-mod'), 10)];
      startRun(el.getAttribute('data-run'), m);
    };
  });
  var ex = document.getElementById('run-exam');
  if (ex) ex.onclick = function () { if (!ex.disabled) startRun('exam', null); };
  document.getElementById('run-sandbox').onclick = function () { startRun('sandbox', null); };
  document.getElementById('reset-progress').onclick = function () {
    if (confirm('Clear all progress for every OS?')) { localStorage.removeItem('bdalp.progress'); renderHome(); }
  };
}

// ---------- run (guided / recap / exam / sandbox) ----------

var session = null;

function startRun(kind, mod) {
  var os = getOS();
  var state, steps, title;
  if (kind === 'guided') { state = mod.setup(engine, os); steps = mod.steps; title = mod.title; }
  else if (kind === 'recap') { state = mod.setup(engine, os); steps = lessons.buildRecap(mod); title = mod.title + ' — recap'; }
  else if (kind === 'exam') { state = lessons.examSetup(engine, os); steps = lessons.buildExam(); title = 'Exam mode'; }
  else { state = engine.createState(os); steps = []; title = 'Sandbox'; }
  session = {
    kind: kind, mod: mod, steps: steps, i: 0, state: state, title: title,
    attempts: 0, hintLevel: 0, firstTry: 0, lines: []
  };
  if (kind === 'sandbox') {
    session.lines.push({ cls: 'out', text: 'Free play. The cluster is NOT running yet — you know what to do.\nType commands like in the real lab. (This is a simulator; nothing can break.)' });
  }
  renderStep();
}

function currentStep() { return session.steps[session.i]; }

function scrollbackHTML() {
  return session.lines.map(function (l) {
    if (l.cls === 'in') return '<div class="in"><span class="pr">' + esc(l.prompt) + '</span>' + esc(l.text) + '</div>';
    return '<div class="' + l.cls + '">' + esc(l.text) + '</div>';
  }).join('');
}

function renderStep() {
  var s = session;
  var step = currentStep();
  var os = getOS();
  var total = s.steps.length;
  var isSandbox = s.kind === 'sandbox';
  var pct = total ? Math.round((s.i / total) * 100) : 0;

  var head = '<div class="runhead"><span class="runtitle">' + esc(s.title) + '</span>' +
    (isSandbox ? '' : '<span class="count">step ' + (s.i + 1) + ' / ' + total + '</span>') + '</div>' +
    (isSandbox ? '' : '<div class="bar"><div style="width:' + pct + '%"></div></div>');

  var body = '';
  if (!isSandbox && step) {
    if (step.theory) body += '<div class="theory">' + md(step.theory) + '</div>';
    if (step.note) body += '<div class="note">' + md(step.note) + '</div>';
    body += '<p class="question"><span class="qlabel">your task</span>' + md(step.question) + '</p>';
  }

  var hintHTML = '';
  if (!isSandbox && step && s.hintLevel > 0) {
    var h = s.hintLevel === 1 ? step.hints[0]
      : s.hintLevel === 2 ? step.hints[1]
      : 'Answer: `' + step.answer(os) + '` — now type it yourself.';
    hintHTML = '<div class="hintbox">' + md(h) + '</div>';
  }

  var hintBtn = '';
  if (!isSandbox && step) {
    var locked = step.examMode && s.attempts < 2 && s.hintLevel === 0;
    var label = s.hintLevel === 0 ? 'Hint' : s.hintLevel === 1 ? 'Another hint' : s.hintLevel === 2 ? 'Reveal answer' : 'Answer shown';
    hintBtn = '<div class="stepactions">' +
      '<button class="btn ghost" id="hint-btn" ' + ((locked || s.hintLevel >= 3) ? 'disabled' : '') + '>' +
      (locked ? 'Hints after 2 tries (exam!)' : label) + '</button>' +
      '<button class="btn ghost" id="quit-btn">Exit</button>' +
      '<span class="tally">' + (s.attempts ? 'attempts: ' + s.attempts : '') + '</span>' +
      '</div>';
  } else {
    hintBtn = '<div class="stepactions"><button class="btn ghost" id="quit-btn">Back to menu</button></div>';
  }

  app.innerHTML = headerHTML() + head + body +
    '<div class="term">' +
    '<div class="tbar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>' +
    '<span class="tname">simulated ' + esc(OS_META[os].name) + ' terminal</span></div>' +
    '<div class="scrollback" id="scrollback">' + scrollbackHTML() + '</div>' +
    '<div class="inline-input"><span class="pr" id="pr"></span>' +
    '<input id="cmd" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
    'aria-label="Type a command and press Enter" placeholder="type the command, press Enter"></div>' +
    '</div>' +
    hintHTML + hintBtn;

  bindHeader();
  document.getElementById('pr').textContent = promptFor(s.state);
  var input = document.getElementById('cmd');
  input.focus();
  var sb = document.getElementById('scrollback');
  sb.scrollTop = sb.scrollHeight;

  var hb = document.getElementById('hint-btn');
  if (hb) hb.onclick = function () { s.hintLevel = Math.min(s.hintLevel + 1, 3); renderStep(); };
  document.getElementById('quit-btn').onclick = function () { session = null; renderHome(); };

  var hist = s.history || (s.history = []);
  var hi = hist.length;
  input.onkeydown = function (e) {
    if (e.key === 'ArrowUp') { if (hi > 0) { hi--; input.value = hist[hi]; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (hi < hist.length - 1) { hi++; input.value = hist[hi]; } else { hi = hist.length; input.value = ''; } e.preventDefault(); }
    else if (e.key === 'Enter') {
      var cmd = input.value.trim();
      if (!cmd) return;
      hist.push(cmd); hi = hist.length;
      submit(cmd);
    }
  };
}

function submit(cmd) {
  var s = session;
  var step = currentStep();
  s.lines.push({ cls: 'in', prompt: promptFor(s.state), text: cmd });
  var result = engine.runCommand(s.state, cmd);
  if (result.output) s.lines.push({ cls: result.ok ? 'out' : 'bad', text: result.output });

  if (s.kind === 'sandbox' || !step) { renderStep(); return; }

  if (step.check(s.state, result, cmd)) {
    if (s.attempts === 0 && s.hintLevel === 0) s.firstTry++;
    s.lines.push({ cls: 'good', text: '✓ correct — ' + step.answer(getOS()) });
    s.i++; s.attempts = 0; s.hintLevel = 0;
    if (s.i >= s.steps.length) { finishRun(); return; }
    renderStep();
  } else {
    s.attempts++;
    if (result.ok) s.lines.push({ cls: 'bad', text: '✗ that ran, but it isn’t what the task asked — check the task again' + (s.attempts >= 2 ? ' (or take a hint)' : '') });
    renderStep();
  }
}

function finishRun() {
  var s = session;
  var p = getProgress();
  var scorePct = Math.round((s.firstTry / s.steps.length) * 100);
  var html;
  if (s.kind === 'guided') {
    p[s.mod.id] = p[s.mod.id] || {}; p[s.mod.id].guided = true; setProgress(p);
    html = '<h2>Module complete ✓</h2><p>' + s.firstTry + ' of ' + s.steps.length + ' first try.</p>' +
      '<p>Now do the <strong>recap round</strong> — same commands, new paths, from memory.</p>' +
      '<div class="btnrow" style="justify-content:center"><button class="btn" id="next-recap">Start recap</button>' +
      '<button class="btn ghost" id="back-home">Menu</button></div>';
  } else if (s.kind === 'recap') {
    p[s.mod.id] = p[s.mod.id] || {}; p[s.mod.id].recap = true; setProgress(p);
    html = '<h2>Recap done ✓</h2><p>' + s.firstTry + ' of ' + s.steps.length + ' first try. These commands are getting into your fingers.</p>' +
      '<div class="btnrow" style="justify-content:center"><button class="btn ghost" id="back-home">Menu</button></div>';
  } else { // exam
    if (p.examBest == null || scorePct > p.examBest) p.examBest = scorePct;
    setProgress(p);
    html = '<h2>Exam finished</h2><div class="big">' + scorePct + '%</div>' +
      '<p>' + s.firstTry + ' of ' + s.steps.length + ' on the first try' +
      (scorePct >= 80 ? ' — you are ready for tomorrow.' : ' — run it again; repetition is the whole point.') + '</p>' +
      '<div class="btnrow" style="justify-content:center"><button class="btn" id="redo-exam">Run it again</button>' +
      '<button class="btn ghost" id="back-home">Menu</button></div>';
  }
  var mod = s.mod;
  session = null;
  app.innerHTML = headerHTML() + '<div class="summary">' + html + '</div>';
  bindHeader();
  var bh = document.getElementById('back-home');
  if (bh) bh.onclick = function () { renderHome(); };
  var nr = document.getElementById('next-recap');
  if (nr) nr.onclick = function () { startRun('recap', mod); };
  var re = document.getElementById('redo-exam');
  if (re) re.onclick = function () { startRun('exam', null); };
}

// ---------- ?test=1 smoke suite ----------

function runSmokeTests() {
  var out = [];
  var pass = 0, fail = 0;
  ['linux', 'mac', 'windows'].forEach(function (os) {
    lessons.MODULES.forEach(function (m) {
      var state = m.setup(engine, os);
      m.steps.forEach(function (step, i) {
        var input = step.answer(os);
        var result = engine.runCommand(state, input);
        var okk = false;
        try { okk = step.check(state, result, input); } catch (e) { okk = false; }
        if (okk) { pass++; } else { fail++; out.push('<span class="f">FAIL ' + os + ' ' + m.id + ' step ' + i + ': ' + esc(input) + '</span>'); }
      });
    });
    var ex = lessons.examSetup(engine, os);
    lessons.buildExam().forEach(function (step, i) {
      var input = step.answer(os);
      var result = engine.runCommand(ex, input);
      if (step.check(ex, result, input)) pass++; else { fail++; out.push('<span class="f">FAIL ' + os + ' exam step ' + i + '</span>'); }
    });
  });
  out.unshift('<span class="' + (fail ? 'f' : 'p') + '">' + pass + ' passed, ' + fail + ' failed</span>');
  app.innerHTML = headerHTML() + '<div class="testlog">' + out.join('\n') + '</div>';
  bindHeader();
  console.log('[bdalp smoke] pass=' + pass + ' fail=' + fail);
}

// ---------- boot ----------

if (location.search.indexOf('test=1') !== -1) runSmokeTests();
else if (getOS()) renderHome();
else renderOSPicker();

})();
