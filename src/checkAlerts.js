const { promisify } = require("util");
const { spawn } = require("child_process");
const { prompt } = require("enquirer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const az = (...args) =>
  new Promise((resolve, reject) => {
    const child = spawn("az", args, { shell: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", data => {
      stdout += data;
    });
    child.stderr.on("data", data => {
      stderr += data;
    });
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });

async function checkAlerts() {
 
  const resourceGroupName = await prompt({
    type: "input",
    name: "resourceGroupName",
    message: "Enter resource group name:"
  });

  const subscriptionId = await prompt({
    type: "input",
    name: "subscriptionId",
    message: "Enter subscription ID:"
  });
   // Log in with Azure CLI
   await az("login");
   const whoamiOutput = await az("account show --query name --output tsv");
   if (whoamiOutput.trim() === "ERROR: The account could not be signed in.") {
     console.log("Invalid credentials. Please try again.");
     await az("logout");
     await checkAlerts();
     return;
   }

  const result = JSON.parse(await az(`monitor metrics alert list -g ${resourceGroupName} --subscription ${subscriptionId} --output json`));
  if (result.message && result.message.startsWith("No resource namespace found for resource type")) {
    console.log("Invalid resource group or subscription ID. Please try again.");
    await checkAlerts();
    return;
  }
  
  const outputOption = await prompt({
    type: "select",
    name: "outputOption",
    message: "Select an output option:",
    choices: ["Console", "Log file"]
  });

  if (outputOption === "Log file") {
    const logDir = path.join(__dirname, "../log");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }
    const filename = `${resourceGroupName}-${uuidv4()}.json`;
    const filepath = path.join(logDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(result));
    console.log(`Results saved to log file: ${filename}`);
  } else {
    console.log(result);
  }
}

module.exports = checkAlerts;
