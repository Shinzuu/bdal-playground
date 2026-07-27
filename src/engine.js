/* BDAL Playground — simulator engine (pure, no DOM).
 * Works in browser (globalThis.BDALEngine) and node (module.exports). */
(function (root) {
'use strict';

var WARN = 'WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform... using builtin-java classes where applicable';

var MATRIX_TXT = 'A,0,0,1\nA,0,1,2\nA,1,0,3\nA,1,1,4\nB,0,0,5\nB,0,1,6\nB,1,0,7\nB,1,1,8';
var JAVA_SRC = '// MatrixMultiplication.java — Mapper + Reducer + driver (see lab kit)';

function dir(children) { return { type: 'dir', children: children || {} }; }
function file(content) { return { type: 'file', content: content || '' }; }

function createState(os) {
  var local = dir();
  var cwd;
  if (os === 'windows') {
    local.children['C:'] = dir({
      BDA: dir({
        'command3.txt': file('this file moves into hdfs'),
        'exampleput.txt': file('uploaded with put'),
        'matrix.txt': file(MATRIX_TXT),
        'MatrixMultiplication.java': file(JAVA_SRC)
      })
    });
    cwd = ['C:', 'BDA'];
  } else {
    local.children['~'] = dir({
      kit: dir({
        'Lab-2-HDFS-Basic-Commands': dir({
          'command3.txt': file('this file moves into hdfs'),
          'exampleput.txt': file('uploaded with put')
        })
      }),
      mat: dir({
        'MatrixMultiplication.java': file(JAVA_SRC),
        'matrix.txt': file(MATRIX_TXT)
      })
    });
    cwd = ['~'];
  }
  return {
    os: os,
    clusterUp: false,
    hdfs: dir({ tmp: dir(), user: dir() }),
    local: local,
    cwd: cwd,
    compiled: false,
    jarBuilt: false,
    jobRuns: 0,
    pids: null,
    pidSeed: 4100
  };
}

// ---------- helpers ----------

function tokenize(input) {
  var tokens = [], cur = '', q = null;
  for (var i = 0; i < input.length; i++) {
    var c = input[i];
    if (q) {
      if (c === q) { q = null; } else { cur += c; }
    } else if (c === '"' || c === "'") {
      q = c;
    } else if (/\s/.test(c)) {
      if (cur) { tokens.push(cur); cur = ''; }
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

function ok(output) { return { output: output, ok: true }; }
function err(output) { return { output: output, ok: false }; }

function isUnix(state) { return state.os !== 'windows'; }

// local path -> array of segments from local root, or null if malformed
function localSegs(state, p) {
  p = p.replace(/\\/g, '/');
  var segs;
  if (/^[A-Za-z]:/.test(p)) {
    segs = p.split('/').filter(Boolean);
    segs[0] = segs[0].toUpperCase();
  } else if (p === '~' || p.indexOf('~/') === 0) {
    segs = ['~'].concat(p.slice(2).split('/').filter(Boolean));
  } else if (p.indexOf('/') === 0) {
    // absolute unix path — map /home-ish onto '~' root for simplicity
    segs = ['~'].concat(p.split('/').filter(Boolean));
  } else {
    segs = state.cwd.concat(p.split('/').filter(Boolean));
  }
  var out = [];
  for (var i = 0; i < segs.length; i++) {
    if (segs[i] === '.') continue;
    else if (segs[i] === '..') out.pop();
    else out.push(segs[i]);
  }
  return out;
}

function getNode(rootDir, segs) {
  var node = rootDir;
  for (var i = 0; i < segs.length; i++) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[segs[i]];
  }
  return node || null;
}

function hdfsSegs(p) {
  if (p.indexOf('/') !== 0) p = '/user/student/' + p;
  return p.split('/').filter(Boolean);
}

function hdfsPathStr(segs) { return '/' + segs.join('/'); }

function cwdString(state) {
  if (isUnix(state)) return state.cwd.join('/');
  return state.cwd[0] + '\\' + state.cwd.slice(1).join('\\');
}

// ---------- cluster ----------

var UNIX_DAEMONS = ['NameNode', 'DataNode', 'SecondaryNameNode', 'ResourceManager', 'NodeManager'];
var WIN_DAEMONS = ['NameNode', 'DataNode', 'ResourceManager', 'NodeManager'];

function startCluster(state) {
  if (state.clusterUp) return ok('cluster is already running (check with: jps)');
  state.clusterUp = true;
  var daemons = isUnix(state) ? UNIX_DAEMONS : WIN_DAEMONS;
  state.pids = {};
  var pid = state.pidSeed;
  for (var i = 0; i < daemons.length; i++) {
    pid += 137 + i * 11;
    state.pids[daemons[i]] = pid;
  }
  if (isUnix(state)) {
    return ok('Starting namenodes on [localhost]\nStarting datanodes\nStarting secondary namenodes [localhost]\nStarting resourcemanager\nStarting nodemanagers');
  }
  return ok('starting namenode, logging to console window\nstarting datanode, logging to console window\nstarting yarn daemons\n(4 new console windows opened — leave them open, closing one kills that daemon)');
}

function stopCluster(state) {
  if (!state.clusterUp) return ok('cluster is not running');
  state.clusterUp = false;
  state.pids = null;
  return ok(isUnix(state)
    ? 'Stopping namenodes on [localhost]\nStopping datanodes\nStopping secondary namenodes [localhost]\nStopping resourcemanager\nStopping nodemanagers'
    : 'stopping namenode\nstopping datanode\nstopping yarn daemons');
}

function jps(state) {
  state.pidSeed += 7;
  var lines = [];
  if (state.clusterUp) {
    var names = Object.keys(state.pids);
    for (var i = 0; i < names.length; i++) lines.push(state.pids[names[i]] + ' ' + names[i]);
  }
  lines.push((state.pidSeed + 900) + ' Jps');
  return ok(lines.join('\n'));
}

// ---------- fs (hadoop fs / hdfs dfs) ----------

function connRefused(verb) {
  return err(verb + ': Call From localhost to localhost:9000 failed on connection exception: ' +
    'java.net.ConnectException: Connection refused; For more details see:  http://wiki.apache.org/hadoop/ConnectionRefused\n' +
    '(hint: the cluster is not running — nothing is broken)');
}

function lsEntryLine(name, node, pathPrefix) {
  var full = (pathPrefix === '/' ? '' : pathPrefix) + '/' + name;
  if (node.type === 'dir') {
    return 'drwxr-xr-x   - student supergroup          0 2026-07-28 10:00 ' + full;
  }
  var size = String(node.content.length);
  var pad = '';
  for (var i = size.length; i < 10; i++) pad += ' ';
  return '-rw-r--r--   1 student supergroup ' + pad + size + ' 2026-07-28 10:00 ' + full;
}

function fsCmd(state, args, family) {
  if (!args.length) return err('Usage: ' + family + ' -<command> [args]');
  var sub = args[0];
  var verb = sub.replace(/^-+/, '');
  if (!state.clusterUp) {
    var known = ['-ls', '-mkdir', '-copyFromLocal', '-put', '-copyToLocal', '-get', '-cat', '-rm', '-rmdir'];
    if (known.indexOf(sub) !== -1) return connRefused(verb);
  }
  var rest = args.slice(1);
  switch (sub) {
    case '-ls': return fsLs(state, rest);
    case '-mkdir': return fsMkdir(state, rest);
    case '-copyFromLocal':
    case '-put': return fsPut(state, rest, verb);
    case '-copyToLocal':
    case '-get': return fsGet(state, rest, verb);
    case '-cat': return fsCat(state, rest);
    case '-rm': return fsRm(state, rest);
    case '-rmdir': return fsRmdir(state, rest);
    default:
      return err(sub + ': Unknown command');
  }
}

function flagsAndPaths(rest) {
  var flags = [], paths = [];
  for (var i = 0; i < rest.length; i++) {
    if (rest[i].indexOf('-') === 0 && !/^-?\/|^-?[A-Za-z]:/.test(rest[i])) flags.push(rest[i]);
    else paths.push(rest[i]);
  }
  return { flags: flags, paths: paths };
}

function fsMkdir(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-mkdir: Not enough arguments');
  var withP = fp.flags.indexOf('-p') !== -1;
  for (var i = 0; i < fp.paths.length; i++) {
    var segs = hdfsSegs(fp.paths[i]);
    var shown = hdfsPathStr(segs);
    if (getNode(state.hdfs, segs)) return err('mkdir: `' + shown + "': File exists");
    var parent = getNode(state.hdfs, segs.slice(0, -1));
    if (!parent || parent.type !== 'dir') {
      if (!withP) return err('mkdir: `' + shown + "': No such file or directory");
      parent = state.hdfs;
      for (var j = 0; j < segs.length - 1; j++) {
        if (!parent.children[segs[j]]) parent.children[segs[j]] = dir();
        parent = parent.children[segs[j]];
      }
    }
    parent.children[segs[segs.length - 1]] = dir();
  }
  return ok(WARN);
}

function fsPut(state, rest, verb) {
  var fp = flagsAndPaths(rest);
  var force = fp.flags.indexOf('-f') !== -1;
  if (fp.paths.length < 2) return err('-' + verb + ': Not enough arguments');
  var srcPath = fp.paths[0], dstPath = fp.paths[1];
  if (/\s/.test(srcPath)) return err(verb + ': unexpected URISyntaxException');
  var srcSegs = localSegs(state, srcPath);
  var srcNode = getNode(state.local, srcSegs);
  if (!srcNode || srcNode.type !== 'file') {
    return err(verb + ": `" + srcPath + "': No such file or directory");
  }
  var name = srcSegs[srcSegs.length - 1];
  var dstSegs = hdfsSegs(dstPath);
  var dstNode = getNode(state.hdfs, dstSegs);
  var parent, finalName;
  if (dstNode && dstNode.type === 'dir') { parent = dstNode; finalName = name; }
  else if (dstNode && dstNode.type === 'file') {
    if (!force) return err(verb + ': `' + hdfsPathStr(dstSegs) + "': File exists");
    parent = getNode(state.hdfs, dstSegs.slice(0, -1)); finalName = dstSegs[dstSegs.length - 1];
  } else {
    parent = getNode(state.hdfs, dstSegs.slice(0, -1));
    if (!parent || parent.type !== 'dir') return err(verb + ': `' + hdfsPathStr(dstSegs) + "': No such file or directory");
    finalName = dstSegs[dstSegs.length - 1];
  }
  if (parent.children[finalName] && !force) {
    return err(verb + ': `' + hdfsPathStr(dstSegs) + '/' + finalName + "': File exists");
  }
  parent.children[finalName] = file(srcNode.content);
  return ok(WARN);
}

function fsGet(state, rest, verb) {
  var fp = flagsAndPaths(rest);
  if (fp.paths.length < 2) return err('-' + verb + ': Not enough arguments');
  var srcSegs = hdfsSegs(fp.paths[0]);
  var srcNode = getNode(state.hdfs, srcSegs);
  var errVerb = verb === 'copyToLocal' ? 'copyToLocal' : 'get';
  if (!srcNode || srcNode.type !== 'file') {
    return err(errVerb + ': `' + hdfsPathStr(srcSegs) + "': No such file or directory");
  }
  var name = srcSegs[srcSegs.length - 1];
  var dstPath = fp.paths[1];
  var dstSegs = localSegs(state, dstPath === '.' ? '.' : dstPath);
  var dstNode = getNode(state.local, dstSegs);
  var parent, finalName;
  if (dstNode && dstNode.type === 'dir') { parent = dstNode; finalName = name; }
  else {
    parent = getNode(state.local, dstSegs.slice(0, -1));
    if (!parent || parent.type !== 'dir') return err(errVerb + ': `' + dstPath + "': No such file or directory");
    finalName = dstSegs[dstSegs.length - 1];
  }
  parent.children[finalName] = file(srcNode.content);
  return ok(WARN);
}

function fsCat(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-cat: Not enough arguments');
  var out = [WARN];
  for (var i = 0; i < fp.paths.length; i++) {
    var segs = hdfsSegs(fp.paths[i]);
    var node = getNode(state.hdfs, segs);
    if (!node) return err('cat: `' + hdfsPathStr(segs) + "': No such file or directory");
    if (node.type === 'dir') return err('cat: `' + hdfsPathStr(segs) + "': Is a directory");
    out.push(node.content);
  }
  return ok(out.join('\n'));
}

function fsRm(state, rest) {
  var fp = flagsAndPaths(rest);
  var recursive = fp.flags.indexOf('-r') !== -1 || fp.flags.indexOf('-R') !== -1;
  if (!fp.paths.length) return err('-rm: Not enough arguments');
  var out = [WARN];
  for (var i = 0; i < fp.paths.length; i++) {
    var segs = hdfsSegs(fp.paths[i]);
    var shown = hdfsPathStr(segs);
    var node = getNode(state.hdfs, segs);
    if (!node) return err('rm: `' + shown + "': No such file or directory");
    if (node.type === 'dir' && !recursive) return err('rm: `' + shown + "': Is a directory");
    var parent = getNode(state.hdfs, segs.slice(0, -1));
    delete parent.children[segs[segs.length - 1]];
    out.push('Deleted ' + shown);
  }
  return ok(out.join('\n'));
}

function fsRmdir(state, rest) {
  var fp = flagsAndPaths(rest);
  if (!fp.paths.length) return err('-rmdir: Not enough arguments');
  var segs = hdfsSegs(fp.paths[0]);
  var shown = hdfsPathStr(segs);
  var node = getNode(state.hdfs, segs);
  if (!node) return err('rmdir: `' + shown + "': No such file or directory");
  if (node.type !== 'dir') return err('rmdir: `' + shown + "': Is not a directory");
  if (Object.keys(node.children).length) return err('rmdir: `' + shown + "': Directory is not empty");
  var parent = getNode(state.hdfs, segs.slice(0, -1));
  delete parent.children[segs[segs.length - 1]];
  return ok(WARN);
}

function fsLs(state, rest) {
  var p = rest.filter(function (a) { return a.indexOf('-') !== 0; })[0] || '/user/student';
  var segs = hdfsSegs(p);
  var node = getNode(state.hdfs, segs);
  var shown = hdfsPathStr(segs);
  if (!node) return err('ls: `' + shown + "': No such file or directory");
  var out = [WARN];
  if (node.type === 'file') {
    out.push(lsEntryLine(segs[segs.length - 1], node, hdfsPathStr(segs.slice(0, -1)) || '/'));
    return ok(out.join('\n'));
  }
  var names = Object.keys(node.children).sort();
  out.push('Found ' + names.length + ' items');
  for (var i = 0; i < names.length; i++) {
    out.push(lsEntryLine(names[i], node.children[names[i]], shown === '/' ? '/' : shown));
  }
  return ok(out.join('\n'));
}

// ---------- local commands ----------

function localLs(state) {
  var node = getNode(state.local, state.cwd);
  var names = Object.keys(node.children).sort();
  return ok(names.join('\n'));
}

function localCd(state, p) {
  if (!p) { state.cwd = isUnix(state) ? ['~'] : ['C:', 'BDA']; return ok(''); }
  var segs = localSegs(state, p);
  var node = getNode(state.local, segs);
  if (!node || node.type !== 'dir') return err('cd: no such file or directory: ' + p);
  state.cwd = segs;
  return ok('');
}

function localMkdir(state, args) {
  var paths = args.filter(function (a) { return a.indexOf('-') !== 0; });
  if (!paths.length) return err('mkdir: missing operand');
  for (var i = 0; i < paths.length; i++) {
    var segs = localSegs(state, paths[i]);
    var parent = getNode(state.local, segs.slice(0, -1));
    if (!parent || parent.type !== 'dir') {
      if (args.indexOf('-p') === -1) return err('mkdir: cannot create directory ‘' + paths[i] + '’: No such file or directory');
      // -p: create the chain
      parent = state.local;
      for (var j = 0; j < segs.length - 1; j++) {
        if (!parent.children[segs[j]]) parent.children[segs[j]] = dir();
        parent = parent.children[segs[j]];
      }
    }
    if (!parent.children[segs[segs.length - 1]]) parent.children[segs[segs.length - 1]] = dir();
  }
  return ok('');
}

// ---------- dispatch ----------

function notFound(state, cmd) {
  var msg = isUnix(state)
    ? 'zsh: command not found: ' + cmd
    : "'" + cmd + "' is not recognized as an internal or external command";
  return err(msg);
}

function runCommand(state, input) {
  var tokens = tokenize(String(input || '').trim());
  if (!tokens.length) return ok('');
  var cmd = tokens[0];

  // cluster lifecycle (per OS)
  if (cmd === 'hadoop-start' || cmd === 'hadoop-stop') {
    if (!isUnix(state)) {
      var r = notFound(state, cmd);
      r.output += '\n(on native Windows the cluster starts with: start-all.cmd / stops with: stop-all.cmd)';
      return r;
    }
    return cmd === 'hadoop-start' ? startCluster(state) : stopCluster(state);
  }
  if (cmd === 'start-all.cmd' || cmd === 'stop-all.cmd') {
    if (isUnix(state)) {
      var r2 = notFound(state, cmd);
      r2.output += '\n(on Linux/Mac this cluster starts with: hadoop-start / stops with: hadoop-stop)';
      return r2;
    }
    return cmd === 'start-all.cmd' ? startCluster(state) : stopCluster(state);
  }

  if (cmd === 'jps') return jps(state);

  if (cmd === 'hadoop' || cmd === 'hdfs') {
    var sub = tokens[1];
    if ((cmd === 'hadoop' && sub === 'fs') || (cmd === 'hdfs' && sub === 'dfs')) {
      return fsCmd(state, tokens.slice(2), cmd === 'hadoop' ? 'hadoop fs' : 'hdfs dfs');
    }
    return err(cmd + ' ' + (sub || '') + ': unknown subcommand (try: ' + (cmd === 'hadoop' ? 'hadoop fs -…' : 'hdfs dfs -…') + ')');
  }

  if (cmd === 'ls') return localLs(state);
  if (cmd === 'cd') return localCd(state, tokens[1]);
  if (cmd === 'pwd') return ok(cwdString(state));
  if (cmd === 'mkdir') return localMkdir(state, tokens.slice(1));

  return notFound(state, cmd);
}

var api = { createState: createState, runCommand: runCommand, WARN: WARN, cwdString: cwdString };
root.BDALEngine = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
