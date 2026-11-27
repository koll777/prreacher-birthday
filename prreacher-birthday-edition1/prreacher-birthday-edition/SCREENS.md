# Screen flow and acceptance checklist

## Campaign route

`Home → Matchmaking → Hero Select → Loading → Riki Challenge → Clinkz Challenge → Intelligence Test → Survival → Final Boss → Victory → Treasure → Letter → Hidden Room → Campaign Complete`

The top navigation remains available for Profile, Achievements, and Settings during the campaign.

## Visual direction

A cinematic dark-fantasy game interface: near-black graphite surfaces, restrained gold typography, violet and ember lighting, geometric original hero illustrations, technical labels and animated ambient particles. The main cover, hero selection and player dossier use distinct layouts. All screens collapse to a one-column mobile layout where appropriate.

## Screen acceptance checklist

| Screen | Main interaction | Completion condition |
|---|---|---|
| Home | Start Raid / top navigation | Start launches matchmaking; campaign state is displayed |
| Matchmaking | Cancel / wait | Match Found opens hero selection |
| Hero Select | Lock Riki or Clinkz | Selected hero is saved and loading starts |
| Loading | Automatic progress | Opens Riki challenge |
| Riki Challenge | Click moving targets for 30 sec | Score and record are saved |
| Clinkz Challenge | Click faster targets for 30 sec | Score and record are saved |
| Intelligence Test | Answer seven questions | Score is calculated and next stage opens |
| Survival | Dodge timed pub events for 30 sec | Survival result is recorded |
| Final Boss | Use four attacks | Three health phases; zero HP opens victory |
| Victory | Open treasure | Treasure screen opens |
| Treasure | Open chest | Immortal achievement unlocks; letter button appears |
| Letter | Open hidden room | Letter progress is saved |
| Hidden Room | Claim secret title | Secret achievements unlock |
| Profile | Review local stats and open STRATZ | No fabricated Dota statistics |
| Achievements | Review locked/unlocked achievements | Status reflects saved progress |
| Settings | Change volume/effects and reset | Values persist after refresh |

## Known boundaries

- No backend, account system, cloud saves or live STRATZ API connection.
- STRATZ profile is linked by URL and Steam Account ID only.
- Web Audio effects are synthesized; there is no licensed soundtrack or voice-over.
- Riki and Clinkz are original stylized SVG illustrations, not official 3D models or exported game animations.
- Progress is stored locally in the current browser using `localStorage`.
