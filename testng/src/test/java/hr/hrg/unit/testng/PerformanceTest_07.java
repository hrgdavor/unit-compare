package hr.hrg.unit.testng;
import org.testng.annotations.*;

public class PerformanceTest_07 {

    private long startTime;

    @BeforeMethod
    public void setUp() {
        startTime = System.currentTimeMillis();
    }

    @Test
    public void testMethod1() {
        runWorkload();
        hr.hrg.unit.PerformanceTracker.log("TESTNG", "PerformanceTest_07.testMethod1", startTime, System.currentTimeMillis());
    }

    @Test
    public void testMethod2() {
        runWorkload();
        hr.hrg.unit.PerformanceTracker.log("TESTNG", "PerformanceTest_07.testMethod2", startTime, System.currentTimeMillis());
    }

    private void runWorkload() {
        double result = 0;
        for (int i = 0; i < 1_000_000; i++) {
            result += Math.sin(i) + Math.cos(i);
        }
        if (result == 0.1234567) System.out.print(""); 
    }

    @AfterClass
    public void tearDown() {
        // hr.hrg.unit.PerformanceTracker.printSummary();
    }
}
