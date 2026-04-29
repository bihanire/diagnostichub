# Photo Library Submission Template

Use this pack when sending defect photos for the diagnosis workspace.

## What to submit

1. Put each image in the matching family folder and defect subfolder.
2. Fill in `photo-index-template.csv`.
3. Zip the whole `photo-library-template` folder before sharing it.

Suggested zip name:

```text
watu-simu-photo-library-batch-001.zip
```

## Folder structure

The folders in this template match the six repair families already used by the app:

- `display-vision`
- `power-thermal`
- `logic-software`
- `security-access`
- `connectivity-io`
- `physical-liquid`

Inside each family folder, use the prepared defect subfolders where they fit. If a new defect type does not fit an existing folder, create a clearly named sibling folder and add matching rows in the CSV.

## File naming

Use this format:

```text
family_defect-angle_angle_severity_01.jpg
```

Example:

```text
display_cracked-screen_front_clear_01.jpg
power_blocked-port_closeup_moderate_01.jpg
connectivity_no-network_status-clear_01.jpg
```

## Metadata file

Fill in `photo-index-template.csv` for every image.

Required fields:

- `relative_path`
- `file_name`
- `family`
- `defect_type`
- `title`
- `caption`
- `angle`
- `severity`
- `branch_fixable`
- `dispatch_likely`

Optional fields:

- `annotated`
- `notes`

## Capture standard

Please keep each photo:

- well lit
- in sharp focus
- close enough to show the fault clearly
- free of customer names, phone numbers, IMEI, chats, or personal photos
- on a plain background where possible

Recommended per defect:

- `1` wide shot
- `2-3` close-ups
- `1` comparison or annotated copy if it helps

## First batch priority

If you are sending the first production batch, prioritize:

- cracked screen
- black screen but phone alive
- lines or flicker
- blocked charging port
- cable-angle charging issue
- swollen battery or lifted back cover
- FRP or Google lock
- no SIM or no network indicator
- microphone or speaker blockage
- liquid damage indicator or corrosion
- bent frame
- dead side button

## Working rule

The image itself should help the officer recognize the fault quickly. The CSV should tell us how to place it in the app later.
