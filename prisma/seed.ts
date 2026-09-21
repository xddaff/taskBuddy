import { resetDemoData } from "../src/lib/repo";

async function main() {
  await resetDemoData();
  console.log("Seeded demo students and issues.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
