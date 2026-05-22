import { applyPrefs, getStoredPrefs, resolveTheme } from './index'

const prefs = getStoredPrefs()
applyPrefs(prefs, resolveTheme(prefs))
