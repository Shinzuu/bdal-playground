# BDAL Lab Playground — design spec (2026-07-27)

Interactive practice front-end for the BDAL Hadoop labs. A student picks their OS, then
drills the real lab command sequences (cluster start, Lab 2 HDFS commands, Lab 3 matrix
multiplication) in a **simulated in-browser terminal** until the commands are muscle memory.
Lab session is 2026-07-28 — this ships today.

## Goals

- Learn-by-typing: every command is typed into a working simulated terminal, never skipped.
- Each core command is typed **≥ 3 times** (guided step → module recap round → exam mode).
- Works for Linux, macOS, and native Windows — OS chosen first, switchable anytime.
- Public, shareable, phone-friendly. Hosted on GitHub Pages from a public repo
  (`bdal-playground`), cross-linked from `hadoop-bdal-lab-kit` (and later QuickXS).

## Non-goals

- No backend, no accounts, no shared state (progress is localStorage only).
- Not a real Hadoop shell — only the commands the labs use, plus realistic errors.
- No build system. One self-contained `index.html`, vanilla JS, no dependencies.

## Architecture (single file, three layers)

`index.html` contains three cleanly separated script sections:

1. **`LESSONS` data** (top of script): array of modules → steps.
   Step shape: `{ theory, question, check(state, cmdResult), hints[3], answer(os) }`.
   Answers/paths parameterized by OS. Recap rounds and exam mode are generated from the
   same steps (different paths/filenames, `theory` hidden).
2. **Engine** (pure functions): the simulator. `runCommand(state, input) -> {state', output}`.
   - State: `{ clusterUp, hdfs: tree, localFs: tree (per-OS seed), cwd, os }`.
   - Local seed files: `command3.txt`, `exampleput.txt`, `matrix.txt`,
     `MatrixMultiplication.java` at OS-appropriate paths (`~/kit/...` vs `C:/BDA/...`).
   - Commands: `hadoop fs` / `hdfs dfs` (equivalent) with `-ls`, `-mkdir [-p]`,
     `-copyFromLocal`/`-put [-f]`, `-copyToLocal`/`-get`, `-cat`, `-rm [-r] [-skipTrash]`,
     `-rmdir`; `jps`; cluster start/stop (`hadoop-start`/`hadoop-stop` on Linux/Mac,
     `start-all.cmd`/`stop-all.cmd` on Windows); `cd`/`ls`/`mkdir` (minimal local);
     Lab 3: `javac -classpath ...`, `jar -cf`, `hadoop classpath`, `hadoop jar` (canned
     job log ending `map 100% reduce 100%`), `hdfs dfs -cat /matrixoutput/part-r-00000`
     → verified `19/22/43/50` output.
   - Realism: `WARN util.NativeCodeLoader` line on every fs command (tooltip: harmless);
     `Found N items` ls format; **cluster-down ⇒ `Connection refused localhost:9000`**;
     "output directory already exists" if `/matrixoutput` not deleted before re-run;
     `jps` shows 5 daemons (Linux/Mac) or 4 (native Windows — no SecondaryNameNode).
3. **UI**: OS picker → module list → step view (theory card, question, terminal, hint
   button, progress bar). Exam mode with score. Mobile-first, dark terminal panel.

## Step validation

Checked by **effect on state** (e.g. "/dir1 exists"), not string match — so `put` and
`copyFromLocal` both pass, with an inline note that they are aliases. Hints are
progressive: nudge → syntax skeleton → full answer. After a reveal the student still
types the command to advance.

## Modules

1. **Cluster up** — start command (per OS), `jps` + expected daemon count, UI ports
   9870 (HDFS) / 8088 (YARN).
2. **HDFS commands (Lab 2)** — the README's exact 11-step sequence: ls root, mkdir,
   nested mkdir, copyFromLocal, copyToLocal, put/get, cat, rm, rmdir (empty-only),
   rm -r, final verify.
3. **Matrix multiply (Lab 3)** — mkdir `/bda2`, put `matrix.txt`, compile (`javac`
   against hadoop classpath), `jar`, delete old output, `hadoop jar ... /bda2/matrix.txt
   /matrixoutput`, cat `part-r-00000`, confirm `19/22/43/50`.

Then: per-module **recap round** (same commands, new paths, no theory) and a final
**exam mode** (full Lab 2+3 from fresh cluster, questions only, scored).

## Testing

Engine is pure; `?test=1` runs console self-tests (parser + state transitions + the
full happy path per OS + key error cases). Manual browser pass (desktop + mobile
viewport) before shipping.

## Delivery

- Repo `bdal-playground` (public, GitHub Pages). `index.html` + `README.md`
  (credits `hossain-tamim/big_data_analytics_lab`; links `hadoop-bdal-lab-kit`).
- Cross-link added in `hadoop-bdal-lab-kit/README.md`.
- **No repo creation / push without explicit user consent** (standing rule).
