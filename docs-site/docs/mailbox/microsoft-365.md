---
sidebar_position: 2
title: Microsoft 365
---

# Microsoft 365 (Microsoft Graph)

DMARC Dashboard reads a Microsoft 365 mailbox through Microsoft Graph using app-only (client credentials) authentication with the `Mail.ReadWrite` permission. This is the only supported method for Exchange Online, because Microsoft has disabled Basic Auth IMAP entirely (there are no app passwords for Exchange Online IMAP).

This page walks through the full Entra (Azure AD) app registration, then locks the app down to a single mailbox, and finishes with troubleshooting.

:::info You will collect three values plus the mailbox address
**Tenant ID**, **Client ID**, **Client Secret (Value)**, and the **mailbox UPN** (the report mailbox's email address). Enter these in the Setup Wizard or in **Settings -> Mailbox Monitoring**.
:::

## 1. Register the app

1. Open the **Microsoft Entra admin center** (entra.microsoft.com).
2. Go to **App registrations -> New registration**.
3. Name it, e.g. `DMARC Dashboard`.
4. Supported account types: **Accounts in this organizational directory only (single tenant)**.
5. Leave Redirect URI blank. Click **Register**.

On the app's **Overview** page, copy:

- **Application (client) ID** -> this is your **Client ID**.
- **Directory (tenant) ID** -> this is your **Tenant ID**.

## 2. Create a client secret

1. In the app, go to **Certificates & secrets -> Client secrets -> New client secret**.
2. Add a description and an expiry, then click **Add**.
3. Copy the secret's **Value** immediately.

:::warning Copy the Value, not the Secret ID
The secret **Value** is shown only once and is what you paste into DMARC Dashboard. The **Secret ID** next to it is a different field and will not work. If you navigate away without copying the Value, delete the secret and create a new one.
:::

## 3. Grant application permissions

1. Go to **API permissions -> Add a permission -> Microsoft Graph**.
2. Choose **Application permissions** (not Delegated).
3. Add **`Mail.ReadWrite`** (read plus move/delete, which the safe-delete behavior needs).
4. Optionally add **`User.Read.All`** if you later want to resolve sender display names.
5. Click **Grant admin consent for &lt;your tenant&gt;** and confirm.

:::danger Admin consent must turn green
After granting consent, the Status column for `Mail.ReadWrite` must show a green check, "Granted for &lt;tenant&gt;". This is the single most common setup mistake. If it is not green, the app is authenticated but **not authorized**, and Graph returns a misleading "Access is denied" error (see Troubleshooting below).
:::

## 4. Lock access to only the DMARC mailbox

Application permissions grant access to **all** mailboxes in the tenant by default. Restrict the app to just the DMARC mailbox with an **Application Access Policy**. Run this in Exchange Online PowerShell (`Connect-ExchangeOnline`):

```powershell
# 1. Create a mail-enabled security group to scope the policy
New-DistributionGroup -Name "DMARC-App-Mailboxes" -Type Security `
  -PrimarySmtpAddress dmarc-app-scope@yourdomain.com

# 2. Add the DMARC mailbox to that group
Add-DistributionGroupMember -Identity "DMARC-App-Mailboxes" `
  -Member dmarc@yourdomain.com

# 3. Restrict the app to only that group
New-ApplicationAccessPolicy -AppId <CLIENT_ID> `
  -PolicyScopeGroupId dmarc-app-scope@yourdomain.com `
  -AccessRight RestrictAccess `
  -Description "Restrict DMARC Dashboard to the DMARC mailbox only"
```

Verify the policy:

```powershell
# Should return AccessCheckResult: Granted
Test-ApplicationAccessPolicy -Identity dmarc@yourdomain.com -AppId <CLIENT_ID>

# Should return AccessCheckResult: Denied
Test-ApplicationAccessPolicy -Identity someoneelse@yourdomain.com -AppId <CLIENT_ID>
```

## 5. The mailbox UPN

The "mailbox UPN" is simply the email address of the mailbox that receives DMARC reports, for example `dmarc@yourdomain.com`. No Graph Explorer or object ID lookup is needed.

## 6. Enter the values

In the Setup Wizard's mailbox step (or **Settings -> Mailbox Monitoring**), choose **Microsoft 365 (Microsoft Graph)** and enter:

- **Tenant ID**
- **Client ID**
- **Client Secret** (the Value from step 2)
- **Mailbox UPN** (the report mailbox address)

Click **Test connection** before saving.

## Free shared mailbox

You don't need to pay for a dedicated DMARC mailbox on Microsoft 365.

- An Exchange Online **shared mailbox** requires **no license** under 50 GB (no archive or litigation hold).
- It receives external mail and is readable by Graph app-only.
- Your tenant just needs at least one licensed user.
- DMARC reports are tiny, so the 50 GB cap is never a concern.

To create one:

1. Microsoft 365 admin center -> **Teams & groups -> Shared mailboxes -> Add**.
2. Name it, e.g. `dmarc@yourdomain.com`, with no license.
3. Add it to the Application Access Policy group from step 4.
4. Point the domain's DMARC `rua=` at it, and set the app's Mailbox UPN to it.

:::tip Same-domain rua needs no external authorization
If the report mailbox is in the same domain as the `_dmarc` record, no external DMARC authorization record is required.
:::

## Troubleshooting

### "Access is denied. Check credentials and try again."

This message is misleading. It means the token was issued successfully (your Tenant ID, Client ID, and Secret are correct), but the app is **not authorized** to read the mailbox. In order of likelihood:

1. **Admin consent was not granted.** Go back to **API permissions** and confirm `Mail.ReadWrite` shows a green "Granted" status. Click **Grant admin consent** if not.
2. **Consent was granted but has not propagated.** Wait 5 to 15 minutes and test again.
3. **The mailbox UPN is not a real Exchange mailbox.** Confirm the address is an actual licensed user or shared mailbox in Exchange Online, spelled correctly.

Think of it as "credentials are right (you got a token), authorization is wrong (the token can't open that mailbox)."

### Test connection succeeds but no reports appear

Aggregate reports arrive roughly once per day per reporter, so a freshly-pointed mailbox fills over about 24 hours. Confirm the domain's DMARC `rua=` actually points at this mailbox, and that the mailbox is receiving external mail. See [Troubleshooting](../troubleshooting.md).
