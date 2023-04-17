const { spawn } = require("child_process");
const { prompt } = require("enquirer");
const path = require("path");
const issues = [];
const uuid = require("uuid");
const infraCheckFolder = path.join(__dirname, "../logs/infraCheck");

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
  const checkInfrastructure = async () => {
    const resourceGroupName = await prompt({
      type: "input",
      name: "resourceGroupName",
      message: "Enter resource group name:",
    });
  
    const subscriptionId = await prompt({
      type: "input",
      name: "subscriptionId",
      message: "Enter subscription ID:",
    });
  
    const appCode = await prompt({
      type: "input",
      name: "appCode",
      message: "Enter app code:"
    });
  
    const scGroup= await prompt({
      type: "input",
      name: "scGroup",
      message: "Enter Expected Service Central group name:"
    });
  
    const projectId = await prompt({
      type: "input",
      name: "projectId",
      message: "Enter Expected Project ID:"
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
  
    const tags = {
      appCode: appCode,
      scGroup: scGroup,
      project_id:projectId
    };
const fileName = `${resourceGroupName}-${uuidv4()}.txt`;
const filePath = path.join(infraCheckFolder, fileName);
  
    const resources = JSON.parse(await az(`resource list --subscription ${subscriptionId} --resource-group ${resourceGroupName} --query "[].{id: id, tags: tags}" --output json`));
  
    for (const resource of resources) {
        const resourceId = resource.id;
        const resourceTags = resource.tags;
      
        for (const [key, value] of Object.entries(tags)) {
          if (!resourceTags.hasOwnProperty(key) || resourceTags[key] !== value) {
            issues.push(`Tags for ${resourceId} do not meet requirements: ${key}: ${value} - ${JSON.stringify(resourceTags)}`);
          }
        }
      
        if (!resourceTags.hasOwnProperty("app_environment")) {
          issues.push(`Tags for ${resourceId} do not meet requirements: app_environment tag missing - ${JSON.stringify(resourceTags)}`);
        }
      }
      
    // Network settings
    const networkSettings = JSON.parse(await az(`network vnet list -g ${resourceGroupName} --subscription ${subscriptionId} --query "[?publicIpAllocationMethod!='None' && name!='frontdoor_vnet'].name" --output json`));
    if (networkSettings.length > 0) {
        issues.push(`Network settings do not meet requirements: Firewall settings are not properly configured or related vNets/NSGs have Public Access allowed.`);
      }

    // Logging/Auditing/Diagnostic settings
    const loggingSettings = JSON.parse(await az(`monitor log-profiles list --subscription ${subscriptionId} --query "[?locations[0]=='eastus2' && category=='AuditLogs'].id" --output json`));
    if (loggingSettings.length === 0) {
  issues.push(`Logging/Auditing/Diagnostic settings do not meet requirements: Logging is not enabled or not set to Log Analytics Workspace 'log-hcahealthcare-shared-eastus2'.`);
}
    // Backups
    const backupSettings = JSON.parse(await az(`backup policy list --subscription ${subscriptionId} --query "[?properties.backupManagementType=='AzureIaasVM' && properties.policyType=='Scheduled'].id" --output json`));
    if (backupSettings.length === 0) {
        issues.push(`Backup settings do not meet requirements: Backups are not configured or not running successfully.`);
      }

         // Location
  const location = JSON.parse(await az(`group show -g ${resourceGroupName} --subscription ${subscriptionId} --query "location" --output json`));
  if (location !== "eastus2" && location !== "centralus") {
  issues.push(`Location does not meet requirements: Resource is located in '${location}' instead of 'eastus2' or 'centralus'.`);
}

  // IM roles
  const iamAssignments = JSON.parse(await az(`role assignment list --subscription ${subscriptionId} --scope /subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName} --query "[?principalType=='ServicePrincipal'].{principalName: principalName, principalId: principalId}" --output json`));
  for (const assignment of iamAssignments) {
    const principalName = assignment.principalName;
    const principalId = assignment.principalId;
  
    if (/^[a-zA-Z]{3}[a-zA-Z]{4}$/.test(principalName)) {
      issues.push(`IM roles for ${principalName} do not meet requirements: IM roles have been assigned directly to 3/4 IDs instead of groups. Principal ID: ${principalId}`);
    }
  }
  // Encryption
  const encryptionSettings = JSON.parse(await az(`resource list --subscription ${subscriptionId} --query "[?type=='Microsoft.Compute/virtualMachines'].id" --output json`));
  for (const resourceId of encryptionSettings) {
    const encryptionEnabled = JSON.parse(await az(`vm encryption show --ids ${resourceId} --query "dataDisk.[encryptionSettings.enabled, osDisk.[encryptionSettings.enabled]]" --output json`));
    if (encryptionEnabled.some(e => e === false)) {
      issues.push(`Encryption settings do not meet requirements: Data is not encrypted on the virtual machine ${resourceId}.`);
    }
  }
  for (const resourceId of encryptionSettings) {
    const encryptionEnabled = JSON.parse(await az(`vm encryption show --ids ${resourceId} --query "dataDisk.[encryptionSettings.enabled, osDisk.[encryptionSettings.enabled]]" --output json`));
    if (encryptionEnabled.some(e => e === false)) {
      issues.push(`Encryption settings do not meet requirements: Data is not encrypted on the virtual machine ${resourceId}.`);
    }
  }
 
  // Check if standard alerts exist for Windows and Linux VMs
const windowsVMs = JSON.parse(await az(`vm list --subscription ${subscriptionId} --resource-group ${resourceGroupName} --query "[?contains(name, 'wp') || contains(name, 'wq') || contains(name, 'wd')]" --output json`));
const linuxVMs = JSON.parse(await az(`vm list --subscription ${subscriptionId} --resource-group ${resourceGroupName} --query "[?contains(name, 'lp') || contains(name, 'lq') || contains(name, 'ld')]" --output json`));

const windowsAlerts = ["Windows CPU Usage", "Windows Memory Usage", "Windows Disk Space"];
const linuxAlerts = ["Linux CPU Usage", "Linux Memory Usage", "Linux Disk Space"];

for (const vm of windowsVMs) {
  for (const alert of windowsAlerts) {
    const alertName = `${vm.name} - ${alert}`;
    const alertExists = JSON.parse(await az(`monitor metrics alert list --subscription ${subscriptionId} --resource ${vm.id} --query "[?name=='${alertName}']" --output json`));
    if (alertExists.length === 0) {
      issues.push(`Standard alert '${alertName}' does not exist for Windows VM '${vm.name}'.`);
    }
  }
}

for (const vm of linuxVMs) {
  for (const alert of linuxAlerts) {
    const alertName = `${vm.name} - ${alert}`;
    const alertExists = JSON.parse(await az(`monitor metrics alert list --subscription ${subscriptionId} --resource ${vm.id} --query "[?name=='${alertName}']" --output json`));
    if (alertExists.length === 0) {
      issues.push(`Standard alert '${alertName}' does not exist for Linux VM '${vm.name}'.`);
    }
  }
}

  // Create logs/infraCheck folder if it doesn't exist
if (!fs.existsSync(logsFolder)) {
    fs.mkdirSync(logsFolder);
  }
  if (!fs.existsSync(infraCheckFolder)) {
    fs.mkdirSync(infraCheckFolder);
  }
  
  // Write issues to file
  if (issues.length > 0) {
    const content = issues.join('\n');
    fs.writeFileSync(filePath, content);
    console.log(`Issues with infrastructure configuration written to file: ${filePath}`);
  }
};

  module.exports = checkInfrastructure;