import readline from "node:readline";

readline.createInterface({ input: process.stdin }).once("line", () => {
  process.exit(23);
});
