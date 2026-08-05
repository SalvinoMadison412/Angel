# Angel — Privacy Policy

**Last updated:** August 6, 2026

Angel ("Angel", "we", "us") provides a two-wheeler crash-detection app that pairs with a wearable sensor, detects possible crashes, and alerts your emergency contacts and/or nearby responders. This policy explains what data Angel collects, why, and how it's handled.

## Data we collect

**Account information.** Your phone number (used to sign in via SMS one-time passcode) or, if you choose Google Sign-In, the name and email address Google provides.

**Location.** Foreground GPS location is captured at the moment a crash alert is triggered or confirmed, so it can be included in the alert sent to your guardians and/or a dispatched responder. We do not track or store your location at any other time.

**Bluetooth / sensor data.** Angel pairs with your Angel crash-sensor device over Bluetooth Low Energy. Impact force, rotation, tilt, and "stillness" readings from the sensor are used to detect and classify possible crashes, and to support cancelling a false alarm.

**Emergency contacts ("guardians").** Names and phone numbers you add are stored so Angel can text them if a crash alert isn't cancelled in time.

**Emergency medical profile (optional).** If you choose to provide it, your blood group and any medical conditions are stored so this information can be shared with a dispatched responder at the moment of a confirmed crash alert — never before, and never for any other purpose.

**Crash and incident records.** When a crash alert is triggered, we record the event (severity, sensor readings, location, timestamp) so it can be dispatched, tracked, and reviewed by you afterward in your incident history.

**Device/bike info.** Optional make/model you enter for your paired device, and sensor calibration offsets.

## How we use this data

Angel uses the data above solely to:

- Detect a possible crash and let you cancel a false alarm
- Alert your guardians by SMS when a crash alert is confirmed or a check-in is missed
- Dispatch a nearby trained responder for moderate-to-severe crashes, and give them your location and (if you've provided it) relevant medical information
- Maintain your account and incident history
- Diagnose and improve crash-detection accuracy

We do not sell your data. We do not use your location, sensor, or medical data for advertising.

## Third parties

- **Supabase** hosts our database, authentication, and backend functions.
- **Twilio** sends the SMS alerts to your guardians.
- **Google** provides optional Sign-In and, where used, map display.

Each of these processes data only as needed to provide the functionality above, under their own security and privacy commitments.

## Data retention & deletion

Your account data, guardians, medical profile, and incident history are retained while your account is active. You can delete your account and associated data at any time by contacting us (see below); emergency medical information and guardian contact details are removed immediately on request.

## Permissions this app requests, and why

| Permission | Why |
|---|---|
| Location (fine/coarse) | Attach your location to a crash alert so guardians/responders know where you are |
| Bluetooth (scan/connect) | Pair with and receive readings from your Angel crash sensor |
| Notifications | Alert you in the background if a crash is detected or a ticket status changes |

Angel does not request permissions beyond what's listed above, and does not access your contacts, photos, or other apps' data.

## Children's privacy

Angel is not directed at children under 13, and we do not knowingly collect data from them.

## Changes to this policy

We'll update the "Last updated" date above when this policy changes. Material changes will be communicated to the email or phone number on your account where possible.

## Contact us

Questions about this policy or a request to access/delete your data: **hello@angel.tech**
