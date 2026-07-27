# BDAL Lab Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single self-contained `index.html` (GitHub-Pages-ready) that drills the BDAL Hadoop lab commands (cluster start, Lab 2 HDFS, Lab 3 matrix multiply) in a simulated OS-aware terminal.

**Architecture:** Three dev source files (`src/engine.js` pure simulator, `src/lessons.js` data, `src/app.js` + `src/style.css` UI) inlined into one `index.html` by a dependency-free `build.mjs`. Engine and lessons are dual-environment (browser global + `module.exports`) so `node --test` exercises them directly. The published artifact stays one offline-shareable file.

**Tech Stack:** Vanilla JS (ES2020, no deps), `node:test` for engine tests, Node ≥ 18 for build/test only.

## Global Constraints

- Published artifact = ONE self-contained `index.html`. No CDN, no external requests.
- OS variants: `linux`, `mac`, `windows` (native). Linux/Mac differ only in local paths' home dir label; Windows differs in start commands, local paths, daemon count.
- Cluster starts **stopped**; any `hadoop fs`/`hdfs dfs` while stopped ⇒ `Connection refused` error (see Task 1 for exact string).
- Every fs command output is prefixed with the harmless line:
  `WARN util.NativeCodeLoader: Unable to load native-hadoop library for your platform...`
- `hadoop fs` ≡ `hdfs dfs` everywhere; `-put` ≡ `-copyFromLocal`; `-get` ≡ `-copyToLocal`.
- Step validation is by **effect on state**, never by string-matching the typed command.
- Mobile-first UI. No frameworks. localStorage keys prefixed `bdalp.`.
- Commit after every task. Never push (user consent required).

## File Structure

- `src/engine.js` — simulator: state factory + `runCommand`. No DOM, no globals besides export shim.
- `src/lessons.js` — `MODULES` array + recap/exam generators. Imports nothing (checks receive engine state).
- `src/app.js` — DOM wiring: OS picker, step flow, terminal I/O, hints, progress, exam scoring, `?test=1` hook.
- `src/style.css` — all styles.
- `src/template.html` — page skeleton with `<!--INLINE:xxx-->` markers.
- `build.mjs` — reads template, inlines css+js, writes `index.html`.
- `test/engine.test.mjs`, `test/lessons.test.mjs` — node tests.
- `index.html` — built artifact (committed).
- `README.md` — usage + credits.

---

### Task 1: Engine core — state, cluster lifecycle, jps, gating

**Files:**
- Create: `src/engine.js`, `test/engine.test.mjs`

**Interfaces:**
- Produces: `createState(os) -> State`, `runCommand(state, inputString) -> { output: string, ok: boolean }` (mutates `state`).
- `State = { os, clusterUp:false, formatted:true, hdfs:{type:'dir',children:{}}, local:{...seeded}, cwd, compiled:false, jarBuilt:false, jobRuns:0 }`
- HDFS seeded with `/tmp` and `/user` dirs (matches "back to just /tmp and /user").
- Local seed per OS — linux/mac: home `~` containing `kit/Lab-2-HDFS-Basic-Commands/{command3.txt,exampleput.txt}` and `mat/{MatrixMultiplication.java,matrix.txt}`; windows: `C:/BDA/{command3.txt,exampleput.txt,MatrixMultiplication.java,matrix.txt}`. File nodes: `{type:'file',content}`; `command3.txt` content `"this moves into hdfs"`, `exampleput.txt` `"uploaded with put"`, `matrix.txt` the 8 CSV lines from Lab 3.
- Start/stop: linux/mac `hadoop-start`/`hadoop-stop`; windows `start-all.cmd`/`stop-all.cmd`. Wrong-OS start command ⇒ `command not found` style error + gentle note naming the right one.
- `jps` when up — linux/mac 5 lines: `NameNode, DataNode, SecondaryNameNode, ResourceManager, NodeManager` (+`Jps`); windows 4 (omit `SecondaryNameNode`). Random-looking but deterministic PIDs (seeded counter, not Math.random).
- Cluster-down fs commands ⇒ output containing
  `ls: Call From localhost to localhost:9000 failed on connection exception: java.net.ConnectException: Connection refused` (verb matches subcommand), `ok:false`.
- Unknown command ⇒ `<cmd>: command not found`; unknown fs flag ⇒ `-xyz: Unknown command`.

- [ ] Write failing tests: createState seeds (per OS), start/stop transitions, jps counts (5 vs 4), connection-refused gating, wrong-OS start hint, unknown command.
- [ ] Run `node --test test/` — expect FAIL (module missing).
- [ ] Implement `src/engine.js` core: tokenizer (quote-aware split), dispatch table, cluster + jps + gating.
- [ ] Run `node --test test/` — expect PASS.
- [ ] Commit `feat: engine core (cluster lifecycle, jps, connection gating)`.

### Task 2: Engine — HDFS + local fs commands (Lab 2 set)

**Files:**
- Modify: `src/engine.js`; Create/extend: `test/engine.test.mjs`

