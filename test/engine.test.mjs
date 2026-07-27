import { test } from 'node:test';
import assert from 'node:assert/strict';
import engine from '../src/engine.js';

const { createState, runCommand } = engine;

// ---------- Task 1: state, cluster lifecycle, jps, gating ----------

test('createState seeds local files per OS', () => {
  const lin = createState('linux');
  assert.equal(lin.os, 'linux');
  assert.equal(lin.clusterUp, false);
  assert.ok(runCommand(lin, 'ls').output.includes('kit'));
  runCommand(lin, 'cd ~/kit/Lab-2-HDFS-Basic-Commands');
  assert.ok(runCommand(lin, 'ls').output.includes('command3.txt'));

  const win = createState('windows');
  assert.ok(runCommand(win, 'ls').output.includes('command3.txt')); // cwd C:/BDA
  assert.ok(runCommand(win, 'ls').output.includes('matrix.txt'));
});

test('HDFS seeded with /tmp and /user only', () => {
  const s = createState('linux');
  runCommand(s, 'hadoop-start');
  const out = runCommand(s, 'hadoop fs -ls /').output;
  assert.ok(out.includes('/tmp'));
  assert.ok(out.includes('/user'));
  assert.ok(out.includes('Found 2 items'));
});

test('cluster start/stop transitions per OS', () => {
  const lin = createState('linux');
  assert.equal(runCommand(lin, 'hadoop-start').ok, true);
  assert.equal(lin.clusterUp, true);
  assert.equal(runCommand(lin, 'hadoop-stop').ok, true);
  assert.equal(lin.clusterUp, false);

  const win = createState('windows');
  assert.equal(runCommand(win, 'start-all.cmd').ok, true);
  assert.equal(win.clusterUp, true);
  assert.equal(runCommand(win, 'stop-all.cmd').ok, true);
  assert.equal(win.clusterUp, false);
});

test('wrong-OS start command hints at the right one', () => {
  const lin = createState('linux');
  const r = runCommand(lin, 'start-all.cmd');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('hadoop-start'));

  const win = createState('windows');
  const r2 = runCommand(win, 'hadoop-start');
  assert.equal(r2.ok, false);
  assert.ok(r2.output.includes('start-all.cmd'));
});

test('jps daemon counts: 5 unix, 4 native windows', () => {
  const lin = createState('linux');
  runCommand(lin, 'hadoop-start');
  const lines = runCommand(lin, 'jps').output.trim().split('\n');
  assert.equal(lines.length, 6); // 5 daemons + Jps
  assert.ok(lines.some(l => l.includes('SecondaryNameNode')));

  const win = createState('windows');
  runCommand(win, 'start-all.cmd');
  const wlines = runCommand(win, 'jps').output.trim().split('\n');
  assert.equal(wlines.length, 5); // 4 daemons + Jps
  assert.ok(!wlines.some(l => l.includes('SecondaryNameNode')));
});

test('jps with cluster down shows only Jps', () => {
  const s = createState('mac');
  const lines = runCommand(s, 'jps').output.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes('Jps'));
});

test('fs commands while cluster down => Connection refused', () => {
  const s = createState('linux');
  const r = runCommand(s, 'hadoop fs -ls /');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('Connection refused'));
  assert.ok(r.output.includes('localhost:9000'));
  assert.ok(r.output.startsWith('ls:'));
  const r2 = runCommand(s, 'hdfs dfs -mkdir /dir1');
  assert.ok(r2.output.startsWith('mkdir:'));
});

test('unknown command', () => {
  const s = createState('linux');
  const r = runCommand(s, 'frobnicate /x');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('command not found'));
});
