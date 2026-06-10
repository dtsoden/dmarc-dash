# Office 365 / Entra setup for DMARC Dashboard

The app reads one mailbox via Microsoft Graph using app-only (client credentials) auth.

## 1. Register the app
1. Entra admin center → App registrations → New registration.
2. Name: "DMARC Dashboard". Supported account types: single tenant. Register.
3. Copy **Application (client) ID** and **Directory (tenant) ID** → `.env` CLIENT_ID / TENANT_ID.

## 2. Add a client secret
1. Certificates & secrets → New client secret → copy the **Value** → `.env` CLIENT_SECRET.

## 3. Grant application permissions
1. API permissions → Add a permission → Microsoft Graph → **Application permissions**.
2. Add **Mail.ReadWrite** (read + delete/move). Add **User.Read.All** if you later resolve display names (optional).
3. Click **Grant admin consent**.

## 4. Lock access to ONLY the DMARC mailbox (important)
Application permissions grant access to ALL mailboxes by default. Restrict to one:

```powershell
# Requires Exchange Online PowerShell (Connect-ExchangeOnline)
New-DistributionGroup -Name "DMARC-App-Mailboxes" -Type Security -PrimarySmtpAddress dmarc-app-scope@yourdomain.com
Add-DistributionGroupMember -Identity "DMARC-App-Mailboxes" -Member dmarc@yourdomain.com

New-ApplicationAccessPolicy -AppId <CLIENT_ID> `
  -PolicyScopeGroupId dmarc-app-scope@yourdomain.com `
  -AccessRight RestrictAccess `
  -Description "Restrict DMARC Dashboard to the DMARC mailbox only"

# Verify:
Test-ApplicationAccessPolicy -Identity dmarc@yourdomain.com -AppId <CLIENT_ID>   # AccessCheckResult: Granted
Test-ApplicationAccessPolicy -Identity someoneelse@yourdomain.com -AppId <CLIENT_ID>  # Denied
```

## 5. Enter everything in the Setup Wizard (no .env)
Start the app and open it in a browser — first run redirects to the **Setup Wizard**.
Enter: admin account; Graph TENANT_ID/CLIENT_ID/CLIENT_SECRET and the mailbox UPN (use
"Test connection"); poll interval + delete mode; and (optional) the MailerSend token from
`C:/Users/DavidSoden/registry/email_access_token.txt`, a verified MailerSend from-address,
digest recipients (default david.soden@ and duane.walker@beaconspec.com), and the MaxMind
key. All values are stored encrypted in the DB; no env file of secrets is used.

## 6. Smoke test
After finishing the wizard, `npm run poll:once` should print a poll result and create rows
in the DB. (It reads Graph creds from the saved settings.)
