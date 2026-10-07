/**
 * The connector catalogue: what each connector reads, how to set it up, and
 * the checks it runs. Description only; the calling code is in providers/.
 *
 * Built from each provider's public API documentation (October 2026). None
 * has yet been run against a live customer account, so every entry starts
 * with verified: false and the page says "new" until it has.
 *
 * Framework references in `controls` follow lib/integrations/catalog: only
 * ids that exist verbatim (ISO/IEC 27001:2022 Annex A, POPIA sections, AIC
 * requirement codes).
 */
import type { ConnectorDef, ConnectorField } from './types';

const secret = (key: string, label: string, help?: string, placeholder?: string): ConnectorField => ({ key, label, kind: 'secret', help, placeholder });
const text = (key: string, label: string, placeholder?: string, help?: string, optional?: boolean): ConnectorField => ({ key, label, kind: 'text', placeholder, help, optional });

// Shared wording for the checks most connectors have.
const MFA_WHY = 'A stolen password should not be enough to get in. A second factor stops most account takeovers.';
const ADMINS_WHY = 'Every administrator can change anything. Too many widens the target; only one means losing that account locks everyone out.';
const ADMINS_FIX = 'Keep two or three administrators. Give everyone else the narrower role they need.';
const STALE_WHY = 'An account nobody uses still opens a door, and nobody notices when it is misused. Most belong to people who have left.';
const STALE_FIX = 'Disable each listed account if the person has left or no longer needs it, and add this system to your leaver checklist.';

const MFA = ['ISO 27001 A.8.5', 'POPIA s19'];
const PRIV = ['ISO 27001 A.8.2', 'ISO 27001 A.5.15'];
const LEAVERS = ['ISO 27001 A.5.18', 'POPIA s19'];
const LOGGING = ['ISO 27001 A.8.15', 'ISO 27001 A.8.16'];
const ENDPOINT = ['ISO 27001 A.8.1', 'POPIA s19'];
const VULNS = ['ISO 27001 A.8.8', 'POPIA s19'];
const CHANGE = ['ISO 27001 A.8.4', 'ISO 27001 A.8.32'];
const CRYPTO = ['ISO 27001 A.8.24', 'POPIA s19'];

