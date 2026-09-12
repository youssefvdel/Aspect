/* Side-effect module: seeds the mock data.
 *
 * It must be the FIRST import in main.tsx. ES module dependencies are all
 * evaluated (depth-first, in import order) BEFORE the importing module's own
 * body runs, so calling initReconMockData() inside main.tsx would still happen
 * after ./App — and Recon's tracker store hydrates itself from localStorage at
 * module load. Keeping the call in its own leaf module guarantees it runs first.
 */
import { initReconMockData } from './mockData';
import { seedPreviewData } from './previewData';

initReconMockData();

/* Fully static — no network, no async. Both preview keys are written before the
   app renders, so the Live Match view's first paint already has the lobby and
   never flashes its "Waiting for Valorant Match" empty state. */
seedPreviewData();

export {};
