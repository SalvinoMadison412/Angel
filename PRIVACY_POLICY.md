# Angel — Privacy Policy

**Last updated:** August 9, 2026

Angel ("Angel", "we", "us") provides a two-wheeler crash-detection app that pairs with a wearable sensor, detects possible crashes, and alerts your emergency contacts. This policy explains what data Angel collects, why, and how it's handled.

## Data we collect

**Account information.** Your phone number (used to sign in via SMS one-time passcode) or, if you choose Google Sign-In, the name and email address Google provides.

**Profile photo (optional).** If you choose to add one, a profile picture you pick from your photo gallery. Angel never requests camera access for this — only your existing photo library. Stored in our cloud storage provider (Supabase Storage) and displayed back to you in the app; not shared with guardians or any other party.

**Location.** Foreground GPS location is captured at the moment a crash alert is triggered or confirmed, so it can be included in the WhatsApp alert sent to your guardians. We do not track or store your location at any other time.

**Bluetooth / sensor data.** Angel pairs with your Angel crash-sensor device over Bluetooth Low Energy. Impact force, rotation, tilt, and "stillness" readings from the sensor are used to detect and classify possible crashes, and to support cancelling a false alarm. A copy of these raw readings is also kept in a log stored locally on your device (not uploaded anywhere) so crash-detection accuracy can be reviewed and improved over time; this local log is not currently deleted automatically.

**Emergency contacts ("guardians").** Names and phone numbers you add are stored so Angel can message them by WhatsApp if a crash alert isn't cancelled in time. A guardian must separately opt in by sending a WhatsApp message to Angel's number before they can receive alerts — see "Guardian WhatsApp opt-in" below.

**Emergency medical profile (optional).** If you choose to provide it, your blood group and any medical conditions are stored for your own reference in the app. This information is not currently shared with anyone else — including guardians, or a trained responder — as part of any automated alert; it exists to support a future responder-dispatch feature, not the current release.

**Crash and incident records.** When a crash alert is triggered, we record the event — including the raw sensor readings above, not just the computed severity — so it can be tracked and reviewed by you afterward in your incident history. This is retained for as long as your account is active, the same as the rest of your account data (see "Data retention & deletion").

**Device/bike info.** Optional make/model you enter for your paired device, and sensor calibration offsets.

## Guardian WhatsApp opt-in

Because Angel currently sends guardian alerts through Twilio's WhatsApp sandbox, each guardian must tap a link you share with them and send a short join message before Twilio will deliver messages to their number. Angel shows you this link immediately after you add a guardian, and again on the guardian list for anyone who hasn't completed it yet. A guardian who hasn't opted in is skipped automatically at alert time — the alert still goes out to every guardian who has.

## How we use this data

Angel uses the data above solely to:

- Detect a possible crash and let you cancel a false alarm
- Alert your guardians by WhatsApp message when a crash alert is confirmed or a check-in is missed
- Maintain your account, profile, and incident history
- Diagnose and improve crash-detection accuracy

We do not sell your data. We do not use your location, sensor, or medical data for advertising.

## Third parties

- **Supabase** hosts our database, authentication, file storage, and backend functions.
- **Twilio** delivers the WhatsApp alerts to your guardians. Only the guardian's name, their phone number, and the alert message text (which includes a Google Maps link to your last known location) are sent to Twilio — never your medical profile, never another guardian's details, never raw device/account identifiers beyond what's needed to address the message.
- **Google** provides optional Sign-In and, where used, map display.

Each of these processes data only as needed to provide the functionality above, under their own security and privacy commitments.

## Data retention & deletion

Your account data, guardians, medical profile, incident history (including raw sensor readings), and profile photo are retained while your account is active. You can delete your account and associated data at any time by contacting us (see below); emergency medical information and guardian contact details are removed immediately on request. The on-device sensor-event log described above lives only on your phone and is cleared if you uninstall the app.

## Permissions this app requests, and why

| Permission | Why |
|---|---|
| Location (fine/coarse) | Attach your location to a crash alert so guardians know where you are |
| Bluetooth (scan/connect) | Pair with and receive readings from your Angel crash sensor |
| Notifications | Alert *you*, on your own phone, if a crash is detected while the app is backgrounded — separate from, and not required for, the WhatsApp message sent to your guardians |
| Photo library (read-only) | Let you pick an existing photo to use as your profile picture — Angel never requests camera access |

Angel does not request permissions beyond what's listed above, and does not access your contacts or other apps' data.

## Children's privacy

Angel is not directed at children under 13, and we do not knowingly collect data from them.

## Changes to this policy

We'll update the "Last updated" date above when this policy changes. Material changes will be communicated to the email or phone number on your account where possible.

## Contact us

Questions about this policy or a request to access/delete your data: **hello@angel.tech**
