/* BDAL Playground — lesson data. Pure data + generators; engine passed in where needed.
 * Step: { theory?, question, hints:[h1,h2], answer(os), check(state,result,input), note? } */
(function (root) {
'use strict';

// ---------- helpers ----------

function hnode(state, path) {
  var segs = path.split('/').filter(Boolean);
  var node = state.hdfs;
  for (var i = 0; i < segs.length; i++) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[segs[i]];
  }
  return node || null;
}

function lnode(state, segs) {
  var node = state.local;
  for (var i = 0; i < segs.length; i++) {
    if (!node || node.type !== 'dir') return null;
    node = node.children[segs[i]];
  }
  return node || null;
}

function cwdHas(state, name) {
  var node = lnode(state, state.cwd.concat([name]));
  return !!node;
}

function isWin(os) { return os === 'windows'; }

// canonical per-OS fragments
function startCmd(os) { return isWin(os) ? 'start-all.cmd' : 'hadoop-start'; }
function kitCd(os) { return isWin(os) ? 'cd C:/BDA' : 'cd ~/kit/Lab-2-HDFS-Basic-Commands'; }
function matCd(os) { return isWin(os) ? 'cd C:/BDA' : 'cd ~/mat'; }
function localRef(os, name) { return isWin(os) ? 'C:/BDA/' + name : name; }
function javacCmd(os) {
  return isWin(os)
    ? 'javac -classpath "%HADOOP_HOME%\\share\\hadoop\\common\\*;%HADOOP_HOME%\\share\\hadoop\\mapreduce\\*" -d . MatrixMultiplication.java'
    : 'javac -classpath "$(hadoop classpath)" -d . MatrixMultiplication.java';
}
function jarCmd(os) {
  return isWin(os) ? 'jar -cvf MatrixMultiplication.jar -C . .' : 'jar -cf MatrixMultiplication.jar *.class';
}

// generic step builders (used by modules, recaps and exam so paths can vary)

function stepStart() {
  return {
    theory: 'A Hadoop cluster is a team of daemon (background) processes — NameNode, DataNode, ResourceManager, NodeManager… They never start by themselves: every lab session begins by starting them.',
    question: 'Start your Hadoop cluster.',
    hints: ['One short command starts everything. On Linux/Mac it is a hyphenated word; on Windows it is a .cmd script.',
      'It begins with “start” on Windows, and with “hadoop-” on Linux/Mac.'],
    answer: startCmd,
    check: function (state) { return state.clusterUp; }
  };
}

function stepJps() {
  return {
    theory: 'jps lists the running Java processes — it is THE health check. Expect 5 daemons on Linux/Mac, 4 on native Windows (no SecondaryNameNode there). If a daemon is missing, nothing else will work.',
    question: 'Verify the cluster daemons are actually running.',
    hints: ['It is a 3-letter command: Java Process Status.', 'Just type the three letters.'],
    answer: function () { return 'jps'; },
    check: function (state, result, input) { return result.ok && /^jps$/.test(input.trim()); }
  };
}

function stepLsRoot(expectText) {
  return {
    theory: 'HDFS is a SEPARATE filesystem living inside those daemons — your normal files are not in it. You reach it with `hadoop fs -…` (or `hdfs dfs -…`, identical). Web view: http://localhost:9870 → Utilities. Jobs: http://localhost:8088.',
    question: 'List the ROOT directory of HDFS.',
    hints: ['hadoop fs -ls needs a path; the HDFS root is “/”.', 'Shape: hadoop fs -ls <path>  — the root path is a single slash.'],
    answer: function () { return 'hadoop fs -ls /'; },
    check: function (state, result, input) {
      return result.ok && /-ls\s+\/\s*$/.test(input) && (!expectText || result.output.indexOf(expectText) !== -1);
    }
  };
}

function stepMkdir(path, theory) {
  return {
    theory: theory,
    question: 'Create the directory ' + path + ' in HDFS.',
    hints: ['The fs subcommand is -mkdir, and HDFS paths start at “/”.', 'Shape: hadoop fs -mkdir ' + path],
    answer: function () { return 'hadoop fs -mkdir ' + path; },
    check: function (state) { var n = hnode(state, path); return !!n && n.type === 'dir'; }
  };
}

function stepLs(path, mustContain) {
  return {
    question: 'List ' + path + ' to confirm.',
    hints: ['Same -ls as before, different path.', 'Shape: hadoop fs -ls ' + path],
    answer: function () { return 'hadoop fs -ls ' + path; },
    check: function (state, result, input) {
      return result.ok && input.indexOf('-ls') !== -1 && result.output.indexOf(mustContain) !== -1;
    }
  };
}

function stepCd(cdCmd, theory) {
  return {
    theory: theory,
    question: 'Move into the folder that holds the sample files.',
    hints: ['Plain shell cd — no hadoop involved.', 'Shape: ' + cdCmd('linux') + '   (Windows: ' + cdCmd('windows') + ')'],
    answer: cdCmd,
    check: function (state, result, input) {
      if (!result.ok || !/^cd\s/.test(input.trim())) return false;
      var last = state.cwd[state.cwd.length - 1];
      return last === 'Lab-2-HDFS-Basic-Commands' || last === 'BDA' || last === 'mat';
    }
  };
}

function stepPut(fileName, hdfsDir, opts) {
  opts = opts || {};
  var verb = opts.useAlias ? '-put' : '-copyFromLocal';
  return {
    theory: opts.theory,
    note: opts.note,
    question: 'Copy the LOCAL file ' + fileName + ' into HDFS directory ' + hdfsDir + (opts.useAlias ? ' (use the short alias this time).' : '.'),
    hints: ['Local → HDFS is -copyFromLocal (or its alias -put). Arguments: local source first, HDFS destination second.',
      'Shape: hadoop fs ' + verb + ' ' + fileName + ' ' + hdfsDir + '   (Windows: give the full C:/… path to the file)'],
    answer: function (os) { return 'hadoop fs ' + verb + ' ' + localRef(os, fileName) + ' ' + hdfsDir; },
    check: function (state) { var n = hnode(state, hdfsDir + '/' + fileName); return !!n && n.type === 'file'; }
  };
}

function stepLocalMkdir(dirName) {
  return {
    theory: 'Downloads out of HDFS need a landing folder on your normal disk — make one.',
    question: 'Create a LOCAL folder called ' + dirName + ' (in your current directory).',
    hints: ['Plain shell mkdir, not hadoop fs.', 'Shape: mkdir -p ' + dirName],
    answer: function (os) { return isWin(os) ? 'mkdir ' + dirName : 'mkdir -p ' + dirName; },
    check: function (state) { return cwdHas(state, dirName); }
  };
}

function stepGet(hdfsPath, localDir, opts) {
  opts = opts || {};
  var verb = opts.useAlias ? '-get' : '-copyToLocal';
  var fname = hdfsPath.split('/').pop();
  return {
    theory: opts.theory,
    note: opts.note,
    question: 'Copy ' + hdfsPath + ' OUT of HDFS into your local ' + localDir + ' folder' + (opts.useAlias ? ' (short alias).' : '.'),
    hints: ['HDFS → local is -copyToLocal (or its alias -get). HDFS source first, local destination second — the mirror image of put.',
      'Shape: hadoop fs ' + verb + ' ' + hdfsPath + ' ' + localDir + '/'],
    answer: function () { return 'hadoop fs ' + verb + ' ' + hdfsPath + ' ' + localDir + '/'; },
    check: function (state) {
      return cwdHas(state, localDir) && !!lnode(state, state.cwd.concat([localDir, fname]));
    }
  };
}

function stepCat(hdfsPath, contentFragment) {
  return {
    theory: '-cat prints a file’s contents straight from HDFS — the quickest way to check what is inside.',
    question: 'Show the contents of ' + hdfsPath + '.',
    hints: ['Same idea as Unix cat, but as an fs subcommand.', 'Shape: hadoop fs -cat ' + hdfsPath],
    answer: function () { return 'hadoop fs -cat ' + hdfsPath; },
    check: function (state, result, input) {
      return result.ok && input.indexOf('-cat') !== -1 && result.output.indexOf(contentFragment) !== -1;
    }
  };
}

function stepRmFile(hdfsPath, theory) {
  return {
    theory: theory,
    question: 'Delete the FILE ' + hdfsPath + ' from HDFS.',
    hints: ['-rm deletes files (it refuses directories without -r).', 'Shape: hadoop fs -rm ' + hdfsPath],
    answer: function () { return 'hadoop fs -rm ' + hdfsPath; },
    check: function (state, result, input) { return result.ok && input.indexOf('-rm') !== -1 && !hnode(state, hdfsPath); }
  };
}

function stepRmdir(hdfsPath) {
  return {
    theory: '-rmdir removes a directory ONLY if it is empty — it is the safe delete. (You just emptied this one.)',
    question: 'Remove the now-empty directory ' + hdfsPath + '.',
    hints: ['Not -rm this time — the empty-only variant.', 'Shape: hadoop fs -rmdir ' + hdfsPath],
    answer: function () { return 'hadoop fs -rmdir ' + hdfsPath; },
    check: function (state, result, input) { return result.ok && input.indexOf('-rmdir') !== -1 && !hnode(state, hdfsPath); }
  };
}

function stepRmR(hdfsPath, theory) {
  return {
    theory: theory,
    question: 'Delete ' + hdfsPath + ' and EVERYTHING inside it, in one command.',
    hints: ['-rm plus the recursive flag.', 'Shape: hadoop fs -rm -r ' + hdfsPath],
    answer: function () { return 'hadoop fs -rm -r ' + hdfsPath; },
    check: function (state, result, input) { return result.ok && /-rm\s+-r/.test(input) && !hnode(state, hdfsPath); }
  };
}

function stepJavac() {
  return {
    theory: 'The matrix program is YOUR Java code — Hadoop has no built-in jar for it. Compile it against Hadoop’s libraries by passing Hadoop’s classpath to javac.',
    question: 'Compile MatrixMultiplication.java against the Hadoop classpath.',
    hints: ['javac needs -classpath <hadoop’s jars> and the .java file. On Linux/Mac you can splice the classpath in with "$(hadoop classpath)".',
      'Shape: javac -classpath "$(hadoop classpath)" -d . MatrixMultiplication.java'],
    answer: javacCmd,
    check: function (state) { return state.compiled; }
  };
}

function stepJar() {
  return {
    theory: 'MapReduce wants ONE .jar file, not loose .class files — package everything you just compiled.',
    question: 'Package the compiled classes into MatrixMultiplication.jar.',
    hints: ['The jar tool with -cf <name.jar> <what to include>.', 'Shape: jar -cf MatrixMultiplication.jar *.class'],
    answer: jarCmd,
    check: function (state) { return state.jarBuilt; }
  };
}

function stepRunJob(inPath, outPath) {
  return {
    theory: 'hadoop jar <jar> <MainClass> <input> <output> submits the job to YARN. The output directory must NOT exist yet — MapReduce refuses to overwrite.',
    question: 'Run the job: input ' + inPath + ', output ' + outPath + '.',
    hints: ['hadoop jar, then the jar file, then the main class name (MatrixMultiplication), then input path, then output path.',
      'Shape: hadoop jar MatrixMultiplication.jar MatrixMultiplication ' + inPath + ' ' + outPath],
    answer: function () { return 'hadoop jar MatrixMultiplication.jar MatrixMultiplication ' + inPath + ' ' + outPath; },
    check: function (state) { return !!hnode(state, outPath + '/part-r-00000'); }
  };
}

function stepReadResult(outPath) {
  return {
    theory: 'Reducers write files named part-r-00000, part-r-00001… A _SUCCESS marker means the job finished. For our 2×2 matrices the answer must be 19, 22, 43, 50.',
    question: 'Read the job result from ' + outPath + '.',
    hints: ['It is just -cat on the part file.', 'Shape: hadoop fs -cat ' + outPath + '/part-r-00000'],
    answer: function () { return 'hadoop fs -cat ' + outPath + '/part-r-00000'; },
    check: function (state, result, input) {
      return result.ok && input.indexOf('-cat') !== -1 && result.output.indexOf('19') !== -1 && result.output.indexOf('50') !== -1;
    }
  };
}

// ---------- modules ----------

var MODULES = [
  {
    id: 'm1',
    title: 'Boot the cluster',
    subtitle: 'start · jps · first look at HDFS',
    setup: function (engine, os) { return engine.createState(os); },
    steps: [
      stepStart(),
      stepJps(),
      stepLsRoot('Found 2 items')
    ]
  },
  {
    id: 'm2',
    title: 'HDFS commands — Lab 2',
    subtitle: 'mkdir · put/get · cat · rm — the full lab sheet',
    setup: function (engine, os) {
      var s = engine.createState(os);
      engine.runCommand(s, os === 'windows' ? 'start-all.cmd' : 'hadoop-start');
      return s;
    },
    steps: [
      stepMkdir('/dir1', '-mkdir creates a directory in HDFS — on the cluster, not on your disk.'),
      stepLs('/', '/dir1'),
      stepMkdir('/dir1/newdir', 'Paths nest exactly like a normal filesystem — a directory inside a directory.'),
      stepCd(kitCd, 'The sample files live on your LOCAL disk. Local paths with SPACES break Hadoop commands — so we cd into the folder and use bare filenames.'),
      stepPut('command3.txt', '/dir1', { theory: 'Local → HDFS is -copyFromLocal: local source first, HDFS destination second.' }),
      stepLs('/dir1', 'command3.txt'),
      stepLocalMkdir('downloaded'),
      stepGet('/dir1/command3.txt', 'downloaded', { theory: 'HDFS → local is -copyToLocal — the exact mirror of -copyFromLocal.' }),
      stepPut('exampleput.txt', '/dir1/newdir', { useAlias: true, note: '-put is EXACTLY the same command as -copyFromLocal — two names, one behaviour. The lab sheet uses both.' }),
      stepGet('/dir1/newdir/exampleput.txt', 'downloaded', { useAlias: true, note: '-get ≡ -copyToLocal, same as put ≡ copyFromLocal.' }),
      stepCat('/dir1/command3.txt', 'this file moves into hdfs'),
      stepRmFile('/dir1/command3.txt', '-rm deletes a file. Directories need more (coming next).'),
      stepRmFile('/dir1/newdir/exampleput.txt', 'To use the safe directory-delete, the directory must be empty first.'),
      stepRmdir('/dir1/newdir'),
      stepRmR('/dir1', 'For a directory WITH contents: -rm -r (recursive) takes everything in one go.'),
      stepLsRoot('Found 2 items')
    ]
  },
  {
    id: 'm3',
    title: 'Matrix multiply — Lab 3',
    subtitle: 'compile · jar · run MapReduce · read 19/22/43/50',
    setup: function (engine, os) {
      var s = engine.createState(os);
      engine.runCommand(s, os === 'windows' ? 'start-all.cmd' : 'hadoop-start');
      return s;
    },
    steps: [
      stepMkdir('/bda2', 'The job reads its input FROM HDFS — first give it a home there. (Map scatters each matrix cell to the output cells it feeds; Reduce multiplies and sums.)'),
      {
        theory: 'The program and matrix.txt sit on your local disk — go to them.',
        question: 'Move into the folder holding MatrixMultiplication.java and matrix.txt.',
        hints: ['Plain cd again.', 'Shape: cd ~/mat   (Windows: cd C:/BDA)'],
        answer: matCd,
        check: function (state, result, input) {
          if (!result.ok || !/^cd\s/.test(input.trim())) return false;
          var last = state.cwd[state.cwd.length - 1];
          return last === 'mat' || last === 'BDA';
        }
      },
      stepPut('matrix.txt', '/bda2', { theory: 'Input format: one element per line — MatrixName,row,col,value.' }),
      stepLs('/bda2', 'matrix.txt'),
      stepJavac(),
      stepJar(),
      stepRunJob('/bda2/matrix.txt', '/matrixoutput'),
      stepReadResult('/matrixoutput')
    ]
  }
];

// ---------- recap rounds (same command families, fresh paths, no theory) ----------

function stripTheory(step) {
  var s = {};
  for (var k in step) s[k] = step[k];
  delete s.theory;
  return s;
}

function buildRecap(module) {
  var steps;
  if (module.id === 'm1') {
    steps = [stepStart(), stepJps(), stepLsRoot(null)];
  } else if (module.id === 'm2') {
    steps = [
      stepMkdir('/college'),
      stepMkdir('/college/notes'),
      stepCd(kitCd),
      stepPut('command3.txt', '/college'),
      stepLs('/college', 'command3.txt'),
      stepLocalMkdir('backup'),
      stepGet('/college/command3.txt', 'backup'),
      stepPut('exampleput.txt', '/college/notes', { useAlias: true }),
      stepCat('/college/command3.txt', 'this file moves into hdfs'),
      stepRmFile('/college/notes/exampleput.txt'),
      stepRmdir('/college/notes'),
      stepRmR('/college')
    ];
  } else {
    steps = [
      stepMkdir('/bda3'),
      { question: 'Move into the folder holding the matrix files.', hints: ['cd again.', 'Shape: cd ~/mat   (Windows: cd C:/BDA)'], answer: matCd,
        check: function (state, result, input) { if (!result.ok || !/^cd\s/.test(input.trim())) return false; var last = state.cwd[state.cwd.length - 1]; return last === 'mat' || last === 'BDA'; } },
      stepPut('matrix.txt', '/bda3'),
      stepJavac(),
      stepJar(),
      stepRunJob('/bda3/matrix.txt', '/matrixout2'),
      stepReadResult('/matrixout2')
    ];
  }
  return steps.map(stripTheory);
}

// ---------- exam (full run, fresh cluster, no theory/hints until 2 fails) ----------

function buildExam() {
  var steps = [
    stepStart(), stepJps(), stepLsRoot('Found 2 items'),
    stepMkdir('/final'),
    stepCd(kitCd),
    stepPut('command3.txt', '/final'),
    stepLs('/final', 'command3.txt'),
    stepLocalMkdir('examout'),
    stepGet('/final/command3.txt', 'examout', { useAlias: true }),
    stepCat('/final/command3.txt', 'this file moves into hdfs'),
    stepRmFile('/final/command3.txt'),
    stepRmR('/final'),
    stepMkdir('/bda2'),
    { question: 'Move into the matrix folder.', hints: ['cd.', 'Shape: cd ~/mat   (Windows: cd C:/BDA)'], answer: matCd,
      check: function (state, result, input) { if (!result.ok || !/^cd\s/.test(input.trim())) return false; var last = state.cwd[state.cwd.length - 1]; return last === 'mat' || last === 'BDA'; } },
    stepPut('matrix.txt', '/bda2'),
    stepJavac(),
    stepJar(),
    stepRunJob('/bda2/matrix.txt', '/matrixoutput'),
    stepReadResult('/matrixoutput')
  ].map(stripTheory);
  for (var i = 0; i < steps.length; i++) steps[i].examMode = true;
  return steps;
}

function examSetup(engine, os) { return engine.createState(os); }

var api = { MODULES: MODULES, buildRecap: buildRecap, buildExam: buildExam, examSetup: examSetup };
root.BDALLessons = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