**Interfaces:**
- Consumes: Task 1 dispatch + trees.
- Produces (behaviour later tasks rely on): full Lab 2 command set working by effect:
  - `hadoop fs|hdfs dfs` + `-ls [path]` (`Found N items` + per-entry lines `drwxr-xr-x   - shinzuu supergroup          0 2026-07-27 10:00 /dir1`, files `-rw-r--r--   1 ...  <size> ... /path`), no-arg path = `/user/shinzuu` (auto-vivified message if absent: empty listing).
  - `-mkdir [-p] <path>` (`mkdir: '<path>': No such file or directory` without `-p` when parent missing; `mkdir: '<path>': File exists` when exists)
  - `-copyFromLocal|-put [-f] <local> <hdfs>` (resolves local path against `cwd`; space-unquoted paths with `Lab 2`-style dirs produce the URI error `copyFromLocal: unexpected URISyntaxException`; existing target without `-f` ⇒ `copyFromLocal: '<dst>': File exists`)
  - `-copyToLocal|-get <hdfs> <local>` (writes into local tree; missing hdfs src ⇒ `get: '<src>': No such file or directory`)
  - `-cat <path>` (prints file content; dir ⇒ `cat: '<path>': Is a directory`)
  - `-rm <path>` (`Deleted <path>`; dir without `-r` ⇒ `rm: '<path>': Is a directory`), `-rm -r [-skipTrash] <path>`, `-rmdir <path>` (`rmdir: '<path>': Directory is not empty` when non-empty)
  - local: `cd <dir>`, `ls`, `mkdir <dir>`, `pwd` (enough for the lab flow: cd into kit folder, mkdir downloaded)
- All fs outputs prefixed with the WARN line (single helper `warn()`); `ok:false` on any error line.

- [ ] Write failing tests: each command happy path + each listed error + alias equivalence (`put`≡`copyFromLocal`, `hdfs dfs`≡`hadoop fs`) + the full Lab 2 11-step sequence for linux AND windows ending with `/` containing only `/tmp`,`/user`.
- [ ] Run tests — FAIL.
- [ ] Implement.
- [ ] Run tests — PASS.
- [ ] Commit `feat: engine HDFS + local commands (Lab 2 set)`.

### Task 3: Engine — Lab 3 toolchain (javac, jar, hadoop jar, classpath)

**Files:**
- Modify: `src/engine.js`; extend: `test/engine.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–2 state/trees.
- Produces:
  - `hadoop classpath` → canned classpath string.
  - `javac -classpath <anything> -d . MatrixMultiplication.java` (also accepts `"$(hadoop classpath)"` literally or the Windows `%HADOOP_HOME%...` form): requires `MatrixMultiplication.java` in `cwd`; sets `state.compiled=true`, creates `*.class` entries locally. Missing file ⇒ `javac: file not found: MatrixMultiplication.java`.
  - `jar -cf MatrixMultiplication.jar *.class` (accept `-cvf` and Windows `-C . .` form): requires `compiled`; sets `jarBuilt`, creates jar file node.
  - `hadoop jar MatrixMultiplication.jar MatrixMultiplication <in> <out>`: requires cluster up, jar built, `<in>` exists in HDFS, `<out>` NOT exist (`org.apache.hadoop.mapred.FileAlreadyExistsException: Output directory hdfs://localhost:9000<out> already exists` otherwise). Success prints canned job log (`Running job: job_1784959837525_000N`, `map 0% reduce 0%` → `map 100% reduce 100%`, `Job ... completed successfully`) and creates `<out>/{_SUCCESS,part-r-00000}` where `part-r-00000` content is the tab-separated `0,0 19 / 0,1 22 / 1,0 43 / 1,1 50` verified output.
- [ ] Failing tests: full Lab 3 happy path (linux + windows variants), output-exists error, jar-before-javac error, run-before-put error.
- [ ] Run — FAIL. Implement. Run — PASS.
- [ ] Commit `feat: engine Lab 3 toolchain (javac/jar/hadoop jar)`.

### Task 4: Lessons data + recap/exam generation

**Files:**
- Create: `src/lessons.js`, `test/lessons.test.mjs`

**Interfaces:**
- Consumes: engine `State` shape (checks receive `(state, result)`).
- Produces: `MODULES` (array of `{id,title,steps[]}`), `buildRecap(module) -> steps[]`, `buildExam() -> steps[]`.
  Step: `{ theory?, question, check(state,result):boolean, hints:[h1,h2], answer(os):string, note? }` (3rd "hint" is always the revealed `answer(os)`).
