/**
 * dsh-panel-fold — host half.
 *
 * The whole feature lives in the web client (lib/client.js): it marks the
 * sidebar's panel-list <nav> and a CSS rule hides every row except the last
 * one (the More button), so all global panels stay reachable from the More
 * menu while the workspace and session list gets the vertical space back.
 *
 * This row exists only so the bundle patch has something to insert; it
 * registers no services, tools, or routes.
 */

export const name = 'dsh-panel-fold'

export function apply() {
	// Intentionally empty. The web client half is wired from the package's
	// `dsh.client` manifest in package.json.
}
