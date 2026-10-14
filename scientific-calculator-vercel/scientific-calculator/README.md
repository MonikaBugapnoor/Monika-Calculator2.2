# Scientific Calculator

A responsive, client-side scientific calculator built with HTML, CSS, and vanilla JavaScript. No backend or API keys required.

## Features

- Arithmetic, parentheses, percent, sign toggle, and implicit multiplication
- Trigonometry: `sin`, `cos`, `tan`, and inverse trig functions
- DEG/RAD angle modes
- Square root, powers, factorial, reciprocal, absolute value
- `log`, `ln`, constants `π` and `e`, and previous answer (`Ans`)
- Memory controls: MC, MR, M+, M−, MS
- Calculation history, copy result, dark/light theme
- Keyboard input and responsive layout
- Safe expression parser (does not use JavaScript `eval()`)

## Run locally

Open `index.html` in a browser, or run a local static server:

```bash
npx serve .
```

## Deploy to Vercel

### Option A — Vercel website
1. Extract this ZIP file.
2. Upload the project folder to a new GitHub repository.
3. Sign in to [Vercel](https://vercel.com/), select **Add New → Project**, and import that repository.
4. Framework preset: **Other**.
5. Build command: leave blank.
6. Output directory: leave blank (project root).
7. Click **Deploy**.

### Option B — Vercel CLI
Install Node.js, then from this folder run:

```bash
npx vercel
```

Follow the prompts. To publish production:

```bash
npx vercel --prod
```

This is a static website; there is no build step and no environment variables needed.
