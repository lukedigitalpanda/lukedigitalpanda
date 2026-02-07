import { PrismaClient, UserRole, TicketStatus, TicketPriority, TicketSource, AssetType, AssetStatus, ChangeType, ChangeRequestStatus, ChangeRisk } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data (respecting FK order)
  await prisma.changeRequestComment.deleteMany();
  await prisma.changeRequest.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.ticketActivity.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.knowledgeArticle.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.emailSyncState.deleteMany();

  console.log("Cleaned existing data");

  // Create users
  const admin = await prisma.user.create({
    data: { name: "Alex Morgan", email: "admin@digitalpanda.co.uk", passwordHash: "demo", role: "ADMIN", jobTitle: "Service Desk Manager" },
  });
  const manager = await prisma.user.create({
    data: { name: "Sarah Chen", email: "sarah@digitalpanda.co.uk", passwordHash: "demo", role: "MANAGER", jobTitle: "Operations Manager" },
  });
  const tech1 = await prisma.user.create({
    data: { name: "James Wilson", email: "james@digitalpanda.co.uk", passwordHash: "demo", role: "TECHNICIAN", jobTitle: "Senior Engineer" },
  });
  const tech2 = await prisma.user.create({
    data: { name: "Emma Taylor", email: "emma@digitalpanda.co.uk", passwordHash: "demo", role: "TECHNICIAN", jobTitle: "Support Engineer" },
  });

  console.log("Created users");

  // Create clients
  const clients = await Promise.all([
    prisma.client.create({ data: { name: "Northwind Trading", email: "it@northwind.co.uk", phone: "020 7123 4567", website: "https://northwind.co.uk", address: "10 Downing Business Park, London EC1A 1BB", contractType: "Managed", slaLevel: "Gold", notes: "Key client - 50 employees, full managed service" } }),
    prisma.client.create({ data: { name: "Contoso Ltd", email: "support@contoso.co.uk", phone: "0161 456 7890", website: "https://contoso.co.uk", address: "Manchester Business Centre, M1 2AB", contractType: "Managed", slaLevel: "Silver", notes: "30 employees, standard managed package" } }),
    prisma.client.create({ data: { name: "Fabrikam Industries", email: "helpdesk@fabrikam.co.uk", phone: "0121 789 0123", website: "https://fabrikam.co.uk", address: "45 Innovation Drive, Birmingham B2 4QA", contractType: "Break-Fix", slaLevel: "Bronze", notes: "Break-fix only, 15 employees" } }),
    prisma.client.create({ data: { name: "Adventure Works", email: "tech@adventureworks.co.uk", phone: "0113 234 5678", website: "https://adventureworks.co.uk", address: "Leeds Digital Hub, LS1 5PL", contractType: "Managed", slaLevel: "Gold", notes: "Premium client - 80 employees, Azure infrastructure" } }),
    prisma.client.create({ data: { name: "Tailspin Toys", email: "it@tailspintoys.co.uk", phone: "01onal 345 6789", address: "Bristol Retail Park, BS1 3XD", contractType: "Project", slaLevel: "Silver", notes: "Ongoing migration project" } }),
  ]);

  console.log("Created clients");

  // Create contacts for each client
  const contacts = await Promise.all([
    prisma.clientContact.create({ data: { clientId: clients[0].id, name: "John Mitchell", email: "j.mitchell@northwind.co.uk", phone: "020 7123 4568", jobTitle: "IT Director", isPrimary: true } }),
    prisma.clientContact.create({ data: { clientId: clients[0].id, name: "Lisa Parker", email: "l.parker@northwind.co.uk", phone: "020 7123 4569", jobTitle: "Office Manager" } }),
    prisma.clientContact.create({ data: { clientId: clients[1].id, name: "David Brown", email: "d.brown@contoso.co.uk", phone: "0161 456 7891", jobTitle: "Operations Manager", isPrimary: true } }),
    prisma.clientContact.create({ data: { clientId: clients[1].id, name: "Rachel Green", email: "r.green@contoso.co.uk", jobTitle: "Receptionist" } }),
    prisma.clientContact.create({ data: { clientId: clients[2].id, name: "Tom Williams", email: "t.williams@fabrikam.co.uk", phone: "0121 789 0124", jobTitle: "Managing Director", isPrimary: true } }),
    prisma.clientContact.create({ data: { clientId: clients[3].id, name: "Sophie Turner", email: "s.turner@adventureworks.co.uk", phone: "0113 234 5679", jobTitle: "CTO", isPrimary: true } }),
    prisma.clientContact.create({ data: { clientId: clients[3].id, name: "Mike Johnson", email: "m.johnson@adventureworks.co.uk", jobTitle: "Systems Administrator" } }),
    prisma.clientContact.create({ data: { clientId: clients[4].id, name: "Chris Evans", email: "c.evans@tailspintoys.co.uk", phone: "0117 345 6790", jobTitle: "IT Manager", isPrimary: true } }),
  ]);

  console.log("Created contacts");

  // Create tickets
  const now = new Date();
  const tickets = await Promise.all([
    prisma.ticket.create({ data: { subject: "Unable to access shared drive", description: "Multiple users at Northwind are reporting they cannot access the \\\\fileserver\\shared drive. Getting 'access denied' errors since this morning. Approximately 15 users affected.", status: "OPEN", priority: "HIGH", category: "Network", source: "EMAIL", clientId: clients[0].id, contactId: contacts[0].id, assigneeId: tech1.id, createdById: admin.id, slaDeadline: new Date(now.getTime() + 4 * 3600000), aiCategory: "Network", aiConfidence: 0.92, aiSummary: "File share access issue affecting multiple users - likely permissions or server connectivity problem" } }),
    prisma.ticket.create({ data: { subject: "Outlook keeps crashing on startup", description: "User Lisa Parker reports Outlook 365 crashes immediately on startup. Have tried restarting the PC. Running Windows 11, Office 365 Business.", status: "IN_PROGRESS", priority: "MEDIUM", category: "Software", source: "PHONE", clientId: clients[0].id, contactId: contacts[1].id, assigneeId: tech2.id, createdById: admin.id, slaDeadline: new Date(now.getTime() + 8 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "New starter - laptop setup required", description: "New employee starting Monday 10th. Need a laptop configured with standard SOE, Office 365, VPN, and access to Contoso systems. Employee: Mark Stevens, Role: Marketing Coordinator.", status: "IN_PROGRESS", priority: "MEDIUM", category: "Hardware", source: "PORTAL", clientId: clients[1].id, contactId: contacts[2].id, assigneeId: tech1.id, createdById: manager.id, slaDeadline: new Date(now.getTime() + 24 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "Printer not printing - HP LaserJet", description: "The HP LaserJet Pro in the main office at Contoso has stopped printing. Shows as online in Windows but jobs queue and never print. Tried restarting printer.", status: "WAITING_ON_VENDOR", priority: "LOW", category: "Printing", source: "EMAIL", clientId: clients[1].id, contactId: contacts[3].id, assigneeId: tech2.id, createdById: admin.id, slaDeadline: new Date(now.getTime() + 48 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "Suspicious email received - possible phishing", description: "Tom Williams received an email claiming to be from Microsoft asking to verify his account. Email looks suspicious. Has not clicked any links. Forwarded to us for analysis.", status: "OPEN", priority: "HIGH", category: "Security", source: "EMAIL", clientId: clients[2].id, contactId: contacts[4].id, assigneeId: tech1.id, createdById: admin.id, slaDeadline: new Date(now.getTime() + 2 * 3600000), aiCategory: "Security", aiConfidence: 0.95, aiSuggestion: "Analyse email headers, check sender domain, scan any attachments in sandbox. If confirmed phishing, block sender domain and alert all users." } }),
    prisma.ticket.create({ data: { subject: "Azure VM performance degradation", description: "The production web server VM in Azure is experiencing slow response times. CPU usage spiking to 95% during business hours. Started 2 days ago after the latest Windows update.", status: "IN_PROGRESS", priority: "CRITICAL", category: "Network", source: "MANUAL", clientId: clients[3].id, contactId: contacts[5].id, assigneeId: tech1.id, createdById: tech1.id, slaDeadline: new Date(now.getTime() + 1 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "VPN connection dropping frequently", description: "Sophie Turner reports VPN connection drops every 30-60 minutes when working from home. Using FortiClient VPN. Home internet seems stable. Issue started this week.", status: "OPEN", priority: "MEDIUM", category: "Network", source: "PORTAL", clientId: clients[3].id, contactId: contacts[5].id, createdById: admin.id, slaDeadline: new Date(now.getTime() + 8 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "Backup failure - Veeam error", description: "Nightly backup job for Adventure Works file server failed with error code 32768. Last successful backup was 3 days ago. Need urgent investigation.", status: "OPEN", priority: "CRITICAL", category: "Backup", source: "MANUAL", clientId: clients[3].id, contactId: contacts[6].id, assigneeId: tech1.id, createdById: tech1.id, slaDeadline: new Date(now.getTime() + 1 * 3600000), aiCategory: "Backup", aiConfidence: 0.88 } }),
    prisma.ticket.create({ data: { subject: "Microsoft 365 migration - Phase 2", description: "Continue Phase 2 of the M365 migration for Tailspin Toys. Need to migrate remaining 10 mailboxes and configure SharePoint Online sites per the project plan.", status: "IN_PROGRESS", priority: "MEDIUM", category: "Email", source: "MANUAL", clientId: clients[4].id, contactId: contacts[7].id, assigneeId: manager.id, createdById: manager.id, slaDeadline: new Date(now.getTime() + 48 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "Password reset request", description: "User David Brown locked out of his account after too many failed attempts. Needs password reset for AD and M365.", status: "RESOLVED", priority: "LOW", category: "Account/Access", source: "PHONE", clientId: clients[1].id, contactId: contacts[2].id, assigneeId: tech2.id, createdById: admin.id, resolvedAt: new Date(now.getTime() - 2 * 3600000), slaDeadline: new Date(now.getTime() + 24 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "Monitor flickering intermittently", description: "John Mitchell's Dell monitor is flickering intermittently. Already tried different cables and ports. Monitor is 2 years old, still under warranty.", status: "WAITING_ON_VENDOR", priority: "LOW", category: "Hardware", source: "EMAIL", clientId: clients[0].id, contactId: contacts[0].id, assigneeId: tech2.id, createdById: admin.id, slaDeadline: new Date(now.getTime() + 72 * 3600000) } }),
    prisma.ticket.create({ data: { subject: "Website SSL certificate expiring", description: "SSL certificate for adventureworks.co.uk expires in 5 days. Need to renew and install. Current provider is Let's Encrypt.", status: "OPEN", priority: "HIGH", category: "Security", source: "MANUAL", clientId: clients[3].id, contactId: contacts[5].id, assigneeId: tech1.id, createdById: tech1.id, slaDeadline: new Date(now.getTime() + 4 * 3600000) } }),
  ]);

  console.log("Created tickets");

  // Create ticket comments
  await Promise.all([
    prisma.ticketComment.create({ data: { ticketId: tickets[0].id, authorId: tech1.id, content: "Investigating the file server. Checking permissions and connectivity now.", isInternal: true } }),
    prisma.ticketComment.create({ data: { ticketId: tickets[0].id, authorId: tech1.id, content: "Hi John, we're looking into the shared drive access issue. Can you confirm if this affects all shared folders or just specific ones?", isInternal: false } }),
    prisma.ticketComment.create({ data: { ticketId: tickets[1].id, authorId: tech2.id, content: "Tried repairing Office installation. Running SFC scan now.", isInternal: true } }),
    prisma.ticketComment.create({ data: { ticketId: tickets[5].id, authorId: tech1.id, content: "Azure VM CPU analysis shows the .NET worker process consuming excessive resources. Likely related to KB5034441 update. Planning to roll back the update.", isInternal: true } }),
    prisma.ticketComment.create({ data: { ticketId: tickets[5].id, authorId: tech1.id, content: "Hi Sophie, we've identified the issue with your production server and are working on a fix. We expect to have this resolved within the next 2 hours.", isInternal: false } }),
    prisma.ticketComment.create({ data: { ticketId: tickets[9].id, authorId: tech2.id, content: "Password has been reset. User confirmed access restored. Closing ticket.", isInternal: false } }),
  ]);

  console.log("Created comments");

  // Create time entries
  await Promise.all([
    prisma.timeEntry.create({ data: { ticketId: tickets[0].id, userId: tech1.id, description: "Initial investigation of file share permissions", minutes: 30, billable: true } }),
    prisma.timeEntry.create({ data: { ticketId: tickets[1].id, userId: tech2.id, description: "Office repair and diagnostics", minutes: 45, billable: true } }),
    prisma.timeEntry.create({ data: { ticketId: tickets[2].id, userId: tech1.id, description: "Laptop imaging and configuration", minutes: 120, billable: true } }),
    prisma.timeEntry.create({ data: { ticketId: tickets[5].id, userId: tech1.id, description: "Azure VM performance analysis and remediation", minutes: 90, billable: true } }),
    prisma.timeEntry.create({ data: { ticketId: tickets[8].id, userId: manager.id, description: "M365 mailbox migration batch 2", minutes: 180, billable: true } }),
    prisma.timeEntry.create({ data: { ticketId: tickets[9].id, userId: tech2.id, description: "Password reset and verification", minutes: 10, billable: false } }),
  ]);

  console.log("Created time entries");

  // Create assets
  await Promise.all([
    // Northwind assets
    prisma.asset.create({ data: { name: "NW-PC-001", assetTag: "NW-PC-001", type: "WORKSTATION", status: "ACTIVE", manufacturer: "Dell", model: "OptiPlex 7090", serialNumber: "DELL7090NW001", clientId: clients[0].id, hostname: "NW-PC-001", ipAddress: "192.168.1.101" } }),
    prisma.asset.create({ data: { name: "NW-PC-002", assetTag: "NW-PC-002", type: "WORKSTATION", status: "ACTIVE", manufacturer: "Dell", model: "OptiPlex 7090", serialNumber: "DELL7090NW002", clientId: clients[0].id, hostname: "NW-PC-002", ipAddress: "192.168.1.102" } }),
    prisma.asset.create({ data: { name: "NW-SRV-001", assetTag: "NW-SRV-001", type: "SERVER", status: "ACTIVE", manufacturer: "Dell", model: "PowerEdge R740", serialNumber: "DELLR740NW001", clientId: clients[0].id, hostname: "NW-FS01", ipAddress: "192.168.1.10", notes: "Primary file server" } }),
    prisma.asset.create({ data: { name: "NW-SW-001", assetTag: "NW-FW-001", type: "NETWORK_DEVICE", status: "ACTIVE", manufacturer: "Fortinet", model: "FortiGate 60F", serialNumber: "FG60FNW001", clientId: clients[0].id, hostname: "NW-FW01", ipAddress: "192.168.1.1" } }),
    prisma.asset.create({ data: { name: "NW-LIC-M365", assetTag: "NW-LIC-001", type: "SOFTWARE_LICENSE", status: "ACTIVE", manufacturer: "Microsoft", model: "Microsoft 365 Business Premium", clientId: clients[0].id, licenseKey: "XXXXX-XXXXX-XXXXX-XXXXX", licenseExpiry: new Date("2025-12-31"), notes: "50 seats" } }),
    // Contoso assets
    prisma.asset.create({ data: { name: "CT-LAP-001", assetTag: "CT-LAP-001", type: "LAPTOP", status: "ACTIVE", manufacturer: "Lenovo", model: "ThinkPad T14s", serialNumber: "LENT14SCT001", clientId: clients[1].id, hostname: "CT-LAP-001" } }),
    prisma.asset.create({ data: { name: "CT-LAP-002", assetTag: "CT-LAP-002", type: "LAPTOP", status: "ACTIVE", manufacturer: "Lenovo", model: "ThinkPad T14s", serialNumber: "LENT14SCT002", clientId: clients[1].id, hostname: "CT-LAP-002" } }),
    prisma.asset.create({ data: { name: "CT-PRN-001", assetTag: "CT-PRN-001", type: "PRINTER", status: "IN_REPAIR", manufacturer: "HP", model: "LaserJet Pro M404dn", serialNumber: "HPLJ404CT001", clientId: clients[1].id, ipAddress: "192.168.2.200", notes: "Currently not printing - ticket open" } }),
    prisma.asset.create({ data: { name: "CT-SRV-001", assetTag: "CT-SRV-001", type: "SERVER", status: "ACTIVE", manufacturer: "HP", model: "ProLiant DL380 Gen10", serialNumber: "HPDL380CT001", clientId: clients[1].id, hostname: "CT-DC01", ipAddress: "192.168.2.10", notes: "Domain controller" } }),
    // Adventure Works assets
    prisma.asset.create({ data: { name: "AW-SRV-AZ01", assetTag: "AW-AZ-001", type: "SERVER", status: "ACTIVE", manufacturer: "Microsoft", model: "Azure VM - D4s v3", clientId: clients[3].id, hostname: "AW-WEB01", ipAddress: "10.0.1.10", notes: "Production web server - Azure" } }),
    prisma.asset.create({ data: { name: "AW-SRV-AZ02", assetTag: "AW-AZ-002", type: "SERVER", status: "ACTIVE", manufacturer: "Microsoft", model: "Azure VM - D2s v3", clientId: clients[3].id, hostname: "AW-DB01", ipAddress: "10.0.1.11", notes: "Database server - Azure SQL" } }),
    prisma.asset.create({ data: { name: "AW-FW-001", assetTag: "AW-FW-001", type: "NETWORK_DEVICE", status: "ACTIVE", manufacturer: "Fortinet", model: "FortiGate 100F", serialNumber: "FG100FAW001", clientId: clients[3].id, ipAddress: "10.0.0.1" } }),
    // Fabrikam assets
    prisma.asset.create({ data: { name: "FB-PC-001", assetTag: "FB-PC-001", type: "WORKSTATION", status: "ACTIVE", manufacturer: "HP", model: "EliteDesk 800 G9", serialNumber: "HPED800FB001", clientId: clients[2].id, hostname: "FB-PC-001", ipAddress: "192.168.3.101" } }),
    prisma.asset.create({ data: { name: "FB-LIC-AV", assetTag: "FB-LIC-001", type: "SOFTWARE_LICENSE", status: "ACTIVE", manufacturer: "SentinelOne", model: "SentinelOne Complete", clientId: clients[2].id, licenseExpiry: new Date("2025-06-30"), notes: "15 endpoints" } }),
  ]);

  console.log("Created assets");

  // Create change requests
  await Promise.all([
    prisma.changeRequest.create({ data: { title: "Firewall rule update - Northwind VPN", description: "Add new VPN split tunnel rules for Northwind Trading to allow direct access to Microsoft 365 endpoints.", reason: "Improve VPN performance and reduce bandwidth on the tunnel for M365 traffic.", type: "STANDARD", status: "APPROVED", priority: "MEDIUM", risk: "LOW", implementationPlan: "1. Backup current firewall config\n2. Add split tunnel rules for M365 IP ranges\n3. Test VPN connectivity\n4. Monitor for 24 hours", rollbackPlan: "Restore firewall config from backup", testingPlan: "Test VPN connection from 3 different users. Verify M365 access. Check VPN throughput.", clientId: clients[0].id, createdById: tech1.id, approverId: manager.id, approvedAt: new Date(), scheduledStart: new Date(now.getTime() + 24 * 3600000), scheduledEnd: new Date(now.getTime() + 26 * 3600000) } }),
    prisma.changeRequest.create({ data: { title: "Server OS upgrade - Contoso DC", description: "Upgrade Contoso domain controller from Windows Server 2019 to Windows Server 2022.", reason: "Windows Server 2019 approaching end of mainstream support. Need to upgrade to maintain security compliance.", type: "NORMAL", status: "UNDER_REVIEW", priority: "HIGH", risk: "HIGH", implementationPlan: "1. Build new Server 2022 VM\n2. Promote as additional DC\n3. Transfer FSMO roles\n4. Demote old DC\n5. Decommission old server", rollbackPlan: "Transfer FSMO roles back to original DC and demote new server", testingPlan: "Verify AD replication, DNS resolution, GPO application, user authentication from all workstations", clientId: clients[1].id, createdById: tech1.id, scheduledStart: new Date(now.getTime() + 7 * 24 * 3600000), scheduledEnd: new Date(now.getTime() + 8 * 24 * 3600000) } }),
    prisma.changeRequest.create({ data: { title: "Emergency - SSL certificate renewal", description: "SSL certificate for adventureworks.co.uk expiring in 5 days. Emergency renewal required.", reason: "Certificate expiry will cause website downtime and security warnings for all visitors.", type: "EMERGENCY", status: "DRAFT", priority: "CRITICAL", risk: "MEDIUM", implementationPlan: "1. Generate new CSR\n2. Submit to Let's Encrypt\n3. Install new certificate\n4. Verify HTTPS functionality", rollbackPlan: "Re-install previous certificate if new one causes issues", clientId: clients[3].id, createdById: tech1.id } }),
  ]);

  console.log("Created change requests");

  // Create knowledge articles
  await Promise.all([
    prisma.knowledgeArticle.create({ data: { title: "How to reset a user's Microsoft 365 password", content: "## Steps to reset an M365 password\n\n1. Sign in to the Microsoft 365 admin center (admin.microsoft.com)\n2. Go to Users > Active users\n3. Select the user\n4. Click 'Reset password'\n5. Choose to auto-generate or manually set the password\n6. Optionally require the user to change password on next sign-in\n7. Send the new password to the user securely\n\n## Important Notes\n- If MFA is enabled, the user may need to re-register their authentication methods\n- Password changes sync across all M365 services within a few minutes\n- Check if the account is synced from on-premises AD (if so, reset there instead)", category: "Account/Access", tags: ["password", "microsoft-365", "reset", "admin"], isPublic: false, authorId: tech2.id } }),
    prisma.knowledgeArticle.create({ data: { title: "VPN troubleshooting guide - FortiClient", content: "## Common VPN Issues and Solutions\n\n### Connection drops frequently\n1. Check internet stability (run ping test)\n2. Update FortiClient to latest version\n3. Try switching between TCP and UDP protocols\n4. Disable any conflicting VPN or firewall software\n5. Check if ISP is throttling VPN traffic\n\n### Cannot connect at all\n1. Verify VPN server address is correct\n2. Check user credentials\n3. Ensure FortiClient is not blocked by local firewall\n4. Try connecting on a different network\n5. Check VPN license count on FortiGate\n\n### Slow performance\n1. Check split tunnel configuration\n2. Test bandwidth without VPN\n3. Try connecting to a different VPN gateway\n4. Check server-side CPU and memory", category: "Network", tags: ["vpn", "forticlient", "fortinet", "troubleshooting"], isPublic: false, authorId: tech1.id } }),
    prisma.knowledgeArticle.create({ data: { title: "Standard Operating Environment (SOE) - New PC Setup", content: "## New PC Setup Checklist\n\n### Hardware\n- [ ] Unbox and inspect for damage\n- [ ] Record serial number and asset tag\n- [ ] Connect to network\n\n### OS Configuration\n- [ ] Join to domain\n- [ ] Run Windows Update\n- [ ] Configure power settings\n- [ ] Enable BitLocker encryption\n\n### Software Installation\n- [ ] Microsoft 365 Apps\n- [ ] SentinelOne endpoint protection\n- [ ] FortiClient VPN\n- [ ] Adobe Acrobat Reader\n- [ ] Google Chrome\n- [ ] Any client-specific applications\n\n### Security\n- [ ] Verify antivirus is active and updated\n- [ ] Confirm BitLocker is enabled\n- [ ] Test Windows Update\n- [ ] Apply GPO settings\n\n### Handover\n- [ ] Create user account\n- [ ] Document in asset management\n- [ ] Send credentials to user securely", category: "Hardware", tags: ["soe", "setup", "new-pc", "checklist"], isPublic: false, authorId: admin.id } }),
    prisma.knowledgeArticle.create({ data: { title: "Veeam Backup - Common Error Codes", content: "## Veeam Backup Error Reference\n\n### Error 32768 - Processing timeout\n- Usually indicates the backup target is unreachable or slow\n- Check network connectivity to backup repository\n- Verify sufficient disk space on target\n- Check if another backup job is running\n\n### Error 4096 - VSS failure\n- Check VSS writers status: vssadmin list writers\n- Restart VSS service\n- Check application event log for VSS errors\n- May need to restart specific application services\n\n### General Troubleshooting\n1. Check Veeam logs in C:\\ProgramData\\Veeam\\Backup\n2. Verify backup proxy connectivity\n3. Check snapshot space on datastore\n4. Review job settings for any recent changes", category: "Backup", tags: ["veeam", "backup", "errors", "troubleshooting"], isPublic: false, authorId: tech1.id } }),
    prisma.knowledgeArticle.create({ data: { title: "Identifying and handling phishing emails", content: "## How to Identify Phishing Emails\n\n### Red Flags\n- Sender address doesn't match the claimed organisation\n- Urgent language demanding immediate action\n- Generic greetings ('Dear Customer' instead of your name)\n- Links that don't match the displayed text (hover to check)\n- Unexpected attachments\n- Poor grammar and spelling\n- Requests for sensitive information\n\n### What to Do\n1. Do NOT click any links or open attachments\n2. Do NOT reply to the email\n3. Forward the email to the IT support team\n4. Report as phishing in Outlook (Report Message button)\n5. Delete the email\n\n### For IT Team\n1. Analyse email headers for true sender\n2. Check URLs in sandbox (urlscan.io)\n3. If user clicked: reset password, scan device, check for compromise\n4. Block sender domain if confirmed malicious\n5. Send awareness reminder to all users", category: "Security", tags: ["phishing", "email", "security", "awareness"], isPublic: true, authorId: admin.id } }),
  ]);

  console.log("Created knowledge articles");

  // Create email sync state
  await prisma.emailSyncState.create({
    data: { mailbox: "support@digitalpanda.co.uk" },
  });

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
