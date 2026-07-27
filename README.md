# BDAL Lab Playground

**Learn the Hadoop lab by typing it.** A single-file, type-to-learn trainer for the BDAL
(Big Data Analytics Lab) course: cluster startup, HDFS commands (Lab 2), MapReduce matrix
multiplication (Lab 3), and an extended command toolbox — all inside a **simulated
terminal** that behaves like the real lab.

**Live:** https://shinzuu.github.io/bdal-playground/

## How it works

1. **Pick your OS** — Linux/WSL2, macOS, or native Windows. Start commands, local paths
   and daemon counts adapt to match your machine.
2. **Guided modules** — every step is: 1–2 lines of theory → a task → *you type the
   command* into the simulated terminal. First encounters break the command down word by
   word; wrong commands produce the real error messages (yes, including
   `Connection refused` when you forgot to start the cluster).
3. **Recap rounds** — same commands, new paths, no theory.
4. **Exam mode** — Lab 2 + Lab 3 start to finish from a fresh cluster, scored, hints
   locked until two misses.
5. **Sandbox** — a free-play terminal with the same simulated cluster.

Every core command gets typed at least three times (guided → recap → exam). That is the
whole point: the commands should be in your fingers before the lab, not on a cheat sheet.

## Modules

| # | Module | Covers |
|---|--------|--------|
| 1 | Boot the cluster | `hadoop-start` / `start-all.cmd`, `jps`, web UIs (9870 / 8088) |
| 2 | HDFS commands — Lab 2 | `-ls`, `-mkdir`, `-copyFromLocal`/`-put`, `-copyToLocal`/`-get`, `-cat`, `-rm`, `-rmdir`, `-rm -r` |
| 3 | Matrix multiply — Lab 3 | `javac` against the Hadoop classpath, `jar`, `hadoop jar`, reading `part-r-00000` (expect `19/22/43/50`) |
| 4 | Extended toolbox | `-cp`, `-mv`, `-touchz`, `-count`, `-du -h`, `-tail`, `hdfs dfsadmin -report`, `hadoop version` |

## Offline use

Download `index.html` — it is fully self-contained (no CDN, no network). Open it in any
browser. Progress is saved in your browser (localStorage), per OS.

## Development

```bash
node --test test/*.mjs   # engine + lesson tests
node build.mjs           # inlines src/ into index.html
```

`src/engine.js` is the simulator (pure functions, no DOM), `src/lessons.js` is the lesson
data, `src/app.js` the UI. Open `index.html?test=1` for the in-browser smoke suite.

This is a **simulator**: command behaviour and errors are faithful, output is canned.
It complements — not replaces — the real setup in the
[hadoop-bdal-lab-kit](https://github.com/shinzuu/hadoop-bdal-lab-kit).

## Credits

- `MatrixMultiplication.java` / `matrix.txt` originals:
  [hossain-tamim/big_data_analytics_lab](https://github.com/hossain-tamim/big_data_analytics_lab)
- Lab sequences and dual-OS notes: [hadoop-bdal-lab-kit](https://github.com/shinzuu/hadoop-bdal-lab-kit)
