const { prompt } = require("enquirer");
const help = require("./src/help.js");
const checkAlerts = require("./src/checkAlerts.js");
const createAlerts = require("./src/createAlerts.js");
const createTerraform = require("./src/createTerraform.js");
const checkInfra = require("./src/checkInfrastructure.js");

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (action === "help") {
    await help();
    return;
  }

  if (action === "check-alerts") {
    await checkAlerts();
    return;
  }

  if (action === "create-alerts") {
    await createAlerts();
    return;
  }

  if (action === "create-terraform") {
    await createTerraform();
    return;
  }

  if (action === "check-infra") {
    await checkInfra();
    return;
  }

  // Perform other actions
}

main();
