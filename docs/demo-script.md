# Demo script (about 2 minutes)

Setup: backend and frontend running (see README). An API key is optional; without one the
demo still runs end to end using sample seeds and the offline assistant.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Landing `/` | Pick a language on the first-run screen. Scroll past the stats strip and the 4-step loop. | "40% of India works in farming and 90% of fresh water goes to it. OptiFarm closes one loop: identify, plan, irrigate, prove." |
| 0:15 | Landing | Change the crop in **What one hectare could save**. | "Every number is simulated from stated assumptions, and the farmer can change them." |
| 0:25 | Click **Try the Demo** | The guided stepper appears (yellow bar). | |
| 0:30 | Seed `/app/seed` | Paddy sample is pre-selected. Tap the **Water need** chip. | "The AI only suggests the crop; the farmer confirms. Every fact comes from our curated crop database, and each label reads aloud." Optionally tap sample 5 (cotton) to show the low-confidence warning. |
| 0:50 | **Next** → Field | Point at the sample field cards, the map, the pump settings. | "A 1.3 ha Thanjavur delta plot with a 3.7 kW solar pump. Farmers can also search, drop a pin or draw their own field." |
| 1:00 | **Next** → Zones | Tap Zone 1 in the list. | "Red with stripes and an exclamation icon is critical; blue with waves is waterlogged. Colour, pattern and icon, so it works for colour-blind users." |
| 1:15 | **Next** → Plan | Point at the sun arc and the grid. Press **Read today's plan aloud**. Drag the rain threshold slider. | "Critical zones first, inside the solar window. Rainy days are skipped automatically, and the plan updates live." |
| 1:35 | **Next** → Impact | Switch Flood / Drip / OptiFarm. Open **See and edit assumptions**, change the tariff. | "Litres, kWh and rupees saved per hectare per season against flood irrigation." |
| 1:50 | Chat button | Tap "Why is zone 1 red?" in Tamil or Hindi. | "The assistant answers from this field's own data and refuses pesticide or loan advice, pointing to the KVK and Kisan Call Centre." |

Offline check: in DevTools → Network choose *Offline* and reload. The badge turns to
"Offline", sample seeds, the saved field, the last forecast and the FAQ assistant still work.
