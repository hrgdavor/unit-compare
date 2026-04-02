package hr.hrg.unit;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class PerformanceTracker {

    private static final ConcurrentHashMap<String, AtomicLong> executionTimes = new ConcurrentHashMap<>();
    private static long globalStartTime = Long.MAX_VALUE;
    private static long globalEndTime = Long.MIN_VALUE;

    public static synchronized void log(String framework, String testName, long start, long end) {
        long durationMs = end - start;
        String key = framework + "." + testName;
        executionTimes.computeIfAbsent(key, k -> new AtomicLong(0)).addAndGet(durationMs);
        
        if (start < globalStartTime) globalStartTime = start;
        if (end > globalEndTime) globalEndTime = end;
        
        long wallClock = globalEndTime - globalStartTime;
        // Still printing to stdout for debugging
        System.out.println("FINAL_BENCHMARK_WALL_CLOCK|" + wallClock);
        
        // Robust file writing for benchmark.js to read
        saveWallClock(wallClock);
    }

    private static void saveWallClock(long wallClock) {
        try {
            File targetDir = new File("target");
            if (!targetDir.exists()) {
                targetDir.mkdirs();
            }
            File statFile = new File(targetDir, "benchmark_wall_clock.txt");
            try (FileWriter fw = new FileWriter(statFile, false)) {
                fw.write(String.valueOf(wallClock));
            }
        } catch (IOException e) {
            // Silently ignore during benchmarking
        }
    }

    public static void reset() {
        executionTimes.clear();
        globalStartTime = Long.MAX_VALUE;
        globalEndTime = Long.MIN_VALUE;
    }
}
