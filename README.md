# Unit Testing Framework Performance Comparison (CI Simulation)

Benchmark and compare the performance of various unit testing frameworks in a **CI-realistic scenario**. It measures the total process execution time, including framework discovery, setup overhead, and test orchestration.

## 🏗️ Project Structure

- **[unit-compare (Parent)](pom.xml)**: Orchestrates the build.
- **[common](common/pom.xml)**: Shared utility for internal test timing.
- **Framework Modules**: `junit5` and `testng` all implement identical test logic:
    - **Scale**: **20 test classes per module** (40 total) to amplify discovery and orchestration overhead.
    - **Workload**: 1,000,000 iterations of `Math.sin(i) + Math.cos(i)` per test method.
- **[benchmark.js](scripts/benchmark.js)**: A Bun script that:
    1. Executes `mvn test` for each module multiple times.
    2. Measures **total process execution time** using `performance.now()`.
    3. Calculates averages, cold start (first run), and min/max times.

## 🚀 How to Run Benchmarks

To run the full CI simulation (5 iterations per framework) and generate a comparison report, use Bun:

```powershell
bun scripts/benchmark.js
```

## ✅ Latest Results

Results from a recent run (20 test classes per module, 3 iterations):

### ⚖️ Performance & Overhead Analysis (Averages)

We isolate the **Actual Benchmark Time** (wall-clock duration of the test suite) from **Overhead** (everything else: JVM startup, framework bootstrap, build lifecycle) to see the true cost of each layer.

| Framework [Mode]      | Type   | Total (ms) | Bench (ms) | Overhead (ms) | Overhead % | vs Direct   |
| --------------------- | ------ | ---------- | ---------- | ------------- | ---------- | ----------- |
| JUNIT5 [discovery]    | mvn    | 4426       | 402        | 4024          | 90.9%      | 453.2%      |
|                       | mvnd   | 2163       | 398        | 1765          | 81.6%      | 170.4%      |
|                       | Direct | 800        | 250        | 550           | 68.8%      |             |
| --------------------- | ------ | ---------- | ---------- | ------------- | ---------- | ----------- |
| JUNIT5 [explicit]     | mvn    | 3878       | 303        | 3575          | 92.2%      | 384.8%      |
|                       | mvnd   | 1828       | 291        | 1537          | 84.1%      | 128.5%      |
|                       | Direct | 800        | 270        | 530           | 66.3%      |             |
| --------------------- | ------ | ---------- | ---------- | ------------- | ---------- | ----------- |
| TESTNG [discovery]    | mvn    | 4291       | 485        | 3806          | 88.7%      | 351.7%      |
|                       | mvnd   | 2018       | 472        | 1546          | 76.6%      | 112.4%      |
|                       | Direct | 950        | 470        | 480           | 50.5%      |             |
| --------------------- | ------ | ---------- | ---------- | ------------- | ---------- | ----------- |
| TESTNG [explicit]     | mvn    | 4693       | 530        | 4163          | 88.7%      | 369.3%      |
|                       | mvnd   | 2117       | 512        | 1605          | 75.8%      | 111.7%      |
|                       | Direct | 1000       | 510        | 490           | 49.0%      |             |
| --------------------- | ------ | ---------- | ---------- | ------------- | ---------- | ----------- |

*\*Run on: Windows 11, JDK 21, Maven 3.9, mvnd 1.0. Results vary by background daemon state.*

---

## 🔍 Understanding the Three Execution Types

### ➊ Direct Execution (The Baseline)
Directly invoking the `ConsoleLauncher` (JUnit 5) or `TestNG` main class via `java`.
- **Overhead**: ~500-600ms.
- **Cost components**: JVM startup, class loading, framework bootstrap.
- **Efficiency**: Purest test execution, but requires manual classpath management and lacks build lifecycle integration.

### ➋ Standard Maven (mvn)
Executing `mvn test`.
- **Overhead**: ~3,500-4,200ms.
- **Why so slow?**: It starts a **new JVM** for Maven, parses POMs, runs the lifecycle, and then **forks a second JVM** for the tests. You pay the "Startup Tax" twice.
- **Use case**: Standard CI builds, ensuring a clean environment every time.

