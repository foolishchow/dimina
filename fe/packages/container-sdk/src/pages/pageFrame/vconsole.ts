import VConsole from 'vconsole'

interface VConsolePosition {
	x?: number
	y?: number
}

interface StorageEntry {
	key: string
	data: unknown
	encrypted?: boolean
}

function addMiniProgramStorage(vConsole: VConsole) {
	const plugin = new VConsole.VConsolePlugin('dimina-storage', 'MiniProgram Storage')
	const content = document.createElement('div')
	content.style.cssText = 'padding:10px;overflow-wrap:anywhere'
	const status = document.createElement('p')
	status.setAttribute('role', 'status')
	status.textContent = 'Open this tab to read mini-program storage.'
	const fields = document.createElement('fieldset')
	fields.style.cssText = 'border:0;padding:0;min-width:0'
	content.append(status, fields)
	let busy = false
	let entries: StorageEntry[] = []
	const request = (detail: Record<string, unknown> = {}) => {
		if (busy) return
		busy = true
		fields.disabled = true
		status.textContent = 'Loading…'
		window.dispatchEvent(new CustomEvent('dimina:debug-storage-request', { detail }))
	}
	const button = (name: string, action: () => void) => {
		const element = document.createElement('button')
		element.type = 'button'
		element.textContent = name
		element.style.cssText = 'margin:4px;padding:6px 12px'
		element.onclick = action
		return element
	}
	const editor = (entry?: StorageEntry) => {
		const row = document.createElement('div')
		row.style.cssText = 'padding:8px 0;border-bottom:1px solid #999'
		const key = document.createElement('input')
		key.placeholder = 'New key'
		key.setAttribute('aria-label', entry ? 'Storage key' : 'New storage key')
		key.value = entry?.key ?? ''
		key.readOnly = !!entry
		const value = document.createElement('textarea')
		value.setAttribute('aria-label', 'Value (JSON)')
		value.placeholder = 'JSON value: "text", 123, true, {"a":1}'
		value.value = entry ? JSON.stringify(entry.data, null, 2) : ''
		value.rows = 3
		value.style.cssText = 'display:block;width:100%;box-sizing:border-box;font-family:monospace'
		row.append(key)
		if (entry?.encrypted) {
			const label = document.createElement('span')
			label.textContent = ' Encrypted'
			row.append(label)
		}
		row.append(value, button(entry ? 'Save' : 'Add', () => {
			if (!key.value) { status.textContent = 'Key must not be empty.'; return }
			if (!entry && entries.some(item => item.key === key.value && !item.encrypted)) {
				status.textContent = 'Key already exists. Edit its existing row.'; return
			}
			let data: unknown
			try { data = JSON.parse(value.value) }
			catch { status.textContent = 'Invalid JSON. Wrap text values in double quotes.'; return }
			request({ action: 'set', key: key.value, data, encrypted: entry?.encrypted === true })
		}))
		if (entry) {
			const confirmation = document.createElement('span')
			confirmation.hidden = true
			confirmation.append('Delete this MMKV entry?', button('Confirm delete', () => {
				request({ action: 'remove', key: entry.key, encrypted: entry.encrypted === true })
			}), button('Cancel', () => { confirmation.hidden = true }))
			row.append(button('Delete', () => { confirmation.hidden = false }), confirmation)
		}
		return row
	}
	const refresh = () => request()
	const update = (event: Event) => {
		const { value, error } = (event as CustomEvent).detail
		busy = false
		fields.disabled = false
		if (error) { status.textContent = error; return }
		entries = value
		status.textContent = 'MMKV values (JSON). Save and delete take effect immediately.'
		fields.replaceChildren(...entries.map(entry => editor(entry)), editor())
	}
	plugin.on('renderTab', (callback: (element: HTMLElement) => void) => callback(content))
	plugin.on('show', refresh)
	plugin.on('addTool', (callback: (tools: unknown[]) => void) => callback([
		{ name: 'Refresh', global: false, onClick: refresh },
	]))
	plugin.on('remove', () => window.removeEventListener('dimina:debug-storage', update))
	window.addEventListener('dimina:debug-storage', update)
	vConsole.addPlugin(plugin)
}

function setupVConsole(options: VConsolePosition = {}) {
	if (!window.vConsole) {
		const vConsole = new VConsole()
		vConsole.setSwitchPosition(options.x ?? 10, options.y ?? 140)
		window.vConsole = vConsole
		window.addEventListener('dimina:debug-ready', () => addMiniProgramStorage(vConsole), { once: true })
	}
	return window.vConsole!
}

window.__dimina_enable_vconsole__ = function enableVConsole(options: VConsolePosition = {}) {
	return Promise.resolve(setupVConsole(options))
}

if (new URLSearchParams(window.location.search).get('vconsole') === '1') {
	window.__dimina_enable_vconsole__()
}