export const CONNECTORS: ConnectorDef[] = [
  // ── AI tools ─────────────────────────────────────────────────────────────
  {
    key: 'claude_enterprise', name: 'Claude Enterprise', category: 'ai', verified: false,
    reads: 'Who in your organisation uses Claude each day, and how much: messages, conversations, projects, connectors, Claude Code and Cowork sessions, with seat totals. Never a prompt, a conversation or a file.',
    plan: 'Claude Enterprise only. Team, Pro and Max plans have no analytics API; use Import an export under AI in use instead.',
    setup: [
      'Only your organisation’s Primary Owner can do this. In claude.ai, open Organization settings, API.',
      'Turn on the Analytics API, then create a key with the read:analytics scope.',
      'Paste the key below. It reads counts only, and is separate from any Console Admin key.',
    ],
    fields: [secret('analyticsKey', 'Analytics API key')],
    checks: [],
    ai: { products: ['claude_seats'] },
    docs: 'https://platform.claude.com/docs/en/manage-claude/analytics-api',
  },

  // ── Cloud ────────────────────────────────────────────────────────────────
  {
    key: 'aws', name: 'Amazon Web Services', category: 'cloud', verified: false, accounts: true,
    reads: 'IAM users and their second factors, unused credentials, S3 public access settings, and CloudTrail logging.',
    setup: [
      'In the AWS console, open IAM, Users, and create a user called aic-read-only with no console access.',
      'Attach the AWS managed policy SecurityAudit to it. It can read settings but not your data.',
      'Under Security credentials, create an access key for "Third-party service" and paste both parts below.',
      'Give the region where you run most workloads, so AIC reads the right CloudTrail.',
      'To record Amazon Bedrock use as well, also attach CloudWatchReadOnlyAccess. It reads metrics, not data.',
    ],
    fields: [text('accessKeyId', 'Access key id', 'AKIA…'), secret('secretAccessKey', 'Secret access key'), text('region', 'Main region', 'af-south-1', 'For example af-south-1 (Cape Town) or eu-west-1.')],
    checks: [
      { key: 'aws.iam_users_mfa', title: 'AWS console users and the root account have a second factor', why: 'The root account and any user who can sign in to the console can change your whole AWS estate.', fix: 'In IAM, open each listed user, Security credentials, and assign an MFA device. For the root account, sign in as root and add one under Security credentials.', controls: MFA, common: ['iam.mfa'] },
      { key: 'aws.stale_credentials', title: 'No unused AWS passwords or access keys', why: 'An access key nobody uses is still valid, and keys leak through code and laptops.', fix: 'Deactivate each listed key or password, then delete it after a week if nothing breaks.', controls: LEAVERS, common: ['iam.leavers'] },
      { key: 'aws.s3_public_access_blocked', title: 'S3 blocks public access', why: 'A public bucket is the most common way cloud data leaks.', fix: 'In S3, open Block Public Access settings for this account and turn on all four settings.', controls: ['ISO 27001 A.8.3', 'POPIA s19'], common: ['ops.encryption'] },
      { key: 'aws.cloudtrail_enabled', title: 'CloudTrail is logging in every region', why: 'Without CloudTrail there is no record of who changed what in AWS, which is the first thing an incident needs.', fix: 'In CloudTrail, create a trail that applies to all regions, with log file validation on.', controls: LOGGING, common: ['ops.logging_monitoring'] },
    ],
    ai: { products: ['aws_bedrock'], needs: 'CloudWatchReadOnlyAccess on the same user (cloudwatch:ListMetrics and cloudwatch:GetMetricData).' },
    docs: 'https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SecurityAudit.html',
  },
  {
    key: 'gcp', name: 'Google Cloud', category: 'cloud', verified: false,
    reads: 'Who holds Owner and Editor on your project, whether storage buckets prevent public access, and audit log settings.',
    setup: [
      'In Google Cloud, open IAM and admin, Service accounts, and create one called aic-read-only.',
      'Grant it Viewer and Security Reviewer on the project.',
      'Open the service account, Keys, Add key, JSON. Paste the whole file below.',
    ],
    fields: [{ key: 'serviceAccount', label: 'Service account key (JSON)', kind: 'textarea', placeholder: '{ "type": "service_account", … }' }, text('projectId', 'Project id', 'my-project-123', 'Leave blank to use the project the key belongs to.', true)],
    checks: [
      { key: 'gcp.owners_limited', title: 'Few people hold Owner on the project, and none from outside', why: 'Owner can do anything, including deleting the project. Accounts from other domains are hard to keep track of.', fix: 'In IAM, remove Owner from anyone who does not need it, and replace outside accounts with ones from your own domain.', controls: PRIV, common: ['iam.privileged'] },
      { key: 'gcp.gcs_public_access_prevented', title: 'Storage buckets prevent public access', why: 'A bucket readable by allUsers is open to the whole internet.', fix: 'In Cloud Storage, open each listed bucket, Permissions, and set public access prevention to enforced.', controls: ['ISO 27001 A.8.3', 'POPIA s19'], common: ['ops.encryption'] },
      { key: 'gcp.audit_logging', title: 'Data access audit logs are on', why: 'Admin activity is always logged, but who read your data is only logged if you turn it on.', fix: 'In IAM and admin, Audit logs, turn on Data Read and Data Write for all services, or at least for the ones holding personal information.', controls: LOGGING, common: ['ops.logging_monitoring'] },
    ],
    ai: { products: ['vertex_ai'], needs: 'Nothing more: Viewer on the project includes Cloud Monitoring.' },
    docs: 'https://cloud.google.com/iam/docs/understanding-roles',
  },
  {
    key: 'azure', name: 'Microsoft Azure', category: 'cloud', verified: false, uses: 'microsoft',
    reads: 'Who holds Owner on each subscription, storage account public access and TLS settings, activity log export, and high-severity Defender for Cloud recommendations.',
    setup: [
      'Connect Microsoft 365 first. Azure reuses the same AIC app in your tenant.',
      'In the Azure portal, open each subscription, Access control (IAM), Add role assignment.',
      'Assign Reader and Security Reader to the enterprise application called AIC Platform.',
      'List the subscription ids below, or leave it blank and AIC reads every subscription it can see.',
    ],
    fields: [{ key: 'subscriptions', label: 'Subscription ids', kind: 'textarea', placeholder: 'One per line', optional: true }],
    checks: [
      { key: 'azure.owners_limited', title: 'Few people hold Owner on each subscription', why: ADMINS_WHY, fix: 'In the subscription, Access control (IAM), remove Owner from people who need less, and use Contributor or narrower roles.', controls: PRIV, common: ['iam.privileged'] },
      { key: 'azure.storage_no_public_access', title: 'Storage accounts block public blobs and require TLS 1.2', why: 'A storage account that allows public blobs or old TLS can leak data or let it be read in transit.', fix: 'In each listed storage account, Configuration: set "Allow blob anonymous access" to disabled, "Secure transfer required" to enabled, and minimum TLS to 1.2.', controls: CRYPTO, common: ['ops.encryption'] },
      { key: 'azure.activity_log_exported', title: 'The activity log is kept', why: 'Azure keeps the activity log for 90 days. An incident found later needs more.', fix: 'In Monitor, Activity log, Export activity logs, send Administrative and Security categories to a Log Analytics workspace or storage account.', controls: LOGGING, common: ['ops.logging_monitoring'] },
      { key: 'azure.defender_unhealthy_assessments', title: 'No high-severity Defender for Cloud recommendations open', why: 'Defender for Cloud already lists the riskiest settings in your subscription; high ones are worth fixing first.', fix: 'In Defender for Cloud, Recommendations, filter by High severity and work through the list.', controls: VULNS, common: ['dev.vulnerabilities'] },
    ],
    ai: { products: ['azure_openai'], needs: 'Nothing more: Reader on the subscription covers AI accounts, deployments and their metrics.' },
    docs: 'https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles',
  },

  // ── Identity ─────────────────────────────────────────────────────────────
  {
    key: 'google_workspace', name: 'Google Workspace', category: 'identity', verified: false, accounts: true,
    reads: 'Each user’s 2-Step Verification, who is a super admin, and accounts not signed in to for 90 days.',
    setup: [
      'In Google Cloud, create a service account and a JSON key for it (no project roles needed).',
      'In the Workspace Admin console, Security, Access and data control, API controls, Domain-wide delegation: add the service account’s client id with the scope https://www.googleapis.com/auth/admin.directory.user.readonly',
      'To record Gemini use as well, add a second scope to the same entry: https://www.googleapis.com/auth/admin.reports.audit.readonly',
      'Paste the key below, with the email of a super admin for AIC to read as. It only reads.',
    ],
    fields: [{ key: 'serviceAccount', label: 'Service account key (JSON)', kind: 'textarea', placeholder: '{ "type": "service_account", … }' }, text('adminEmail', 'Super admin email to read as', 'it@yourcompany.co.za')],
    checks: [
      { key: 'google_workspace.mfa_enforced', title: 'Everyone has 2-Step Verification', why: MFA_WHY, fix: 'In the Admin console, Security, 2-Step Verification, enforce it for the organisation, and ask the listed people to enrol.', controls: MFA, common: ['iam.mfa'] },
      { key: 'google_workspace.admins_limited', title: 'Super admins are few, but more than one', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
      { key: 'google_workspace.stale_accounts', title: 'Unused Google accounts are suspended', why: STALE_WHY, fix: STALE_FIX, controls: LEAVERS, common: ['iam.leavers'] },
    ],
    ai: { products: ['gemini_workspace'], needs: 'The scope https://www.googleapis.com/auth/admin.reports.audit.readonly added to the same domain-wide delegation.' },
    docs: 'https://developers.google.com/workspace/admin/directory/reference/rest/v1/users/list',
  },
  {
    key: 'okta', name: 'Okta', category: 'identity', verified: false, accounts: true,
    reads: 'Sign-on policies that allow one factor, users without a second factor, super administrators, and unused accounts.',
    setup: [
      'In the Okta admin console, Security, Administrators, create a user for AIC with the Read-only Administrator role.',
      'Signed in as that user, open Security, API, Tokens, and create a token called AIC.',
      'Paste your Okta domain and the token below.',
    ],
    fields: [text('domain', 'Okta domain', 'yourcompany.okta.com'), secret('token', 'API token')],
    checks: [
      { key: 'okta.mfa_enforced', title: 'Sign-on policies require a second factor', why: MFA_WHY, fix: 'In Security, Authentication policies, change each listed rule to require two factors.', controls: MFA, common: ['iam.mfa'] },
      { key: 'okta.users_mfa_enrolled', title: 'Every active user has a second factor', why: 'A policy requiring two factors does not protect someone who has none enrolled yet.', fix: 'Ask each listed person to enrol Okta Verify, starting with administrators.', controls: MFA, common: ['iam.mfa'] },
      { key: 'okta.admins_limited', title: 'Super administrators are few, but more than one', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
      { key: 'okta.stale_accounts', title: 'Unused Okta accounts are deactivated', why: STALE_WHY, fix: STALE_FIX, controls: LEAVERS, common: ['iam.leavers'] },
    ],
    docs: 'https://developer.okta.com/docs/api/openapi/okta-management/management/tag/User/',
  },
  {
    key: 'onepassword', name: '1Password Business', category: 'password', verified: false,
    reads: 'Whether sign-in attempts are being reported, and who keeps failing their second factor.',
    plan: '1Password Business or Enterprise. Teams has no Events API.',
    setup: [
      'In 1Password, open Integrations, Directory, Other, and add an Events Reporting integration called AIC.',
      'Give it access to sign-in attempts and audit events, then copy the bearer token.',
      'Choose the region your 1Password account is in.',
    ],
    fields: [secret('token', 'Events API token'), { key: 'region', label: 'Account region', kind: 'select', options: [{ value: 'com', label: '1password.com' }, { value: 'eu', label: '1password.eu' }, { value: 'ca', label: '1password.ca' }, { value: 'ent', label: 'ent.1password.com' }] }],
    checks: [
      { key: 'onepassword.signin_monitoring', title: 'Password manager sign-ins are monitored', why: 'Repeated failed second factors are an early sign someone has a stolen password.', fix: 'Talk to anyone listed with repeated failures; if they did not cause them, have them change their account password and check their devices.', controls: LOGGING, common: ['ops.logging_monitoring', 'iam.mfa'] },
    ],
    docs: 'https://developer.1password.com/docs/events-api/reference/',
  },

  // ── Code ─────────────────────────────────────────────────────────────────
  {
    key: 'gitlab', name: 'GitLab', category: 'code', verified: false, accounts: true,
    reads: 'Default branch protection on each project, whether your group requires two-factor sign-in, and who holds Owner.',
    plan: 'Group access tokens need GitLab Premium or Ultimate. On Free, use a personal access token from a dedicated bot user.',
    setup: [
      'In your top-level group, open Settings, Access tokens, and create a token with the Owner role and the read_api scope. Owner is needed to see the two-factor setting; the token can still only read.',
      'Paste the group path and the token below. For self-managed GitLab, also give your GitLab address.',
    ],
    fields: [text('group', 'Group path', 'your-company'), secret('token', 'Access token'), { key: 'baseUrl', label: 'GitLab address', kind: 'url', placeholder: 'https://gitlab.com', optional: true }],
    checks: [
      { key: 'gitlab.branch_protection', title: 'Default branches are protected', why: 'Without protection anyone with developer access can push straight to the branch your systems are built from.', fix: 'In each listed project, Settings, Repository, Protected branches: protect the default branch, allow no one to force push, and allow only Maintainers to push.', controls: CHANGE, common: ['dev.change_review'] },
      { key: 'gitlab.mfa_required', title: 'The group requires two-factor sign-in', why: 'A stolen password should not be enough to change your code.', fix: 'In the group, Settings, General, Permissions: turn on "Require all users in this group to set up two-factor authentication".', controls: MFA, common: ['iam.mfa'] },
      { key: 'gitlab.admins_limited', title: 'Group owners are few, but more than one', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
    ],
    docs: 'https://docs.gitlab.com/api/protected_branches/',
  },
  {
    key: 'bitbucket', name: 'Bitbucket Cloud', category: 'code', verified: false, accounts: true,
    reads: 'Branch restrictions on each repository’s main branch, and who owns the workspace.',
    setup: [
      'In Atlassian account settings, Security, create an API token with scopes, choose Bitbucket, and give it read:workspace, read:repository, read:user and admin:repository. Bitbucket only shows branch restrictions to admin:repository; AIC still only reads.',
      'Paste your workspace id, your Atlassian email and the token below.',
    ],
    fields: [text('workspace', 'Workspace id', 'your-company'), text('email', 'Atlassian account email'), secret('token', 'API token')],
    checks: [
      { key: 'bitbucket.branch_protection', title: 'Main branches require approval and block force pushes', why: 'A required approval is the point where a named person accepts a change before it reaches production.', fix: 'In each listed repository, Repository settings, Branch restrictions: add a rule for the main branch that prevents rewriting history and requires at least one approval.', controls: CHANGE, common: ['dev.change_review'] },
      { key: 'bitbucket.admins_limited', title: 'Workspace owners are few, but more than one', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
    ],
    docs: 'https://developer.atlassian.com/cloud/bitbucket/rest/api-group-branch-restrictions/',
  },
  {
    key: 'snyk', name: 'Snyk', category: 'security', verified: false,
    reads: 'Open critical vulnerabilities and which projects Snyk is monitoring.',
    plan: 'Snyk Team, Ignite or Enterprise. The free plan has no API.',
    setup: [
      'In Snyk, open your organisation, Settings, Service accounts, and create one with the Org Viewer role.',
      'Copy its token and your organisation id (Settings, General) and paste them below.',
    ],
    fields: [text('orgId', 'Organisation id'), secret('token', 'Service account token'), { key: 'region', label: 'Region', kind: 'select', options: [{ value: 'us', label: 'United States (snyk.io)' }, { value: 'eu', label: 'Europe' }, { value: 'au', label: 'Australia' }] }],
    checks: [
      { key: 'snyk.no_open_critical', title: 'No open critical vulnerabilities in your code', why: 'Snyk already knows which of your dependencies have critical holes. Each open one is a known way in.', fix: 'In Snyk, filter issues by critical severity and upgrade or replace each listed package. Ignore an issue only with a written reason.', controls: VULNS, common: ['dev.vulnerabilities'] },
      { key: 'snyk.projects_monitored', title: 'Snyk is monitoring your projects', why: 'A project Snyk is not monitoring gets no alerts when a new hole is found.', fix: 'In Snyk, Projects, add the missing repositories, or re-import those that stopped.', controls: VULNS, common: ['dev.vulnerabilities'] },
    ],
    docs: 'https://docs.snyk.io/snyk-api/reference/issues',
  },

  // ── Work tracking ────────────────────────────────────────────────────────
  {
    key: 'jira', name: 'Jira', category: 'ticketing', verified: false, accounts: true,
    reads: 'Open security tickets past their deadline, and active Jira users.',
    setup: [
      'Create an Atlassian account for AIC (for example aic@yourcompany.co.za) with Browse projects permission only.',
      'Signed in as that account, create an API token at id.atlassian.com, Security, API tokens.',
      'Paste your site address, the account email and the token. AIC treats tickets labelled "security" as security work.',
    ],
    fields: [text('site', 'Jira site', 'yourcompany.atlassian.net'), text('email', 'Account email'), secret('token', 'API token'), text('label', 'Security label', 'security', 'The label your team puts on security work.', true), text('slaDays', 'Days to fix a high-priority security ticket', '30', undefined, true)],
    checks: [
      { key: 'jira.security_tickets_sla', title: 'High-priority security tickets are fixed on time', why: 'Security tickets that sit open are known problems nobody is fixing.', fix: 'Give each listed ticket an owner and a date, or lower its priority with a written reason.', controls: ['ISO 27001 A.5.24', 'ISO 27001 A.8.8'], common: ['ops.incident_response', 'dev.vulnerabilities'] },
    ],
    docs: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/',
  },
  {
    key: 'linear', name: 'Linear', category: 'ticketing', verified: false, accounts: true,
    reads: 'Admins, whether SAML single sign-on is on, and open urgent or high security issues past their deadline.',
    plan: 'SAML single sign-on needs Linear Enterprise; the other checks work on every plan.',
    setup: [
      'In Linear, Settings, Account, Security and access, create a personal API key with read access only.',
      'Paste it below. AIC treats issues labelled "security" as security work.',
    ],
    fields: [secret('token', 'API key'), text('label', 'Security label', 'security', undefined, true), text('slaDays', 'Days to fix an urgent or high security issue', '30', undefined, true)],
    checks: [
      { key: 'linear.admins_limited', title: 'Linear admins are few, but more than one', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
      { key: 'linear.sso_enforced', title: 'Single sign-on is on', why: 'With single sign-on, removing someone from your identity provider removes them from Linear too.', fix: 'In Linear, Settings, Security, turn on SAML with your identity provider.', controls: MFA, common: ['iam.mfa'] },
      { key: 'linear.security_issue_sla', title: 'Urgent and high security issues are fixed on time', why: 'Security issues that sit open are known problems nobody is fixing.', fix: 'Give each listed issue an owner and a due date, or lower its priority with a written reason.', controls: ['ISO 27001 A.5.24', 'ISO 27001 A.8.8'], common: ['ops.incident_response', 'dev.vulnerabilities'] },
    ],
    docs: 'https://linear.app/developers/graphql',
  },
  {
    key: 'zendesk', name: 'Zendesk', category: 'ticketing', verified: false, accounts: true,
    reads: 'Agents and admins without two-factor sign-in, how many admins there are, and agents who have not signed in for 90 days.',
    setup: [
      'In Admin Center, Apps and integrations, Zendesk API, turn on token access and add a token called AIC.',
      'Paste your subdomain, the email of the admin the token belongs to, and the token.',
    ],
    fields: [text('subdomain', 'Zendesk subdomain', 'yourcompany', 'The part before .zendesk.com'), text('email', 'Admin email'), secret('token', 'API token')],
    checks: [
      { key: 'zendesk.agents_mfa', title: 'Agents and admins have two-factor sign-in', why: 'Agents can read every customer conversation. A stolen password should not be enough.', fix: 'In Admin Center, Account, Security, Team member authentication: require two-factor authentication.', controls: MFA, common: ['iam.mfa'] },
      { key: 'zendesk.admins_limited', title: 'Zendesk admins are few, but more than one', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
      { key: 'zendesk.stale_agents', title: 'Agents who stopped signing in are removed', why: STALE_WHY, fix: STALE_FIX, controls: LEAVERS, common: ['iam.leavers'] },
    ],
    docs: 'https://developer.zendesk.com/api-reference/ticketing/users/users/',
  },
  {
    key: 'slack', name: 'Slack', category: 'comms', verified: false, accounts: true,
    reads: 'Members without two-factor sign-in, and how many admins and owners there are.',
    setup: [
      'At api.slack.com/apps, create an app for your workspace. Under OAuth and Permissions, add the user token scopes users:read, users:read.email and team:read.',
      'Install it as a workspace owner or admin (Slack only shows two-factor status to admins), and copy the user OAuth token, which starts xoxp-.',
    ],
    fields: [secret('token', 'User OAuth token', undefined, 'xoxp-…')],
    checks: [
      { key: 'slack.mfa_enabled', title: 'Members have two-factor sign-in', why: MFA_WHY, fix: 'In Slack, Workspace settings, Authentication: require two-factor authentication for everyone, or sign in through your identity provider.', controls: MFA, common: ['iam.mfa'] },
      { key: 'slack.admins_limited', title: 'Slack admins and owners are few', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
    ],
    docs: 'https://api.slack.com/methods/users.list',
  },

  // ── HR ───────────────────────────────────────────────────────────────────
  {
    key: 'bamboohr', name: 'BambooHR', category: 'hr', verified: false, people: true,
    reads: 'Your employee list with start and leaving dates. It fills the People page, so leavers are checked against every other system.',
    setup: [
      'Create a BambooHR user for AIC with a custom access level that can view name, work email, job title, department, hire date, termination date and status.',
      'Signed in as that user, click your name, API keys, and add a key called AIC.',
      'Paste your company domain (the part before .bamboohr.com) and the key.',
    ],
    fields: [text('subdomain', 'Company domain', 'yourcompany'), secret('token', 'API key')],
    checks: [{ key: 'bamboohr.people_list', title: 'Employee list is current', why: 'Leavers can only be caught if AIC knows who has left.', fix: 'Make sure leaving dates are entered in BambooHR on the day someone resigns.', controls: LEAVERS, common: ['iam.leavers'] }],
    docs: 'https://documentation.bamboohr.com/reference/request-custom-report-1',
  },
  {
    key: 'hibob', name: 'HiBob', category: 'hr', verified: false, people: true,
    reads: 'Your employee list, including people who have left, with start and leaving dates.',
    setup: [
      'In Bob, Settings, Integrations, Automation, Service users: create one called AIC.',
      'Add it to a permission group with View on Basic info, Work and Lifecycle, for all employees.',
      'Paste the service user id and token below.',
    ],
    fields: [text('userId', 'Service user id'), secret('token', 'Service user token')],
    checks: [{ key: 'hibob.people_list', title: 'Employee list is current', why: 'Leavers can only be caught if AIC knows who has left.', fix: 'Make sure leaving dates are entered in Bob on the day someone resigns.', controls: LEAVERS, common: ['iam.leavers'] }],
    docs: 'https://apidocs.hibob.com/reference/post_people-search',
  },
  {
    key: 'personio', name: 'Personio', category: 'hr', verified: false, people: true,
    reads: 'Your employee list with hire and termination dates.',
    setup: [
      'In Personio, Settings, Integrations, API credentials, create credentials called AIC with read access to persons and employments.',
      'Paste the client id and secret below.',
    ],
    fields: [text('clientId', 'Client id'), secret('clientSecret', 'Client secret')],
    checks: [{ key: 'personio.people_list', title: 'Employee list is current', why: 'Leavers can only be caught if AIC knows who has left.', fix: 'Make sure termination dates are entered in Personio on the day someone resigns.', controls: LEAVERS, common: ['iam.leavers'] }],
    docs: 'https://developer.personio.de/reference',
  },
  {
    key: 'deel', name: 'Deel', category: 'hr', verified: false, people: true,
    reads: 'Employees and contractors on Deel, with start and termination dates.',
    setup: ['In Deel, Apps and integrations, Developer Center, create an organisation token with the people:read scope only.', 'Paste it below.'],
    fields: [secret('token', 'Organisation token')],
    checks: [{ key: 'deel.people_list', title: 'Worker list is current', why: 'Contractors leave too. Leavers can only be caught if AIC knows who has left.', fix: 'End contracts in Deel on the day they end.', controls: LEAVERS, common: ['iam.leavers'] }],
    docs: 'https://developer.deel.com/api/endpoints/people/get-list-of-people',
  },
  {
    key: 'rippling', name: 'Rippling', category: 'hr', verified: false, people: true,
    reads: 'Your worker list with start and end dates.',
    plan: 'API tokens depend on your Rippling plan.',
    setup: ['In Rippling, Settings, Company settings, API tokens, create a read-only token with access to workers.', 'Paste it below.'],
    fields: [secret('token', 'API token')],
    checks: [{ key: 'rippling.people_list', title: 'Worker list is current', why: 'Leavers can only be caught if AIC knows who has left.', fix: 'Make sure end dates are entered in Rippling on the day someone resigns.', controls: LEAVERS, common: ['iam.leavers'] }],
    docs: 'https://developer.rippling.com/documentation/rest-api',
  },

  // ── Devices ──────────────────────────────────────────────────────────────
  {
    key: 'intune', name: 'Microsoft Intune', category: 'endpoint', verified: false, uses: 'microsoft',
    reads: 'Each managed laptop and phone: encryption, compliance with your policies, and when it last checked in.',
    plan: 'Needs an Intune licence (Microsoft 365 Business Premium, E3 or E5, or Intune on its own).',
    setup: [
      'Connect Microsoft 365 first. Intune reuses the same AIC app.',
      'A global administrator approves the extra read permission (DeviceManagementManagedDevices.Read.All) when you connect here. AIC sends you to Microsoft to do it.',
    ],
    fields: [],
    checks: [
      { key: 'intune.device_encryption', title: 'Laptops are encrypted', why: 'A lost laptop without encryption is a data breach you have to report.', fix: 'In Intune, Endpoint security, Disk encryption: require BitLocker on Windows and FileVault on macOS.', controls: ENDPOINT, common: ['ops.endpoint', 'ops.encryption'] },
      { key: 'intune.device_compliant', title: 'Devices meet your compliance policy', why: 'A non-compliant device is missing something your own policy says it needs.', fix: 'In Intune, Devices, Monitor, open each listed device and fix what its compliance report shows.', controls: ENDPOINT, common: ['ops.endpoint'] },
      { key: 'intune.device_checkin', title: 'Devices have checked in within 14 days', why: 'A device that stops checking in gets no updates or policies, and may be lost.', fix: 'Find each listed device. Retire it in Intune if it is gone.', controls: ENDPOINT, common: ['ops.endpoint', 'ops.asset_inventory'] },
    ],
    docs: 'https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list',
  },
  {
    key: 'jamf', name: 'Jamf Pro', category: 'endpoint', verified: false,
    reads: 'Each Mac: FileVault, macOS version, and when it last checked in.',
    plan: 'Jamf Pro 10.49 or later. Jamf Now has a different API.',
    setup: [
      'In Jamf Pro, Settings, API roles and clients: create a role with Read Computers and Read Computer Inventory Collection.',
      'Create an API client with that role, enable it, and generate a client secret.',
      'Paste your Jamf address, the client id and the secret.',
    ],
    fields: [{ key: 'baseUrl', label: 'Jamf Pro address', kind: 'url', placeholder: 'https://yourcompany.jamfcloud.com' }, text('clientId', 'Client id'), secret('clientSecret', 'Client secret'), text('minMacos', 'Oldest macOS version allowed', '14', undefined, true)],
    checks: [
      { key: 'jamf.filevault_enabled', title: 'Macs have FileVault on', why: 'A lost Mac without FileVault is a data breach you have to report.', fix: 'Create a configuration profile that enforces FileVault, and scope it to all computers.', controls: ENDPOINT, common: ['ops.endpoint', 'ops.encryption'] },
      { key: 'jamf.os_up_to_date', title: 'Macs run a supported macOS', why: 'Old versions stop getting security fixes.', fix: 'Use a managed software update plan to bring the listed Macs up to date.', controls: VULNS, common: ['ops.endpoint'] },
      { key: 'jamf.device_checkin', title: 'Macs have checked in within 14 days', why: 'A Mac that stops checking in gets no updates or policies, and may be lost.', fix: 'Find each listed Mac. Remove it from inventory if it is gone.', controls: ENDPOINT, common: ['ops.endpoint', 'ops.asset_inventory'] },
    ],
    docs: 'https://developer.jamf.com/jamf-pro/reference/get_v1-computers-inventory',
  },
  {
    key: 'kandji', name: 'Kandji', category: 'endpoint', verified: false,
    reads: 'Each Mac: FileVault, OS version, and when it last checked in.',
    setup: [
      'In Kandji, Settings, Access, API token: create a token with only Device list and Device details permissions.',
      'Paste your subdomain, region and the token.',
    ],
    fields: [text('subdomain', 'Kandji subdomain', 'yourcompany'), { key: 'region', label: 'Region', kind: 'select', options: [{ value: 'us', label: 'United States' }, { value: 'eu', label: 'Europe' }] }, secret('token', 'API token'), text('minMacos', 'Oldest macOS version allowed', '14', undefined, true)],
    checks: [
      { key: 'kandji.filevault_enabled', title: 'Macs have FileVault on', why: 'A lost Mac without FileVault is a data breach you have to report.', fix: 'Add the FileVault library item to every blueprint.', controls: ENDPOINT, common: ['ops.endpoint', 'ops.encryption'] },
      { key: 'kandji.os_up_to_date', title: 'Macs run a supported macOS', why: 'Old versions stop getting security fixes.', fix: 'Turn on managed OS updates for the listed devices’ blueprints.', controls: VULNS, common: ['ops.endpoint'] },
      { key: 'kandji.device_checkin', title: 'Macs have checked in within 14 days', why: 'A Mac that stops checking in gets no updates or policies, and may be lost.', fix: 'Find each listed Mac. Remove it if it is gone.', controls: ENDPOINT, common: ['ops.endpoint', 'ops.asset_inventory'] },
    ],
    docs: 'https://api-docs.kandji.io/',
  },
  {
    key: 'crowdstrike', name: 'CrowdStrike Falcon', category: 'security', verified: false,
    reads: 'Whether the Falcon sensor is active on every machine, and open critical vulnerabilities from Spotlight.',
    plan: 'Vulnerabilities need the Spotlight (Exposure Management) module; sensor coverage works with any Falcon plan.',
    setup: [
      'In the Falcon console, Support and resources, API clients and keys: add a client with Hosts read and Vulnerabilities read.',
      'Paste the client id, secret and your cloud below.',
    ],
    fields: [text('clientId', 'Client id'), secret('clientSecret', 'Client secret'), { key: 'cloud', label: 'Cloud', kind: 'select', options: [{ value: 'us-1', label: 'US-1' }, { value: 'us-2', label: 'US-2' }, { value: 'eu-1', label: 'EU-1' }] }],
    checks: [
      { key: 'crowdstrike.edr_coverage', title: 'The Falcon sensor is active everywhere', why: 'A machine whose sensor is quiet is not being watched.', fix: 'Find each listed machine. Reinstall the sensor, or remove the host if the machine is gone.', controls: ENDPOINT, common: ['ops.endpoint'] },
      { key: 'crowdstrike.no_open_critical_vulns', title: 'No open critical vulnerabilities on machines', why: 'Each open critical vulnerability is a known way in.', fix: 'In Spotlight, filter by critical and apply the listed updates.', controls: VULNS, common: ['dev.vulnerabilities', 'ops.endpoint'] },
    ],
    docs: 'https://developer.crowdstrike.com/',
  },

  // ── Security and monitoring ──────────────────────────────────────────────
  {
    key: 'cloudflare', name: 'Cloudflare', category: 'security', verified: false, accounts: true,
    reads: 'HTTPS and TLS settings on each website, and whether account members use two-factor sign-in.',
    setup: [
      'In Cloudflare, My profile, API tokens, create a custom token with Account Settings Read, Zone Read and Zone Settings Read, for your account and all zones.',
      'Paste the token and your account id (on the right of the account overview page).',
    ],
    fields: [text('accountId', 'Account id'), secret('token', 'API token')],
    checks: [
      { key: 'cloudflare.tls_enforced', title: 'Websites use HTTPS with TLS 1.2 or later', why: 'Older TLS and plain HTTP let people read or change what passes between your site and its visitors.', fix: 'For each listed site, SSL/TLS: set mode to Full (strict), Edge certificates: turn on Always Use HTTPS and set minimum TLS to 1.2.', controls: CRYPTO, common: ['ops.encryption'] },
      { key: 'cloudflare.members_mfa', title: 'Account members use two-factor sign-in, and admins are few', why: 'Whoever controls Cloudflare controls where your website and email point.', fix: 'Ask each listed member to turn on two-factor sign-in, or enforce it under Manage account, Members. Reduce Super Administrators to three or fewer.', controls: MFA, common: ['iam.mfa', 'iam.privileged'] },
    ],
    docs: 'https://developers.cloudflare.com/api/resources/zones/subresources/settings/',
  },
  {
    key: 'datadog', name: 'Datadog', category: 'observability', verified: false, accounts: true,
    reads: 'How many people hold the Admin role, invitations nobody accepted, and whether Audit Trail is collecting.',
    plan: 'Audit Trail is a paid Datadog feature; without it that check shows "could not check".',
    setup: [
      'In Datadog, Organisation settings, Service accounts: create one with the Datadog Read Only Role.',
      'Create an application key for it, and copy an API key from Organisation settings, API keys.',
      'Paste both, and choose your Datadog site.',
    ],
    fields: [{ key: 'site', label: 'Datadog site', kind: 'select', options: [{ value: 'datadoghq.com', label: 'US1 (datadoghq.com)' }, { value: 'us3.datadoghq.com', label: 'US3' }, { value: 'us5.datadoghq.com', label: 'US5' }, { value: 'datadoghq.eu', label: 'EU1' }, { value: 'ap1.datadoghq.com', label: 'AP1' }] }, secret('apiKey', 'API key'), secret('appKey', 'Application key')],
    checks: [
      { key: 'datadog.admins_limited', title: 'Datadog admins are few, but more than one', why: ADMINS_WHY, fix: ADMINS_FIX, controls: PRIV, common: ['iam.privileged'] },
      { key: 'datadog.stale_invites', title: 'No old unanswered invitations', why: 'An invitation nobody accepted can be accepted later by whoever finds the email.', fix: 'In Organisation settings, Users, revoke each listed pending invitation.', controls: LEAVERS, common: ['iam.leavers'] },
      { key: 'datadog.audit_trail_enabled', title: 'Audit Trail is collecting', why: 'Audit Trail records who changed monitors, dashboards and access, which an incident needs.', fix: 'In Organisation settings, Audit Trail settings, turn it on.', controls: LOGGING, common: ['ops.logging_monitoring'] },
    ],
    docs: 'https://docs.datadoghq.com/api/latest/users/',
  },

  // ── Sales ────────────────────────────────────────────────────────────────
  {
    key: 'salesforce', name: 'Salesforce', category: 'crm', verified: false, accounts: true,
    reads: 'Who can modify all data, and users who have not signed in for 90 days.',
    plan: 'API access needs Enterprise, Unlimited, Performance or Developer edition.',
    setup: [
      'In Setup, create an External Client App (or Connected App) with the OAuth scope "api" and the client credentials flow enabled.',
      'Set its run-as user to an integration user with the Salesforce Integration licence and View Setup and Configuration.',
      'Paste your My Domain address, the consumer key and the consumer secret.',
    ],
    fields: [text('domain', 'My Domain', 'yourcompany.my.salesforce.com'), text('clientId', 'Consumer key'), secret('clientSecret', 'Consumer secret')],
    checks: [
      { key: 'salesforce.admins_limited', title: 'Few people can modify all data', why: 'Modify All Data can change or delete every customer record.', fix: 'Remove Modify All Data from profiles and permission sets that do not need it.', controls: PRIV, common: ['iam.privileged'] },
      { key: 'salesforce.stale_accounts', title: 'Unused Salesforce users are deactivated', why: STALE_WHY, fix: STALE_FIX, controls: LEAVERS, common: ['iam.leavers'] },
    ],
    docs: 'https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_user.htm',
  },
];

export const CONNECTOR_BY_KEY: Record<string, ConnectorDef> = Object.fromEntries(CONNECTORS.map((c) => [c.key, c]));

/** Every connector check, flat, for the check catalogue and common controls. */
export const CONNECTOR_CHECKS = CONNECTORS.flatMap((c) => c.checks.map((k) => ({ ...k, connector: c.key })));
