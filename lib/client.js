// dsh-panel-fold — fold the sidebar's "global panels" icon rows into the More menu,
// giving the workspace / session list its vertical space back.
//
// How it works: ui-sidebar renders the panel list as a <nav aria-label="Global panels">
// whose last child is the More button. This plugin marks that <nav> with
// data-dsh-panel-fold-nav and installs one CSS rule that hides every child except the
// last — so only More remains, and all panels are still reachable from the More menu
// (the menu's onOpen only calls selectPanel and never touches pin state).
//
// Fully reversible: the rule hangs off a class on <html>, and the toggle lives in the
// More menu itself. The choice is persisted in localStorage.
//
// Why CSS and not the built-in unpin mechanism: ui-sidebar only exposes setPinned
// through the sidebar.panellist.actions owner props, which mount when the More menu
// opens — so it cannot be applied at startup. The CSS route depends on no hashed class
// name, only on the structural signal "this nav contains a button[aria-haspopup=menu]".

window.__ModuleLoader__.load({
	id: 'dsh-panel-fold',
	factory(require) {
		const React = require('react')
		const h = React.createElement

		const STORAGE_KEY = 'dsh-panel-fold:mode'
		const NAV_ATTR = 'data-dsh-panel-fold-nav'
		const CSS_TAG_ID = 'dsh-panel-fold/panel-fold.css'
		const ROOT_CLASS_COLLAPSED = 'dsh-panel-fold-collapsed'
		const ROOT_CLASS_EXPANDED = 'dsh-panel-fold-expanded'

		const zh = /^zh/i.test((typeof navigator !== 'undefined' && navigator.language) || '')
		const TEXT = zh
			? {
					showPanels: '显示全局面板图标',
					hidePanels: '收起全局面板图标（只留『更多』）',
				}
			: {
					showPanels: 'Show global panel icons',
					hidePanels: 'Fold global panel icons into More',
				}

		/** Folded is the default, so anything other than an explicit 'expanded' means folded. */
		function readMode() {
			try {
				return localStorage.getItem(STORAGE_KEY) === 'expanded' ? 'expanded' : 'collapsed'
			} catch {
				return 'collapsed'
			}
		}

		function writeMode(mode) {
			try {
				localStorage.setItem(STORAGE_KEY, mode)
			} catch {
				// Private mode and friends: quietly degrade to this session only.
			}
		}

		function applyMode(mode) {
			const root = document.documentElement
			root.classList.toggle(ROOT_CLASS_COLLAPSED, mode === 'collapsed')
			root.classList.toggle(ROOT_CLASS_EXPANDED, mode === 'expanded')
		}

		function installStyles() {
			if (typeof document === 'undefined') return
			if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG_ID) + ']') !== null) return
			const tag = document.createElement('style')
			tag.dataset.plugin = 'dsh-panel-fold'
			tag.dataset.pluginCss = CSS_TAG_ID
			tag.textContent = [
				// Folded: keep only the last child of the panel list (the More button).
				'html.' + ROOT_CLASS_COLLAPSED + ' nav[' + NAV_ATTR + '] > *:not(:last-child){display:none!important}',
			].join('\n')
			document.head.appendChild(tag)
		}

		/** The panel list's aria-label (ui-sidebar's t("panels.label")). */
		const NAV_LABELS = ['全局面板', 'Global panels']

		/**
		 * Mark the panel-list <nav>.
		 *
		 * Primary signal is aria-label (exact, unambiguous) for the two strings ui-sidebar
		 * ships; if those ever change we fall back to the structural signal "contains a
		 * button[aria-haspopup=menu] and has at least two direct child buttons", so we never
		 * hide rows inside some unrelated nav.
		 */
		function markNavs() {
			let found = 0
			for (const nav of document.querySelectorAll('nav')) {
				const label = nav.getAttribute('aria-label')
				if (label !== null && NAV_LABELS.includes(label)) {
					nav.setAttribute(NAV_ATTR, '')
					found += 1
				}
			}
			if (found > 0) return
			for (const nav of document.querySelectorAll('nav')) {
				if (nav.hasAttribute(NAV_ATTR)) continue
				if (nav.querySelector('button[aria-haspopup="menu"]') === null) continue
				if (nav.querySelectorAll(':scope > button').length < 2) continue
				nav.setAttribute(NAV_ATTR, '')
			}
		}

		let scheduled = false
		function scheduleMark() {
			if (scheduled) return
			scheduled = true
			const run = () => {
				scheduled = false
				markNavs()
			}
			if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
			else setTimeout(run, 16)
		}

		let observer = null
		function startObserving() {
			if (observer !== null || typeof MutationObserver !== 'function') return
			observer = new MutationObserver(scheduleMark)
			observer.observe(document.body, { childList: true, subtree: true })
			markNavs()
		}

		function requirePrimitives() {
			try {
				return require('@deepseek-ai/dsh-client-ui-primitives')
			} catch {
				return null
			}
		}

		/** One row at the bottom of the More menu: toggle folded <-> expanded. */
		function FoldMenuRow(props) {
			const onDismiss = props && props.onDismiss
			const [mode, setMode] = React.useState(readMode())
			const primitives = requirePrimitives()
			const MenuItemButton = primitives && primitives.MenuItemButton

			const toggle = () => {
				const next = mode === 'collapsed' ? 'expanded' : 'collapsed'
				writeMode(next)
				applyMode(next)
				setMode(next)
				if (typeof onDismiss === 'function') onDismiss()
			}

			const label = mode === 'collapsed' ? TEXT.showPanels : TEXT.hidePanels

			if (typeof MenuItemButton === 'function') {
				return h(MenuItemButton, { onSelect: toggle, separatorBefore: true, current: false }, label)
			}
			return h(
				'button',
				{
					type: 'button',
					onClick: toggle,
					style: {
						display: 'block',
						width: '100%',
						padding: '8px 10px',
						marginTop: '4px',
						border: 'none',
						borderTop: '1px solid rgba(128,128,128,0.2)',
						background: 'transparent',
						color: 'inherit',
						font: 'inherit',
						textAlign: 'left',
						cursor: 'pointer',
					},
				},
				label,
			)
		}

		function boot() {
			installStyles()
			applyMode(readMode())
			startObserving()
		}

		if (typeof document !== 'undefined') {
			if (document.body) boot()
			else document.addEventListener('DOMContentLoaded', boot, { once: true })
		}

		return {
			name: 'dsh-panel-fold',
			inject: ['slots'],
			apply(ctx) {
				ctx.slots.inject('sidebar.panellist.actions', () =>
					ctx.slots.register(
						{
							name: 'sidebar.panellist.actions',
							id: 'dsh-panel-fold',
							order: 100,
						},
						FoldMenuRow,
					),
				)
			},
		}
	},
})
