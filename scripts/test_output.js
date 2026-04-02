import { $ } from "bun";
const mavenPath = "mvn";
const res = await $`${mavenPath} test -pl junit5 -Pdiscovery`.quiet().text();
console.log("Output contains RESULT|:", res.includes("RESULT|"));
if (res.includes("RESULT|")) {
    const lines = res.split("\n").filter(l => l.includes("RESULT|"));
    console.log("Total RESULT lines:", lines.length);
}
