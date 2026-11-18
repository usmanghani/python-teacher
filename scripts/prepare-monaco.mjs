// Copy the editor and the Python runtime out of node_modules so the site serves them itself.
// Nothing is fetched from a CDN, which keeps the classroom working on locked-down networks.
import { cp, mkdir, readFile } from 'node:fs/promises'

const versionOf = async name => JSON.parse(await readFile(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8')).version

const monaco = await versionOf('monaco-editor')
const editor = new URL(`../public/monaco/${monaco}/vs/`, import.meta.url)
await mkdir(editor, { recursive: true })
await cp(new URL('../node_modules/monaco-editor/min/vs/', import.meta.url), editor, { recursive: true })

const pyodide = await versionOf('pyodide')
const python = new URL(`../public/pyodide/${pyodide}/`, import.meta.url)
await mkdir(python, { recursive: true })
for (const file of ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']) {
  await cp(new URL(`../node_modules/pyodide/${file}`, import.meta.url), new URL(file, python))
}
console.log(`Prepared local Monaco ${monaco} and Pyodide ${pyodide}`)
