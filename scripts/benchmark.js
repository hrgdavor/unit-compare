import { $ } from "bun";
import { join } from "path";
import { readFileSync, existsSync, unlinkSync } from "fs";

const frameworks = ["junit5", "testng"];
const modes = ["discovery", "explicit"];
const mavenPath  = "D:/programs/mvn/bin/mvn.cmd";
const mvndPath   = "D:/programs/mvnd/bin/mvnd";
const javaPath   = "\"C:/Program Files/Java/jdk-21/bin/java.exe\"";
const rootDir    = "D:/wrk/java/unit-compare";
const iterations = 3;

const testClasses = Array.from({ length: 20 }, (_, i) => `PerformanceTest_${String(i + 1).padStart(2, '0')}`);

function getClasspath(module) {
    const commonClasses = join(rootDir, "common", "target", "classes");
    const modClasses    = join(rootDir, module, "target", "classes");
    const modTestClasses = join(rootDir, module, "target", "test-classes");
    const libDir        = join(rootDir, module, "target/lib/*");
    return `${commonClasses};${modClasses};${modTestClasses};${libDir}`;
}

async function runCommand(cmd, module) {
    const start = performance.now();
    let actualTime = 0;
    
    // Clear previous stat file
    const statFile = join(rootDir, module, "target", "benchmark_wall_clock.txt");
    if (existsSync(statFile)) {
        unlinkSync(statFile);
    }
    
    try {
        const proc = $`${{ raw: cmd }}`.quiet();
        await proc.text(); // Still consume output to wait for completion
        
        // Read actual time from file for robustness
        if (existsSync(statFile)) {
            const content = readFileSync(statFile, "utf-8").trim();
            actualTime = parseInt(content, 10) || 0;
        }
    } catch (e) {
        console.error(`\n❌ Error running command: ${cmd}`);
        console.error(e.stderr?.toString() || e.message);
        throw e;
    }
    return { total: performance.now() - start, actual: actualTime };
}

function emptyResult() {
    return { runs: [], avg: 0, actualAvg: 0 };
}

async function benchmarkFramework(fw, mode) {
    console.log(`\n🚀 Benchmarking ${fw.toUpperCase()} [${mode.toUpperCase()}] (${iterations} iterations)...`);

    const results = {
        maven:  emptyResult(),
        mvnd:   emptyResult(),
        direct: emptyResult(),
    };

    const pkg = `hr.hrg.unit.${fw}`;
    const cp  = getClasspath(fw);
    // Suppress C2 JIT, keep heap small, use parallel GC
    const perfFlags = "-XX:TieredStopAtLevel=1 -Xms256m -Xmx256m -XX:+UseParallelGC";

    let directCmd = "";
    if (fw === "junit5") {
        const selectClasses = testClasses.map(c => `--select-class ${pkg}.${c}`).join(" ");
        directCmd = `${javaPath} ${perfFlags} -cp "${cp}" org.junit.platform.console.ConsoleLauncher execute ${selectClasses}`;
    } else if (fw === "testng") {
        const fullClasses = testClasses.map(c => `${pkg}.${c}`).join(",");
        directCmd = `${javaPath} ${perfFlags} -cp "${cp}" org.testng.TestNG -threadcount 4 -parallel classes -testclass ${fullClasses}`;
    }

    for (let i = 1; i <= iterations; i++) {
        // mvn run
        const mvnRes    = await runCommand(`${mavenPath} test -pl ${fw} -P${mode}`, fw);
        results.maven.runs.push(mvnRes);

        // mvnd run (warm daemon reused from iteration 2 onwards)
        const mvndRes   = await runCommand(`${mvndPath} test -pl ${fw} -P${mode}`, fw);
        results.mvnd.runs.push(mvndRes);

        // Direct Java run
        const directRes = await runCommand(directCmd, fw);
        results.direct.runs.push(directRes);

        const fmt = (r) => `Total ${r.total.toFixed(0)}ms | Bench ${r.actual.toFixed(0)}ms | Overhead ${(r.total - r.actual).toFixed(0)}ms`;
        process.stdout.write(
            `  Iteration ${i}:\n` +
            `    mvn:    ${fmt(mvnRes)}\n` +
            `    mvnd:   ${fmt(mvndRes)}\n` +
            `    Direct: ${fmt(directRes)}\n`
        );
    }

    const avg = (arr, key) => arr.reduce((a, b) => a + b[key], 0) / arr.length;
    results.maven.avg        = avg(results.maven.runs,  "total");
    results.maven.actualAvg  = avg(results.maven.runs,  "actual");
    results.mvnd.avg         = avg(results.mvnd.runs,   "total");
    results.mvnd.actualAvg   = avg(results.mvnd.runs,   "actual");
    results.direct.avg       = avg(results.direct.runs, "total");
    results.direct.actualAvg = avg(results.direct.runs, "actual");

    return results;
}