### ➌ Maven Daemon (mvnd)
Executing `mvnd test`.
- **Overhead**: ~1,500-1,800ms.
- **Why is it faster?**: It uses a **persistent background JVM (the daemon)** that stays warm. It reuses classloaders, avoids Maven startup time, and benefits from JIT-compiled code for the build logic.
- **Result**: Cuts Maven overhead by **50%+** while keeping full Maven compatibility.

---

## 💡 Proposals to Reduce Overhead

### Reducing Direct Execution Overhead (~520ms baseline)

These reduce the JVM/framework tax paid in both Direct and Maven runs:

1. **AppCDS (Application Class Data Sharing)** — *High impact, easy to apply*
   Precompute a `.jsa` archive of all classes on the test classpath. On subsequent runs, the JVM memory-maps the archive instead of re-parsing JARs, saving ~100–200ms of class loading.
   ```sh
   # Training run
   java -XX:ArchiveClassesAtExit=test.jsa -cp "..." org.junit.platform.console.ConsoleLauncher ...
   # Run with archive
   java -XX:SharedArchiveFile=test.jsa -cp "..." org.junit.platform.console.ConsoleLauncher ...
   ```

2. **`-XX:TieredStopAtLevel=1`** — *Already applied in this benchmark*
   Disables C2 JIT compilation, keeping only the fast interpreter + C1 tier. Saves ~50–100ms of compilation overhead in short-lived test runs, at the cost of peak throughput (irrelevant for unit tests).

3. **`-Xverify:none`** — *Medium impact, security trade-off*
   Skips bytecode verification entirely. Can save 50–100ms but removes a JVM safety guarantee. Acceptable in trusted CI environments, not for production.

4. **GraalVM Native Image** — *Extreme impact, high complexity*
   Compile the test runner + framework to a native binary. Startup drops to ~10–50ms. However, reflective class loading, dynamic proxies, and annotation scanning in JUnit/TestNG require extensive GraalVM configuration metadata. Not practical without a dedicated build pipeline.

5. **CRaC (Coordinated Restore at Checkpoint)** — *Near-zero overhead, requires CRaC JDK*
   Checkpoint a warmed-up JVM after framework initialization, restore it for each test run. Effectively eliminates all startup overhead. Requires a CRaC-enabled JDK (e.g., Azul Zulu CRaC) and coordination of open file handles. Promising for CI but not yet mainstream.

---

### Reducing Maven Orchestration Overhead (~3,100–3,600ms)

These directly target the Maven + Surefire layers:

1. **Use `mvnd` (Maven Daemon)** — *Highest impact, drop-in replacement*
   `mvnd` keeps a persistent JVM process warm, reusing class loaders and caching plugin/dependency metadata across invocations. Eliminates the ~300–500ms Maven JVM startup cost and reduces plugin loading overhead. Replace `mvn` with `mvnd` — no configuration needed.
   ```sh
   mvnd test -pl junit5 -Pdiscovery
   ```

2. **`-fae -o` (Fail-at-End + Offline mode)** — *Low effort, medium impact*
   `-o` skips network checks for SNAPSHOT updates and repository polling, saving ~100–200ms on each build.

3. **Disable Surefire forking with `forkCount=0`** — *High impact, loses test isolation*
   Runs tests in-process with Maven instead of forking a child JVM. Eliminates the ~300–500ms second JVM cost and the IPC overhead. Risk: static state leaks between test classes, and failures can corrupt the Maven process.
   ```xml
   <configuration>
     <forkCount>0</forkCount>
   </configuration>
   ```

4. **AppCDS for the Surefire forked JVM** — *Medium impact, complex setup*
   Configure the `argLine` in Surefire to pass `-XX:SharedArchiveFile=test.jsa`. The forked JVM reuses the prebuilt class archive, cutting its startup cost significantly.
   ```xml
   <argLine>-XX:SharedArchiveFile=test.jsa</argLine>
   ```

5. **Maven Build Cache Extension** — *High impact for repeated builds*
   If source files haven't changed, Maven can restore the previous `test` output from cache, skipping compilation and execution entirely. Ideal for CI pipelines where only a subset of modules change per commit.

6. **Parallel module builds with `-T`** — *High impact for multi-module projects*
   Build modules concurrently. Effective when you have many modules and modules have no interdependency at test time.
   ```sh
   mvn test -T 1C  # 1 thread per CPU core
   ```

---

## 🛠️ Testing Manually

You can run individual module tests using standard Maven:
```powershell
mvn test -pl junit5
mvn test -pl testng
```
