# Project guidance

This is a new, independent personal project. Do not modify sibling Hobby projects, portfolio pages or profile repositories.

- Keep the playable experience static and browser-only, compatible with GitHub Pages at a subdirectory and direct `file://` opening.
- Do not introduce a backend, accounts, hosted services, secret keys, runtime AI, analytics or external asset dependencies.
- Keep the focus on one scene: lift and place the mug, slide the saucer, and gently interact with its resident. The saucer carries the mug only while it is seated. Prioritize timing, tactile art and coherent character geometry.
- Support touch, mouse, keyboard and reduced motion. Keep movement bounded at all supported viewport sizes.
- Inspect actual rendered screenshots and interactions after visual or motion changes. Check deep retreat geometry, responsive portrait and landscape, pointer cancellation and pause behavior.
- Do not create a remote repository, publish, post externally or change a portfolio without explicit authorization. Future repository changes must use pull requests.

The playable experience has no build requirement. Runtime files are `index.html`, `style.css`, `app.js`, `audio.js` and the bundled `assets/purr.js` recording with `assets/PURR-LICENSE.txt`. Static Pages packaging copies only these files and a commit/hash manifest. Tests and review tools are development-only and must not become runtime dependencies.