async function main() {
    console.log("📊 Multi-Framework Benchmark: mvn vs mvnd vs Direct Java");
    console.log("==========================================================");
    console.log(`Scale: 20 Test Classes per Framework (~40 Tests)`);
    console.log(`Iterations: ${iterations} (averages include all runs, daemon warms from iter 1)\n`);

    const allResults = [];
    for (const fw of frameworks) {
        for (const mode of modes) {
            const res = await benchmarkFramework(fw, mode);
            allResults.push({ fw, mode, res });
        }
    }

    // ─── Table ───────────────────────────────────────────────────────────────
    const SEP = "-".repeat(105);
    console.log(`\n📈 Final Comparison Table (Averages):`);
    console.log(SEP);
    console.log(`| ${"Framework [Mode]".padEnd(21)} | ${"Type  ".padEnd(6)} | ${"Total (ms)".padStart(10)} | ${"Bench (ms)".padStart(10)} | ${"Overhead (ms)".padStart(13)} | ${"Ovhd %".padStart(8)} | ${"vs Direct".padStart(11)} |`);
    console.log(SEP);

    for (const item of allResults) {
        const res = item.res;
        const label = `${item.fw.toUpperCase()} [${item.mode}]`;

        const row = (type, r, vsDirectAvg) => {
            const ovh    = r.avg - r.actualAvg;
            const ovhPct = ((ovh / r.avg) * 100).toFixed(1);
            const vsDirect = vsDirectAvg != null
                ? `${((r.avg / vsDirectAvg - 1) * 100).toFixed(1)}%`
                : "";
            return `| ${label.padEnd(21)} | ${type.padEnd(6)} | ${r.avg.toFixed(0).padStart(10)} | ${r.actualAvg.toFixed(0).padStart(10)} | ${ovh.toFixed(0).padStart(13)} | ${`${ovhPct}%`.padStart(8)} | ${vsDirect.padStart(11)} |`;
        };

        const dAvg = res.direct.avg;
        console.log(row("mvn",    res.maven,  dAvg));
        console.log(row("mvnd",   res.mvnd,   dAvg));
        console.log(row("Direct", res.direct, null));
        console.log(SEP);
    }

    // ─── mvnd daemon gain summary ─────────────────────────────────────────────
    console.log("\n🔥 mvnd Daemon Gain (mvn → mvnd avg savings):");
    for (const item of allResults) {
        const saved    = item.res.maven.avg - item.res.mvnd.avg;
        const savedPct = (saved / item.res.maven.avg * 100).toFixed(1);
        console.log(`  ${`${item.fw.toUpperCase()} [${item.mode}]`.padEnd(22)}: ${saved.toFixed(0).padStart(5)}ms saved  (${savedPct}% reduction)`);
    }

    console.log("\n💡 Notes:");
    console.log("  - 'Bench (ms)' = wall-clock time from first test start to last test end (respects parallelism).");
    console.log("  - 'Overhead'   = Total − Bench: JVM startup + framework init + Maven lifecycle + Surefire fork.");
    console.log("  - 'mvnd' reuses a persistent daemon JVM, eliminating per-invocation JVM startup and plugin reload.");
    console.log("  - Iteration 1 of mvnd includes cold-daemon cost; subsequent iterations benefit from full warmup.");
    console.log("  - 'Direct' uses explicit class selection as the lowest-overhead baseline.");
}

main().catch(console.error);
