Vendor logos for the Connected systems page.

Most marks are built in (apps/platform/lib/logos.ts, from Simple Icons). Some
vendors have asked Simple Icons not to carry their mark, so they are not
built in: OpenAI, Microsoft (Microsoft 365, Azure, Intune), Amazon Web
Services, Slack, Salesforce, BambooHR, Deel, Rippling, Jamf, Kandji and
CrowdStrike.

To show one, download the official logo from the vendor's own brand or press
page, square it, save it here as <key>.svg (or <key>.png), and add the key to
LOCAL_LOGOS in apps/platform/lib/logos.ts. Keys:
openai, microsoft, azure, intune, aws, aws_bedrock, azure_openai, m365_copilot,
chatgpt_workspace, slack, salesforce, bamboohr, deel, rippling, jamf, kandji,
crowdstrike. Until a file exists the page shows the vendor's initials.
