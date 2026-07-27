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

// ---------- Task 2: HDFS + local commands (Lab 2 set) ----------

function up(os) {
  const s = createState(os);
  runCommand(s, os === 'windows' ? 'start-all.cmd' : 'hadoop-start');
  return s;
}

test('mkdir: happy, missing parent, exists, -p', () => {
  const s = up('linux');
  assert.equal(runCommand(s, 'hadoop fs -mkdir /dir1').ok, true);
  assert.ok(runCommand(s, 'hadoop fs -ls /').output.includes('/dir1'));
  const r = runCommand(s, 'hadoop fs -mkdir /a/b/c');
  assert.equal(r.ok, false);
  assert.ok(r.output.includes('No such file or directory'));
  assert.equal(runCommand(s, 'hadoop fs -mkdir -p /a/b/c').ok, true);
  const r2 = runCommand(s, 'hadoop fs -mkdir /dir1');
  assert.equal(r2.ok, false);
  assert.ok(r2.output.includes('File exists'));
});

test('copyFromLocal + put: into dir, missing local, File exists, -f', () => {
  const s = up('linux');
  runCommand(s, 'hadoop fs -mkdir /dir1');
  runCommand(s, 'cd ~/kit/Lab-2-HDFS-Basic-Commands');
  const r = runCommand(s, 'hadoop fs -copyFromLocal command3.txt /dir1');
  assert.equal(r.ok, true, r.output);
  assert.ok(runCommand(s, 'hadoop fs -ls /dir1').output.includes('command3.txt'));
  const missing = runCommand(s, 'hadoop fs -copyFromLocal nope.txt /dir1');
  assert.equal(missing.ok, false);
  assert.ok(missing.output.includes('No such file or directory'));
  const dup = runCommand(s, 'hadoop fs -put command3.txt /dir1');
  assert.equal(dup.ok, false);
  assert.ok(dup.output.includes('File exists'));
  assert.equal(runCommand(s, 'hadoop fs -put -f command3.txt /dir1').ok, true);
});

test('windows put with C:/ path', () => {
  const s = up('windows');
  runCommand(s, 'hadoop fs -mkdir /dir1');
  const r = runCommand(s, 'hadoop fs -copyFromLocal C:/BDA/command3.txt /dir1');
  assert.equal(r.ok, true, r.output);
  assert.ok(runCommand(s, 'hadoop fs -ls /dir1').output.includes('command3.txt'));
});

test('copyToLocal / get writes into local tree', () => {
  const s = up('linux');
  runCommand(s, 'hadoop fs -mkdir /dir1');
  runCommand(s, 'cd ~/kit/Lab-2-HDFS-Basic-Commands');
  runCommand(s, 'hadoop fs -put command3.txt /dir1');
  runCommand(s, 'mkdir -p downloaded');
  const r = runCommand(s, 'hadoop fs -copyToLocal /dir1/command3.txt downloaded/');
  assert.equal(r.ok, true, r.output);
  assert.ok(runCommand(s, 'cd downloaded').ok);
  assert.ok(runCommand(s, 'ls').output.includes('command3.txt'));
  const bad = runCommand(s, 'hadoop fs -get /dir1/nope.txt .');
  assert.equal(bad.ok, false);
  assert.ok(bad.output.includes('No such file or directory'));
});

test('cat file and dir error', () => {
  const s = up('linux');
  runCommand(s, 'hadoop fs -mkdir /dir1');
  runCommand(s, 'cd ~/kit/Lab-2-HDFS-Basic-Commands');
  runCommand(s, 'hadoop fs -put command3.txt /dir1');
  const r = runCommand(s, 'hadoop fs -cat /dir1/command3.txt');
  assert.ok(r.output.includes('this file moves into hdfs'));
  const d = runCommand(s, 'hadoop fs -cat /dir1');
  assert.equal(d.ok, false);
  assert.ok(d.output.includes('Is a directory'));
});

