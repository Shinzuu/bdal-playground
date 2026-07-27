import { test } from 'node:test';
import assert from 'node:assert/strict';
import engine from '../src/engine.js';
import lessons from '../src/lessons.js';

const { MODULES, buildRecap, buildExam, examSetup } = lessons;
const OSES = ['linux', 'mac', 'windows'];

function runSequence(steps, state, os, label) {
  for (const [i, step] of steps.entries()) {
    assert.ok(typeof step.question === 'string' && step.question.length, `${label} step ${i} has question`);
    assert.ok(Array.isArray(step.hints) && step.hints.length === 2, `${label} step ${i} has 2 hints`);
    const input = step.answer(os);
    assert.ok(typeof input === 'string' && input.length, `${label} step ${i} answer(${os})`);
    const result = engine.runCommand(state, input);
    assert.ok(step.check(state, result, input),
      `${label} step ${i} [${os}]: canonical answer "${input}" must pass its own check (output: ${result.output})`);
  }
}

for (const os of OSES) {
  test(`every module's canonical answers pass their checks (${os})`, () => {
    for (const m of MODULES) {
      const state = m.setup(engine, os);
      runSequence(m.steps, state, os, `module ${m.id}`);
    }
  });

  test(`every recap's canonical answers pass their checks (${os})`, () => {
    for (const m of MODULES) {
      const state = m.setup(engine, os);
      const steps = buildRecap(m);
      assert.ok(steps.every(s => !s.theory), `recap ${m.id} has no theory`);
      runSequence(steps, state, os, `recap ${m.id}`);
    }
  });

  test(`exam canonical answers pass their checks (${os})`, () => {
    const state = examSetup(engine, os);
    const steps = buildExam();
    assert.ok(steps.every(s => s.examMode), 'exam steps flagged');
    runSequence(steps, state, os, 'exam');
  });
}

test('repetition audit: every core command family appears >= 3 times overall', () => {
  const answers = [];
  for (const m of MODULES) {
    for (const s of m.steps) answers.push(s.answer('linux'));
    for (const s of buildRecap(m)) answers.push(s.answer('linux'));
  }
  for (const s of buildExam()) answers.push(s.answer('linux'));
  const families = {
    start: a => a === 'hadoop-start',
    jps: a => a === 'jps',
    ls: a => /-ls\b/.test(a),
    mkdir: a => /fs -mkdir|dfs -mkdir/.test(a),
    put: a => /-copyFromLocal|-put\b/.test(a),
    get: a => /-copyToLocal|-get\b/.test(a),
    cat: a => /-cat\b/.test(a),
    rm: a => /-rm\b|-rm -r|-rmdir/.test(a),
    javac: a => /^javac /.test(a),
    jar: a => /^jar /.test(a),
    runjob: a => /^hadoop jar /.test(a)
  };
  for (const [name, match] of Object.entries(families)) {
    const n = answers.filter(match).length;
    assert.ok(n >= 3, `family "${name}" appears ${n}x, need >= 3`);
  }
  // extended families live in module 4 guided + recap only
  const extended = {
    cp: a => /fs -cp\b/.test(a),
    mv: a => /fs -mv\b/.test(a),
    touchz: a => /-touchz\b/.test(a),
    count: a => /-count\b/.test(a),
    du: a => /-du\b/.test(a),
    tail: a => /-tail\b/.test(a),
    report: a => /dfsadmin -report/.test(a),
    version: a => /^hadoop version$/.test(a)
  };
  for (const [name, match] of Object.entries(extended)) {
    const n = answers.filter(match).length;
    assert.ok(n >= 2, `extended family "${name}" appears ${n}x, need >= 2`);
  }
});
