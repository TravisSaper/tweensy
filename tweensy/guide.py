"""The examples, styles and quick changes shown in Tweensy's guide panel.

Each item has a kind:
  prompt  a full request (card, "Use this prompt" replaces the chat box)
  style   a look to stack under a prompt (card, "Add under my prompt")
  tweak   a one-line change (chip)
  move    a named motion move (chip, finish the sentence)
Items with an "id" are referenced by the UI (starters, the Set up my computer button).

Text in [brackets] is meant to be swapped for your own. Render quality and frame rate come
from the Export picker in the app, so prompts only name the output file.
"""

SAME = " Change nothing else, then render again."

SECTIONS = [
    {
        "id": "start",
        "num": "1",
        "title": "How it works",
        "body": (
            "Describe the video you want. Claude builds it as a small web page and HyperFrames "
            "turns that page into a video file. Start from a prompt below, swap the parts in "
            "[brackets] for your own, press Send, then ask for changes in plain words. Pick the "
            "shape (16:9, 9:16 or square), 1080p or 4K, and 24 or 60 fps with the badge next to "
            "Send or in the Export menu."
        ),
        "items": [],
    },
    {
        "id": "setup",
        "num": "2",
        "title": "Set up (once per computer)",
        "body": "Installs what HyperFrames needs and checks it works. The Setup button at the top runs this for you.",
        "items": [
            {
                "kind": "prompt",
                "id": "setup",
                "label": "Set up this computer",
                "text": """Get this computer ready to make videos with HyperFrames.

First tell me which system I'm on (Mac, Windows or Linux). Then check each of these and install only what's missing:
- Node.js 22 or newer (Mac: Homebrew. Windows: winget. Linux: give me the command for my package manager.)
- FFmpeg (the same way)
- whisper-cpp, which turns speech into timed words (Mac: Homebrew. Windows: the latest release from github.com/ggml-org/whisper.cpp, added to PATH. Linux: build it from source into ~/.local.)
- The HyperFrames skills for Claude Code: npx hyperframes skills

Then run npx hyperframes doctor and read the result. Skip anything it marks as optional.

If a step needs my password or admin rights, stop and give me the exact command to run myself.

Finish with three short lists: already installed, installed now, and anything still for me to do.""",
            }
        ],
    },
    {
        "id": "first",
        "num": "3",
        "title": "Your first video",
        "body": "A 6-second card that counts up. About two minutes. Use a fresh project.",
        "items": [
            {
                "kind": "prompt",
                "id": "first-video",
                "label": "Your first video",
                "text": """What: a 6-second video made with HyperFrames in this folder.

Look: one frosted-glass card in the centre of a soft violet-to-teal gradient, with two slow-drifting light glows behind it so the glass effect shows. On the card:
- a small uppercase grey label: HELLO WORLD
- a large bold number
- a rounded tag in deep green with white text: [Your name]

Timing:
- 0 to 0.8 s: the card rises into place and fades in.
- 0.8 to 2.6 s: the number counts from 0 to [100], slowing down as it lands.
- 3.5 s: the tag pops in with a small overshoot.
- Then hold until the end.

Font: Inter.

Output: renders/first.mp4. Before you tell me it's done, check a frame from the middle and one from the end.""",
            }
        ],
    },
    {
        "id": "change",
        "num": "4",
        "title": "Change anything",
        "body": "After a render, say what to change. Each chip changes one thing and keeps the rest.",
        "items": [
            {"kind": "tweak", "label": "Solid card", "text": "Make the card solid: a purple-to-pink gradient with white text." + SAME},
            {"kind": "tweak", "label": "Brand colours", "text": "Use these colours: background [#0b1020], card [#f97316], text white." + SAME},
            {"kind": "tweak", "label": "Serif font", "text": "Use a serif font for the big text (for example Playfair Display) and make it 30% bigger." + SAME},
            {"kind": "tweak", "label": "Bouncier", "text": "Make all the motion bouncier, with a little overshoot." + SAME},
            {"kind": "tweak", "label": "Calmer", "text": "Make all the motion 20% slower and calmer." + SAME},
            {"kind": "tweak", "label": "Earlier tag", "text": "Bring the tag in at 2 seconds instead of 3.5." + SAME},
            {"kind": "tweak", "label": "Top-left, smaller", "text": "Put the card in the top-left corner, 20% smaller." + SAME},
            {"kind": "tweak", "label": "Bigger text", "text": "Make all the text bigger and easier to read on a phone." + SAME},
        ],
    },
    {
        "id": "moves",
        "num": "5",
        "title": "Motion moves",
        "body": "Ten classic moves. Click one, then finish the sentence with where to use it.",
        "items": [
            {
                "kind": "prompt",
                "id": "moves-demo",
                "label": "Demo of all 10 moves",
                "text": """What: a [14]-second demo of 10 classic motion moves, one after another, each with a small caption naming it.

The moves:
- Rise: fade in while moving up a little
- Pop: grow from small with a slight overshoot
- Count-up: a number rolls to its value
- Checklist: lines get a tick one by one
- Typewriter: text types itself
- Slide-in: enter from the side
- Blur-in: go from blurry to sharp
- Punch-in: the whole frame zooms in fast
- Reframe: the scene shrinks into a card and something new appears
- Bar fill: a progress bar fills up

Look: clean white frosted cards on a soft light gradient, Inter font.

Timing: give each move the same share of time, with a short clean cut between them.

Output: renders/moves.mp4. Check that all 10 moves appear.""",
            },
            {"kind": "move", "label": "Rise", "text": "Rise: fade in while moving up a little. Use it on "},
            {"kind": "move", "label": "Pop", "text": "Pop: grow from small with a slight overshoot. Use it on "},
            {"kind": "move", "label": "Count-up", "text": "Count-up: roll a number up to its value. Use it for "},
            {"kind": "move", "label": "Checklist", "text": "Checklist: tick lines off one by one. Use it for "},
            {"kind": "move", "label": "Typewriter", "text": "Typewriter: type the text out letter by letter. Use it for "},
            {"kind": "move", "label": "Slide-in", "text": "Slide-in: bring it in from the side. Use it on "},
            {"kind": "move", "label": "Blur-in", "text": "Blur-in: go from blurry to sharp. Use it on "},
            {"kind": "move", "label": "Punch-in", "text": "Punch-in: zoom the whole frame in fast, for the line people should remember. Use it when "},
            {"kind": "move", "label": "Reframe", "text": "Reframe: shrink the video into a card and bring in something new. Use it when "},
            {"kind": "move", "label": "Bar fill", "text": "Bar fill: fill a progress bar up to its value. Use it for "},
        ],
    },
    {
        "id": "styles",
        "num": "6",
        "title": "Styles",
        "body": "Each style is a set of design rules: fonts, colours and how things move. It works with any request.",
        "items": [
            {
                "kind": "style",
                "label": "Bold Type",
                "note": "Giant words that hit on the beat. Made for hooks and short punchy lines.",
                "text": """STYLE: Bold Type
- Typography only: no cards, no photos, no boxes. The words carry the whole video.
- Font: Anton from Google Fonts (download it into fonts/), uppercase, very large. The key word on each screen is as wide as the frame allows.
- Colours: near-black background #0d0d0d, off-white text #f5f5f0, and electric orange #ff5b1f for the one word that matters most on each screen.
- Motion: every word snaps in on the beat, fast (expo.out over 0.2 to 0.35 seconds). Vary the entrance: reveal up from behind a mask, punch in from 120% scale, or shove in sideways. Hard cut between screens, no fades.
- Rhythm: time the cuts to the natural pauses in the text, like a drum pattern.""",
            },
            {
                "kind": "style",
                "label": "Frosted Glass",
                "note": "Clean frosted panels over glowing colour. Calm, premium, product-ready.",
                "text": """STYLE: Frosted Glass
- Panels: white at about 70% opacity with a 24px background blur, a 1px white border at 60%, 28px rounded corners, and a soft two-layer shadow.
- Background: a deep indigo #312e81 to sky blue #38bdf8 gradient with two or three soft light orbs drifting slowly behind the panels, so the blur has something to show.
- Font: Manrope from Google Fonts (download it into fonts/). Headings in ExtraBold, body in Medium. Text in slate #0f172a, with small spaced-out uppercase labels above headings.
- Accent: mint #10b981, used sparingly for highlights, ticks and progress.
- Motion: smooth and unhurried. Panels lift 24px while fading in (sine.out, 0.5 seconds), with content inside staggered by 0.08 seconds. No bounce or overshoot.""",
            },
            {
                "kind": "style",
                "label": "Paper Print",
                "note": "Newspaper-style serif type on textured paper. For stories, quotes and opinions.",
                "text": """STYLE: Paper Print
- It should feel printed, not digital: like a page from a magazine or a newspaper.
- Background: cream newsprint #f4efe6 with a faint paper texture and a light halftone dot pattern (about 8% opacity).
- Fonts (download from Google Fonts into fonts/): Fraunces for headlines, set large, mixing roman and italic words for emphasis; IBM Plex Mono for small uppercase captions and labels.
- Colours: ink #161616 with cobalt blue #1d4ed8 as the single accent.
- Details: highlighter-marker strokes behind key words, thin column rules, and a small issue number or date in a corner.
- Motion: calm and tactile. Text wipes in left to right as if being printed, marker strokes draw on after the words land, and timings are slightly uneven so it feels hand-made.""",
            },
            {
                "kind": "style",
                "label": "Neon Pop",
                "note": "Bright flat colour, thick outlines and springy motion. Grabs attention fast.",
                "text": """STYLE: Neon Pop
- Flat, bright and playful. No gradients and no glass.
- Font: Baloo 2 ExtraBold from Google Fonts (download it into fonts/), big and rounded.
- Colours: hot pink #ff2e88, cyan #00e5ff, sunflower #ffd23f and ink #14121f. Every shape gets a 5px ink outline and a hard 10px offset shadow with no blur.
- Extras: squiggles, sparkles and halftone circles drawn in CSS or SVG, scattered around the edges.
- Motion: springy. Things pop in with elastic.out, squash a little when they land, and the decorations wobble gently the whole time.""",
            },
        ],
    },
    {
        "id": "make",
        "num": "7",
        "title": "Make a video",
        "body": "Ready-made requests for common videos. Swap the [brackets] for your own, and add a style if you like.",
        "items": [
            {
                "kind": "prompt",
                "id": "text-video",
                "label": "Text-only video",
                "note": "Made for phones: pick 9:16 in the Export badge first.",
                "text": """What: a [15]-second video made with HyperFrames in this folder, using only animated text. No footage.

Script (use my words exactly, don't shorten or rewrite them):
[Nobody reads a wall of text. So give them one line at a time. Make every line earn its spot. End with one clear next step.]

Rules:
- One sentence per screen. A long sentence can wrap over two or three lines.
- Every screen stays up long enough to read comfortably.
- Text is big enough to read on a phone and stays inside the middle 80% of the width.

Look: if there's a STYLE section below, follow it. If not, use clean white frosted cards on a soft light gradient with the Inter font.

Output: renders/text.mp4.""",
            },
            {
                "kind": "prompt",
                "id": "product-video",
                "label": "Product launch video",
                "note": "Put a product.png in the project (Add files → Project folder) to use your real product.",
                "text": """What: a [12]-second product launch video made with HyperFrames in this folder.

Product: [Brewly, an app that delivers fresh coffee beans on your schedule and learns which roasts you like].

Hero visual: if there's a product.png in this folder, make it the star. If not, build the product in HTML and CSS: an app screen, a phone showing the app, or a logo.

Structure:
1. 0 to 2 s: reveal the logo or product name.
2. 2 to 9 s: three feature moments, one at a time. Show the product doing each thing, not just a caption: [pick your roast in two taps] / [skip or pause a delivery anytime] / [a new recommendation every month].
3. 9 to 12 s: end card with the name, one short line, and the call to action [Start your free trial].

Only use numbers I give you. Don't invent stats.

Look: if there's a STYLE section below, follow it. If not, use clean white frosted cards on a soft light gradient.

Output: renders/product.mp4.""",
            },
            {
                "kind": "prompt",
                "id": "app-promo",
                "label": "App promo from screenshots",
                "note": "Add your app screenshots with Add files → Screenshots.",
                "text": """What: a [60]-second promo for my app, made with HyperFrames in this folder.

App: [what it does, in one sentence].

Material: the screenshots folder has real screens from the app.

Steps:
1. Look at every screenshot first and note what each one shows.
2. Open with a short hook. Then show each screen and zoom into the part that matters (a number, a chart, a button), with one short line about what it does for the user.
3. Use the screenshots exactly as they are. Don't redraw them.
4. Energy: fast zooms and pans, bold words between screens, cuts on a steady beat.
5. End on the logo, one short line, and the call to action [Try it free].

Output: renders/promo.mp4.""",
            },
            {
                "kind": "prompt",
                "id": "own-video",
                "label": "Graphics on your own video",
                "note": "Add your video with Add files → Project folder, then put its file name in the brackets.",
                "text": """What: add motion graphics on top of my video [clip.mp4] in this folder, using HyperFrames.

First, understand it:
- Transcribe it with npx hyperframes transcribe and check the word timings against the audio.
- Work out what the video is about and which 3 to 6 moments matter most.
- If whisper isn't installed, stop and tell me to run the setup prompt.

Then add graphics:
- One graphic per key moment, made for what's being said: a number becomes a counter, a list becomes a checklist, a before and after becomes a comparison.
- Each one starts on the exact word.
- One consistent style across the whole video.

Don't touch:
- My footage: keep its size, frame rate, audio and cut exactly as they are.
- The first 3 seconds. That's the hook.
- Faces, the bottom third (where captions go), and the outer 10% on the left and right.

Look: if there's a STYLE section below, follow it. If not, use clean white frosted cards.

Output: renders/with-graphics.mp4.""",
            },
        ],
    },
    {
        "id": "polish",
        "num": "8",
        "title": "Polish",
        "body": "Get a version you like first, then refine one moment at a time. Describe moments by what's said (\"when I say 40 a week\"), not by seconds.",
        "items": [
            {
                "kind": "prompt",
                "id": "fix-moment",
                "label": "Change one moment",
                "text": """Change one moment only. When I say ["the words"], show [what you want to appear]. Time it to my voice and match the pace of the video. Keep everything else exactly as it is, then render again.""",
            },
            {
                "kind": "prompt",
                "id": "sound",
                "label": "Add sound effects",
                "note": "Uses an sfx folder if you add one. Otherwise Claude makes the sounds.",
                "text": """Add small sound effects using the files in the sfx folder. If there isn't one, make short, clean sounds with ffmpeg first.
- A soft tick when each list item or check appears.
- A counter sound while a number rolls.
- One chime on the final card.
- Nothing when cards slide in or out, and no whooshes.

Keep them well under any voice, then render again.""",
            },
        ],
    },
    {
        "id": "export",
        "num": "9",
        "title": "Special formats",
        "body": "One-off formats for editing software. They use the quality you picked above unless they say otherwise.",
        "items": [
            {"kind": "tweak", "label": "ProRes MOV", "text": "Render it again as a ProRes 4444 MOV."},
            {"kind": "tweak", "label": "PNG frames", "text": "Also export it as a PNG frame sequence."},
            {"kind": "tweak", "label": "4K 120 fps", "text": "Render it again in 4K at 120 fps."},
            {
                "kind": "prompt",
                "id": "transparent",
                "label": "Transparent overlay",
                "note": "For putting your graphics over other footage in Premiere, After Effects or DaVinci.",
                "text": """Make a transparent version I can put over other footage: remove the background so only the graphics remain. Use solid cards instead of frosted glass, because frosted glass needs something behind it to blur.

Export both:
- renders/overlay.mov (ProRes 4444 with alpha)
- renders/overlay-png/ (PNG frames)""",
            },
        ],
    },
    {
        "id": "fix",
        "num": "10",
        "title": "If something looks off",
        "body": "Click the problem you see. For anything else, describe it like you'd tell a friend.",
        "items": [
            {"kind": "tweak", "label": "Wrong font", "text": "The font looks wrong. Download the right font file into fonts/ and use it."},
            {"kind": "tweak", "label": "Text cut off on phones", "text": "Text gets cut off on phones. Keep all text inside the middle 80% of the width."},
            {"kind": "tweak", "label": "Covers the captions", "text": "A graphic covers the captions. Move every graphic above the bottom third."},
            {"kind": "tweak", "label": "Too early or late", "text": "A graphic is off-time. Make it appear exactly when I say "},
            {"kind": "tweak", "label": "File too big", "text": "The file is too big. Render again with --crf 20."},
        ],
    },
]
