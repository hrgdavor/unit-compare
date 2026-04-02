const fs = require('fs');
const path = require('path');

const modules = [
    { name: 'junit4', pkg: 'hr.hrg.unit.junit4', annotations: { setup: '@Before', test: '@Test', after: '@AfterClass', staticAfter: true } },
    { name: 'junit5', pkg: 'hr.hrg.unit.junit5', annotations: { setup: '@BeforeEach', test: '@Test', after: '@AfterAll', staticAfter: true } },
    { name: 'testng', pkg: 'hr.hrg.unit.testng', annotations: { setup: '@BeforeMethod', test: '@Test', after: '@AfterClass', staticAfter: false } }
];

const root = './';

for (const mod of modules) {
    const pkgDir = mod.pkg.replace(/\./g, '/');
    const dir = path.join(root, mod.name, 'src/test/java', pkgDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Remove existing
    fs.readdirSync(dir).forEach(file => { if (file.startsWith('PerformanceTest')) fs.unlinkSync(path.join(dir, file)); });

    for (let i = 1; i <= 20; i++) {
        const className = `PerformanceTest_${String(i).padStart(2, '0')}`;
        const imports = mod.name === 'junit4' ? 'import org.junit.*;' :
            mod.name === 'junit5' ? 'import org.junit.jupiter.api.*;' :
                'import org.testng.annotations.*;';

        const content = `package ${mod.pkg};
${imports}

public class ${className} {

    private long startTime;

    ${mod.annotations.setup}
    public void setUp() {
        startTime = System.currentTimeMillis();
    }

    @Test
    public void testMethod1() {
        runWorkload();
        hr.hrg.unit.PerformanceTracker.log("${mod.name.toUpperCase()}", "${className}.testMethod1", System.currentTimeMillis() - startTime);
    }

    @Test
    public void testMethod2() {
        runWorkload();
        hr.hrg.unit.PerformanceTracker.log("${mod.name.toUpperCase()}", "${className}.testMethod2", System.currentTimeMillis() - startTime);
    }

    private void runWorkload() {
        double result = 0;
        for (int i = 0; i < 1_000_000; i++) {
            result += Math.sin(i) + Math.cos(i);
        }
        if (result == 0.1234567) System.out.print(""); 
    }

    ${mod.annotations.after}
    public ${mod.annotations.staticAfter ? 'static ' : ''}void tearDown() {
        // hr.hrg.unit.PerformanceTracker.printSummary();
    }
}\n`;
        fs.writeFileSync(path.join(dir, className + '.java'), content);
    }
}
console.log('Generated 60 test classes across all modules.');
