const fs = require("fs");
const pdf = require("pdf-parse");

async function main() {
  const data = await pdf(fs.readFileSync("source-report.pdf"));
  console.log("pages", data.numpages);
  console.log(data.text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
