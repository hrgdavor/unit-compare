package hr.hrg.unit.junit5;
import org.junit.jupiter.api.*;

public class PerformanceTest_13 {

    private long startTime;

    @BeforeEach
    public void setUp() {
        startTime = System.currentTimeMillis();
    }

    @Test
    public void testMethod1() {
        runWorkload();
        hr.hrg.unit.PerformanceTracker.log("JUNIT5", "PerformanceTest_13.testMethod1", startTime, System.currentTimeMillis());
    }

    @Test
    public void testMethod2() {
        runWorkload();
        hr.hrg.unit.PerformanceTracker.log("JUNIT5", "PerformanceTest_13.testMethod2", startTime, System.currentTimeMillis());
    }

    private void runWorkload() {
        double result = 0;
        for (int i = 0; i < 1_000_000; i++) {
            result += Math.sin(i) + Math.cos(i);
        }
        if (result == 0.1234567) System.out.print(""); 
    }

    @AfterAll
    public static void tearDown() {
        // hr.hrg.unit.PerformanceTracker.printSummary();
    }
}
