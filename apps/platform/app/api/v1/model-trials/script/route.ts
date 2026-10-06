import { MODEL_TRIAL_SCRIPT } from '@/lib/model-trial-script';

/** The trial script a client runs on its own machine. Public: it holds no secrets and calls only what the person running it chooses. */
export async function GET() {
  return new Response(MODEL_TRIAL_SCRIPT, {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Content-Disposition': 'attachment; filename="aic-model-trial.mjs"', 'Cache-Control': 'public, max-age=3600' },
  });
}
