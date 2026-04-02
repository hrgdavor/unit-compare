import { $ } from "bun";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = "D:/wrk/java/unit-compare";
const frameworkDirs = ["junit5", "testng"];

for (const fw of frameworkDirs) {
    const testDir = join(rootDir, fw, "src/test/java/hr/hrg/unit", fw);
    const files = readdirSync(testDir).filter(f => f.startsWith("PerformanceTest_"));
    
    for (const file of files) {
        const filePath = join(testDir, file);
        let content = readFileSync(filePath, "utf8");
        
        // Replace log calls
        // Old: .log("FW", "Name", System.currentTimeMillis() - startTime);
        // New: .log("FW", "Name", startTime, System.currentTimeMillis());
        
        const regex = /hr\.hrg\.unit\.PerformanceTracker\.log\("(\w+)", "([\w\.]+)", System\.currentTimeMillis\(\) - startTime\);/g;
        content = content.replace(regex, 'hr.hrg.unit.PerformanceTracker.log("$1", "$2", startTime, System.currentTimeMillis());');
        
        writeFileSync(filePath, content);
    }
}
console.log("Updated all test files.");
