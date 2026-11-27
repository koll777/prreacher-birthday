# Screen flow and acceptance checklist

## Campaign route

`Home → Matchmaking → Hero Select → Loading → Riki Challenge → Clinkz Challenge → Intelligence Test → Survival → Final Boss → Victory → Treasure → Letter → Hidden Room → Campaign Complete`

The top navigation remains available for Profile, Achievements, and Settings during the campaign.

## Screen acceptance checklist

| Screen | Main interaction | Completion condition |
|---|---|---|
| Home | Start Game / top navigation | Start launches matchmaking |
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
| Profile | Review local and external stats placeholders | No fabricated Dota statistics |
| Achievements | Review locked/unlocked achievements | Status reflects saved progress |
| Settings | Change volume/effects and reset | Values persist after refresh |

## Known boundaries

- The prototype has no backend, accounts, cloud saves, or real STRATZ integration yet.
- Web Audio effects are synthesized; the music control changes the level of a quiet ambient drone, not a licensed soundtrack.
- Temporary glyph artwork is not final hero art.
- Profile Dota statistics remain `DATA NOT FOUND` until real public profile data is supplied and connected.