test('rm / rmdir / rm -r semantics', () => {
  const s = up('linux');
  runCommand(s, 'hadoop fs -mkdir /dir1');
  runCommand(s, 'hadoop fs -mkdir /dir1/newdir');
  runCommand(s, 'cd ~/kit/Lab-2-HDFS-Basic-Commands');
  runCommand(s, 'hadoop fs -put exampleput.txt /dir1/newdir');
  // rm on dir fails
  const rd = runCommand(s, 'hadoop fs -rm /dir1');
  assert.equal(rd.ok, false);
  assert.ok(rd.output.includes('Is a directory'));
  // rmdir on non-empty fails
  const ne = runCommand(s, 'hadoop fs -rmdir /dir1/newdir');
  assert.equal(ne.ok, false);
  assert.ok(ne.output.includes('Directory is not empty'));
  // rm file then rmdir works
  const rf = runCommand(s, 'hadoop fs -rm /dir1/newdir/exampleput.txt');
  assert.equal(rf.ok, true);
  assert.ok(rf.output.includes('Deleted /dir1/newdir/exampleput.txt'));
  assert.equal(runCommand(s, 'hadoop fs -rmdir /dir1/newdir').ok, true);
  // rm -r removes non-empty
  runCommand(s, 'hadoop fs -mkdir /dir1/x');
  const rr = runCommand(s, 'hadoop fs -rm -r /dir1');
  assert.equal(rr.ok, true);
  assert.ok(rr.output.includes('Deleted /dir1'));
  const missing = runCommand(s, 'hadoop fs -rm /nope');
  assert.equal(missing.ok, false);
});

test('hdfs dfs alias behaves identically', () => {
  const s = up('mac');
  assert.equal(runCommand(s, 'hdfs dfs -mkdir /z').ok, true);
  assert.ok(runCommand(s, 'hdfs dfs -ls /').output.includes('/z'));
});

test('full Lab 2 sequence (linux) returns HDFS to /tmp,/user', () => {
  const s = createState('linux');
  const seq = [
    'hadoop-start', 'jps',
    'hadoop fs -ls /',
    'hadoop fs -mkdir /dir1', 'hadoop fs -ls /',
    'hadoop fs -mkdir /dir1/newdir', 'hadoop fs -ls /dir1',
    'cd ~/kit/Lab-2-HDFS-Basic-Commands',
    'hadoop fs -copyFromLocal command3.txt /dir1', 'hadoop fs -ls /dir1',
    'mkdir -p downloaded',
    'hadoop fs -copyToLocal /dir1/command3.txt downloaded/',
    'hadoop fs -put exampleput.txt /dir1/newdir',
    'hadoop fs -get /dir1/newdir/exampleput.txt downloaded/',
    'hadoop fs -cat /dir1/command3.txt',
    'hadoop fs -rm /dir1/command3.txt',
    'hadoop fs -rm /dir1/newdir/exampleput.txt',
    'hadoop fs -rmdir /dir1/newdir',
    'hadoop fs -rm -r /dir1'
  ];
  for (const c of seq) {
    const r = runCommand(s, c);
    assert.equal(r.ok, true, c + ' => ' + r.output);
  }
  const fin = runCommand(s, 'hadoop fs -ls /').output;
  assert.ok(fin.includes('Found 2 items'));
});

test('full Lab 2 sequence (windows paths)', () => {
  const s = createState('windows');
  const seq = [
    'start-all.cmd',
    'hadoop fs -mkdir /dir1',
    'hadoop fs -copyFromLocal C:/BDA/command3.txt /dir1',
    'mkdir C:/BB',
    'hadoop fs -copyToLocal /dir1/command3.txt C:/BB',
    'hadoop fs -cat /dir1/command3.txt',
    'hadoop fs -rm -r /dir1'
  ];
  for (const c of seq) {
    const r = runCommand(s, c);
    assert.equal(r.ok, true, c + ' => ' + r.output);
  }
});

test('WARN line present on successful fs output', () => {
  const s = up('linux');
  assert.ok(runCommand(s, 'hadoop fs -ls /').output.includes('WARN util.NativeCodeLoader'));
});