- Module 1 "Start the cluster" (3 steps): start (theory: daemons/one cluster; check `state.clusterUp`), `jps` (check result.ok && ran jps; theory: 5 vs 4 daemons), ports quiz step asking to "open" `http://localhost:9870` typed as answer (simple echo command `open-ui 9870` handled in engine as no-op ack — implement as alias in lessons via check on result.output; simpler: make the step a terminal-typed `hadoop fs -ls /` warm-up instead. DECISION: step 3 = first `hadoop fs -ls /` with theory naming 9870/8088).
- Module 2 = the 11 Lab 2 steps from the kit README, same order, checks by effect (e.g. step "make /dir1": `hdfs has /dir1`). Include the cd-into-folder step (linux) / path form note (windows).
- Module 3 = Lab 3 sequence: mkdir `/bda2` → put `matrix.txt` → verify ls → javac → jar → pre-delete `/matrixoutput` (tolerate "doesn't exist") → run job → cat `part-r-00000` (check output contains `19` `22` `43` `50`).
- `buildRecap(m)`: same command families, fresh paths (`/college/notes`, `exam.txt`→copy, `/college` cleanup...), `theory` stripped, hints kept. Deterministic (no randomness).
- `buildExam()`: fresh-state full run: start → jps → mkdir/put/get/cat/rm cycle on `/final` → matrix job → cat result. ~14 steps, no theory, no hints until 2 failed attempts (flag `examMode:true` consumed by UI).
- Repetition audit: every core command family appears ≥3× across guided+recap+exam — test asserts this by counting `answer('linux')` matches per family.
- [ ] Failing tests: shapes valid, every step's `answer(os)` string actually passes its own `check` when run through the engine from the module's entry state, for all 3 OSes; repetition audit ≥3×.
- [ ] Run — FAIL. Implement. Run — PASS.
- [ ] Commit `feat: lessons for modules 1-3 + recap and exam generators`.

### Task 5: UI + build script → index.html

**Files:**
- Create: `src/app.js`, `src/style.css`, `src/template.html`, `build.mjs`; generate `index.html`.

**Interfaces:**
- Consumes: `createState/runCommand`, `MODULES/buildRecap/buildExam`.
- Produces: complete app. Key behaviours:
  - Screens: OS picker (3 big cards w/ icons; stored `bdalp.os`) → home (module cards + progress + Exam card + OS switcher in header) → step screen (progress bar, theory card, question, terminal, hint button, "aliases" note when triggered).
  - Terminal: prompt label per OS (`shinzuu@linux:~$` / `%` / `C:\BDA>`), monospace scrollback, ↑ history, Enter runs `runCommand`; on `check` pass → green ✓ + auto-advance (600 ms); fail → output shown, attempt counter++.
  - Hints: button cycles hint1 → hint2 → reveal answer; after reveal user still must type it (check unchanged).
  - Recap unlocks when module done; exam when all recaps done. Exam score = firstTryCorrect/total, stored `bdalp.best`.
  - Progress per-OS in `bdalp.progress.<os>`; "Reset progress" in footer.
  - `?test=1`: runs an in-page smoke suite (engine happy paths per OS + first step of each module) logging `PASS/FAIL` to console and page.
- `build.mjs`: replace `<!--INLINE:STYLE-->`, `<!--INLINE:ENGINE-->`, `<!--INLINE:LESSONS-->`, `<!--INLINE:APP-->` in template with file contents; write `index.html`. Fail loudly if a marker is missing.
- Style: mobile-first; dark slate terminal (#0d1117 panel, green prompt), light theory cards, single accent (Hadoop yellow #f6c915 sparingly), system font stack + `ui-monospace` for terminal; ≥44 px touch targets. Use frontend-design skill guidance at implementation time.
- [ ] Implement template/css/app; run `node build.mjs`; open `index.html?test=1` headlessly (chrome-devtools MCP) — all smoke tests PASS, no console errors.
- [ ] Manual flow check via browser: pick each OS, complete module 1, one Lab 2 step, hint cycle, one wrong command, exam entry. Mobile viewport (390×844) screenshot + desktop screenshot.
- [ ] Commit `feat: UI + single-file build`.

### Task 6: README, cross-link, final verify

**Files:**
- Create: `README.md`; Modify: `~/Documents/study/hadoop-bdal-lab-kit/README.md` (add playground link line).

- [ ] `README.md`: what it is, link to live URL placeholder `https://shinzuu.github.io/bdal-playground/`, how to use offline (download index.html), credits (`hossain-tamim/big_data_analytics_lab` for MatrixMultiplication.java/matrix.txt; own `hadoop-bdal-lab-kit`), note that it's a simulator not real Hadoop.
- [ ] Add cross-link in lab kit README ("🎮 Practice the commands interactively: …"), commit that repo separately.
- [ ] Full test run (`node --test test/`), rebuild, re-run `?test=1`. All green.
- [ ] Commit `docs: README + cross-link`. STOP — ask user before creating the public GitHub repo/pushing.

## Self-review notes

- Spec coverage: OS picker ✓(T5) theory→question→practice→hints ✓(T4/T5) repetition ≥3 ✓(T4 audit) simulated terminal ✓(T1–3) exam ✓(T4/T5) Pages-ready single file ✓(T5) credits+cross-link ✓(T6). Connection-refused teaching ✓(T1, M1 ordering: Module 2+ entry state has cluster stopped only in exam; guided Module 2 continues from started cluster — recap rounds reset HDFS content but keep cluster up; exam starts fully fresh).
- Module 1 step 3 ambiguity resolved inline (DECISION note).
- Single-file vs testability tension resolved via build.mjs inliner; artifact still self-contained.
