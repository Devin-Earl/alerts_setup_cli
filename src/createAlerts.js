const { spawn } = require("child_process");
const { prompt } = require("enquirer");
const path = require("path");
const uuid = require("uuid");

const az = (...args) =>
  new Promise((resolve, reject) => {
    const child = spawn("az", args, { shell: true });
    let stdout = "";
    let stderr = "";

    child.on("error", (err) => {
      reject(err);
    });

    child.stdout.on("data", (data) => {
      stdout += data;
    });

    child.stderr.on("data", (data) => {
      stderr += data;
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });

const createAlerts = async () => {
  const subscriptionId = await prompt({
    type: "input",
    name: "subscriptionId",
    message: "Enter subscription ID:",
  });

  const scGroup = await prompt({
    type: "input",
    name: "scGroup",
    message: "Enter SC Group Name:",
  });

  const resources = JSON.parse(
    await az(
      `resource list --subscription ${subscriptionId} --query "[].{id: id, name: name, type: type, resourceGroup: resourceGroup, location: location}"`
    )
  );

  for (const resource of resources) {
    const vmName = resource.name;
    const vmId = resource.id;
    const resourceGroup = resource.resourceGroup;
    const location = resource.location;

    let osType = "";

    if (
      vmName.includes("wp") ||
      vmName.includes("wq") ||
      vmName.includes("wd")
    ) {
      osType = "Windows";
    } else if (
      vmName.includes("lp") ||
      vmName.includes("lq") ||
      vmName.includes("ld")
    ) {
      osType = "Linux";
    }

    if (osType === "") {
      continue;
    }

    const alertNameCpu = `${osType} CPU utilization alert for ${vmName}`;
    const alertNameMemory = `${osType} memory utilization alert for ${vmName}`;
    const alertNameDisk = `${osType} disk utilization alert for ${vmName}`;
    const alertNamePing = `${osType} ping status alert for ${vmName}`;
    const alertNameFileSystemWarning = `${osType} file system warning for ${vmName}`;
    const alertNameFileSystemAlarm = `${osType} file system alarm for ${vmName}`;
    const alertNamePatrol = `${osType} patrol agent down alert for ${vmName}`;

    // Create alerts
    await az(
      `monitor metrics alert create -n "${alertNameCpu}" --description "${alertNameCpu}" --condition "max percentage CPU > 98 for 10 minutes" --resource "${vmId}" --resource-group "${resourceGroup}" --subscription "${subscriptionId}" --window-size "10m" --evaluation-frequency "1m" --severity "2" --enabled true`
    );

    await az(
      `monitor metrics alert create -n "${alertNameMemory}" --description "${alertNameMemory}" --condition "max percentage memory < 98 for 10 minutes" --resource "${vmId}" --resource-group "${resourceGroup}" --subscription "${subscriptionId}" --window-size "10m" --evaluation-frequency "1m" --severity "2" --enabled true`
    );
    
