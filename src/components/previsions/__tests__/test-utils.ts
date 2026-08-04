import type userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";

/**
 * Renseigne un champ texte/nombre/date en un seul geste, au lieu de le
 * simuler caractere par caractere avec `user.type()`.
 *
 * Pourquoi ce detour existe (mesure, pas hypothese) :
 * - `user.type(field, "Apport initial")` declenche keydown/keypress/input/
 *   keyup + un cycle React complet PAR caractere. Mesure en isolation sur
 *   ApportFormDialog : ~70ms/caractere, soit ~1000ms pour un seul champ de
 *   14 caracteres.
 * - `testTimeout` par defaut de Vitest est 5000ms, non configure dans
 *   vitest.config.ts. Un dialogue a 3-4 champs texte suffit a l'approcher
 *   meme isole ; sous la contention CPU de la suite complete (~270 fichiers
 *   de tests jsdom en parallele sur une machine a 12 coeurs), le meme test
 *   depasse regulierement 5000ms — d'ou les `Test timed out in 5000ms`
 *   non deterministes, jamais des `AssertionError`.
 *
 * Detour tente puis abandonne : `user.click(field)` + `user.paste(value)`
 * (meme famille de gain, ~90ms au lieu de ~1000ms) a ete essaye en premier,
 * mais introduit une course avec l'auto-focus de Radix Dialog au montage
 * (`FocusScope`, planifie via un vrai timer) : `user.paste()` cible
 * `document.activeElement`, qui peut avoir change entre le `click` et le
 * `paste` une fois la frappe caractere-par-caractere retiree — le test
 * echouait alors par `AssertionError` (valeur vide), pas par timeout.
 * `fireEvent.change` fixe la valeur directement sur l'element vise, sans
 * dependre du focus courant : la course disparait avec la cause, pas par
 * un correctif qui la contournerait.
 *
 * `fireEvent.change` traverse le meme chemin applicatif qu'une saisie
 * reussie (setter natif de valeur -> evenement `input`/`change` ->
 * `onChange` React de `@testing-library/react`, qui applique deja le
 * contournement necessaire pour que React detecte le changement sur un
 * champ controle), et declenche donc les memes effets observables (ex.
 * `touched` mis a `true` dans les gardes de fermeture ERR-145/ERR-146) —
 * sans les evenements DOM intermediaires par caractere et sans dependre du
 * focus.
 *
 * A ne PAS utiliser pour un champ dont le test porte sur le comportement
 * caractere-par-caractere lui-meme (raccourcis clavier inclus dans la
 * chaine type comme `{enter}`, formatage en cours de frappe) : y garder
 * `user.type`, qui reste necessaire dans ce cas precis. Le parametre `user`
 * est conserve dans la signature pour ces cas et pour la coherence des
 * appels dans les tests, mais n'est pas utilise par cette implementation.
 */
export async function fillField(
  _user: ReturnType<typeof userEvent.setup>,
  field: HTMLElement,
  value: string,
): Promise<void> {
  fireEvent.change(field, { target: { value } });
}
