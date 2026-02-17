import * as fs from "fs";
import { join } from "path";

const outputDir = join(process.cwd(), "output");
const abiDir = join(process.cwd(), "abi");

if (!fs.existsSync(abiDir)) {
	fs.mkdirSync(abiDir);
}

const abiFiles = fs.readdirSync(outputDir).filter((f) => f.endsWith(".abi"));

for (const file of abiFiles) {
	const name = file.replace(".abi", "");
	const abiJson = fs.readFileSync(join(outputDir, file), "utf8").trim();
	const tsContent = `export const ${name} = ${abiJson} as const\n`;
	fs.writeFileSync(join(abiDir, `${name}.ts`), tsContent);
	console.log(`Generated abi/${name}.ts`);
}
