# Add the new VSL to the top of the recruiting page

## What will change

- Add a prominent **Watch the Vantage opportunity first** video section at the top of the public recruiting page, directly below the navigation and before the existing recruiting pitch.
- Embed the supplied YouTube video (`F6PHSd9JtQs`) in a polished widescreen player that stays correctly proportioned on phones and desktops.
- Keep the existing black, ivory, and gold Vantage styling, with a short title and a clear **Apply Now** action beneath the video.
- Update the existing **See the Overview** jump action to lead visitors to this VSL instead of the outdated company-overview section.

## Verification

- Confirm the video loads and plays in the page.
- Check the top section on desktop and mobile for correct sizing, readable text, and no overlap.
- Confirm the application action preserves recruiter referral information.

## Technical details

- Update only the public recruiting page presentation in `src/routes/index.tsx`.
- Use YouTube's privacy-enhanced embed URL and include an accessible player title and fullscreen support.
