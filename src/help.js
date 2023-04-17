const { process } = require("enquirer");
const { prompt } = require("enquirer");
async function help() {
    console.log("Usage: node index.js [action]\n");
    console.log("Actions:");
    console.log("  check-alerts: Check existing alerts on an existing resource group in Azure");
    console.log("  create-alerts: Create a standard set of alerts for all resources on an existing resource group in Azure (Meets HCA Healthcare ORT Cloud alerts requirements)");
    console.log("  create-terraform: Generate Terraform configuration files for all resources in an existing resource group in Azure these files meet HCA Healthcare ORT standards");
    console.log("  check-infra: Audit all resources in a subscription for ORT readiness");

    const response = await prompt({
        type: "confirm",
        name: "exit",
        message: "Press Enter to exit",
        skip: true
      });
      
    if (response.exit) {
        process.exit(0);
    }
}

module.exports = help;
